import * as grpc from "@grpc/grpc-js";

import { findServiceClient } from "./grpc-proto";
import type { ConnectionHandle } from "./network-ipc";
import {
  GRPC_END_SENTINEL,
  type ConnectionConfig,
  type DriverEvent,
  type GrpcConfig,
  type KeyValueItem,
  type OutboundMessage,
} from "./request-channels";
import { buildTlsOptions } from "./tls-options";

/**
 * 把启用的键值项组装为 gRPC Metadata.
 * @param items 元数据项.
 * @returns Metadata 实例.
 */
function toMetadata(items: readonly KeyValueItem[]): grpc.Metadata {
  const metadata = new grpc.Metadata();
  for (const it of items) {
    if (it.enabled && it.key !== "") {
      metadata.set(it.key, it.value);
    }
  }
  return metadata;
}

/**
 * 把 gRPC 调用错误格式化为可读字符串 (状态码名 + 详情).
 * @param err gRPC 服务错误.
 * @returns 形如 "UNAVAILABLE 详情" 的字符串.
 */
function formatGrpcError(err: grpc.ServiceError): string {
  const name = grpc.status[err.code] ?? String(err.code);
  return err.details !== "" ? `${name}: ${err.details}` : name;
}

/**
 * 把响应消息对象序列化为展示字符串.
 * @param value 响应消息.
 * @returns JSON 字符串.
 */
function formatMessage(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * 发起一个 gRPC 调用 (一元/服务端流/客户端流/双向流), 响应以事件回传.
 * @param config 连接配置 (protocol 必为 grpc).
 * @param onEvent 事件回调.
 * @returns 连接句柄 (客户端流/双向流: send 写消息, event 为 GRPC_END_SENTINEL 时半关闭).
 */
export function connectGrpc(
  config: ConnectionConfig,
  onEvent: (event: DriverEvent) => void,
): ConnectionHandle {
  if (config.protocol !== "grpc") {
    onEvent({ kind: "error", payload: { message: "协议不匹配" } });
    return { send: () => undefined, close: () => undefined };
  }
  const grpcConfig: GrpcConfig = config.grpc;
  let closedEarly = false;
  let ended = false;
  // 客户端流/双向流的可写调用句柄; grpc-js 动态泛型边界, 以受控 as 收窄 (非 as any).
  let writable:
    | grpc.ClientWritableStream<unknown>
    | grpc.ClientDuplexStream<unknown, unknown>
    | undefined;
  let cancelFn: (() => void) | undefined;

  const emitClosed = (): void => {
    if (!ended) {
      ended = true;
      onEvent({ kind: "closed", payload: { code: 0, reason: "调用结束" } });
    }
  };
  const emitError = (message: string): void => {
    if (!closedEarly) {
      onEvent({ kind: "error", payload: { message } });
    }
  };
  const emitMessage = (value: unknown): void => {
    // 已取消 (closedEarly) 后丢弃迟到响应, 避免在已关闭连接里漏出消息.
    if (closedEarly) {
      return;
    }
    onEvent({
      kind: "message",
      payload: { direction: "received", event: "", data: formatMessage(value) },
    });
  };

  void (async (): Promise<void> => {
    let parsedRequest: unknown;
    try {
      parsedRequest =
        grpcConfig.requestMessage.trim() === ""
          ? {}
          : JSON.parse(grpcConfig.requestMessage);
    } catch (err) {
      emitError(
        `请求消息 JSON 非法: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }
    let credentials: grpc.ChannelCredentials;
    try {
      if (grpcConfig.tls) {
        const tls = await buildTlsOptions(grpcConfig.settings);
        // createSsl(rootCerts, privateKey, certChain) -- 参数顺序: ca, key, cert.
        credentials = grpc.credentials.createSsl(
          tls.ca ?? null,
          tls.key ?? null,
          tls.cert ?? null,
        );
      } else {
        credentials = grpc.credentials.createInsecure();
      }
    } catch (err) {
      emitError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (closedEarly) {
      return;
    }
    let ServiceCtor: grpc.ServiceClientConstructor;
    try {
      ServiceCtor = await findServiceClient(
        grpcConfig.protoSource,
        grpcConfig.serviceName,
      );
    } catch (err) {
      emitError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (closedEarly) {
      return;
    }
    const client = new ServiceCtor(grpcConfig.target, credentials);
    const methodDef = ServiceCtor.service[grpcConfig.methodName];
    if (methodDef === undefined) {
      emitError(`未找到方法: ${grpcConfig.methodName}`);
      return;
    }
    const metadata = toMetadata(grpcConfig.metadata);
    const {
      path,
      requestSerialize,
      responseDeserialize,
      requestStream,
      responseStream,
    } = methodDef;

    if (!requestStream && !responseStream) {
      // 一元调用: makeUnaryRequest(path, serialize, deserialize, arg, metadata, callback).
      // open 在调用建立后发出 (一元无可写流, open 与 writable 无顺序依赖).
      onEvent({ kind: "open", payload: { info: "调用中" } });
      const call = client.makeUnaryRequest(
        path,
        requestSerialize as (value: unknown) => Buffer,
        responseDeserialize as (value: Buffer) => unknown,
        parsedRequest,
        metadata,
        (err: grpc.ServiceError | null, value?: unknown) => {
          if (err != null) {
            emitError(formatGrpcError(err));
            emitClosed();
            return;
          }
          emitMessage(value);
          emitClosed();
        },
      );
      // 一元也挂 cancelFn, 使 close() 在响应到达前真正中止调用.
      cancelFn = () => call.cancel();
    } else if (!requestStream && responseStream) {
      // 服务端流: makeServerStreamRequest(path, serialize, deserialize, arg, metadata).
      const call = client.makeServerStreamRequest(
        path,
        requestSerialize as (value: unknown) => Buffer,
        responseDeserialize as (value: Buffer) => unknown,
        parsedRequest,
        metadata,
      );
      cancelFn = () => call.cancel();
      call.on("data", emitMessage);
      // grpc-js 流 error 后不保证触发 end, 故 error 后补 emitClosed 终结调用 (幂等).
      call.on("error", (err: grpc.ServiceError) => {
        emitError(formatGrpcError(err));
        emitClosed();
      });
      call.on("end", emitClosed);
      onEvent({ kind: "open", payload: { info: "调用中" } });
    } else if (requestStream && !responseStream) {
      // 客户端流: makeClientStreamRequest(path, serialize, deserialize, metadata, callback).
      const call = client.makeClientStreamRequest(
        path,
        requestSerialize as (value: unknown) => Buffer,
        responseDeserialize as (value: Buffer) => unknown,
        metadata,
        (err: grpc.ServiceError | null, value?: unknown) => {
          if (err != null) {
            emitError(formatGrpcError(err));
            emitClosed();
            return;
          }
          emitMessage(value);
          emitClosed();
        },
      );
      // ClientWritableStream<unknown> 经受控 as 收窄 -- grpc-js 动态泛型无法静态推断.
      writable = call as grpc.ClientWritableStream<unknown>;
      cancelFn = () => call.cancel();
      // writable 赋值后再 emit open, 确保 open 回调里 send() 能取到 writable.
      onEvent({ kind: "open", payload: { info: "调用中" } });
    } else {
      // 双向流: makeBidiStreamRequest(path, serialize, deserialize, metadata).
      const call = client.makeBidiStreamRequest(
        path,
        requestSerialize as (value: unknown) => Buffer,
        responseDeserialize as (value: Buffer) => unknown,
        metadata,
      );
      // ClientDuplexStream<unknown, unknown> 经受控 as 收窄 -- grpc-js 动态泛型无法静态推断.
      writable = call as grpc.ClientDuplexStream<unknown, unknown>;
      cancelFn = () => call.cancel();
      call.on("data", emitMessage);
      // grpc-js 流 error 后不保证触发 end, 故 error 后补 emitClosed 终结调用 (幂等).
      call.on("error", (err: grpc.ServiceError) => {
        emitError(formatGrpcError(err));
        emitClosed();
      });
      call.on("end", emitClosed);
      // writable 赋值后再 emit open, 确保 open 回调里 send() 能取到 writable.
      onEvent({ kind: "open", payload: { info: "调用中" } });
    }
  })();

  return {
    // 注: 客户端流/双向流逐条发送的流消息不经变量解析 (主进程 send 路径无 scopes 上下文);
    // 流消息内的 {{var}} 不会被替换, 与连接时解析的 target/metadata/requestMessage 行为不同.
    send: (message: OutboundMessage) => {
      if (writable === undefined) {
        return;
      }
      if (message.event === GRPC_END_SENTINEL) {
        writable.end();
        return;
      }
      try {
        const parsed =
          message.data.trim() === "" ? {} : JSON.parse(message.data);
        writable.write(parsed);
      } catch (err) {
        emitError(
          `发送消息 JSON 非法: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    close: () => {
      closedEarly = true;
      cancelFn?.();
      emitClosed();
    },
  };
}
