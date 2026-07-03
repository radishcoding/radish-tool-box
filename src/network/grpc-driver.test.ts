// @vitest-environment node
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as grpc from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ConnectionConfig, DriverEvent } from "./request-channels";
import { connectGrpc } from "./grpc-driver";

// Proto 定义扩展了服务端流与客户端流 rpc, 供回归测试使用.
const PROTO = `
syntax = "proto3";
package greet;
message HelloRequest { string name = 1; }
message HelloReply { string message = 1; }
service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc SayHelloServerStream (HelloRequest) returns (stream HelloReply);
  rpc SayHelloClientStream (stream HelloRequest) returns (HelloReply);
  rpc SayHelloBidi (stream HelloRequest) returns (stream HelloReply);
}
`;

let server: grpc.Server;
let port: number;
let protoFile: string;

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), "radish-grpc-"));
  protoFile = join(dir, "greet.proto");
  await writeFile(protoFile, PROTO, "utf8");
  const def = loadSync(protoFile, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const pkg = grpc.loadPackageDefinition(def) as unknown as {
    greet: {
      Greeter: grpc.ServiceClientConstructor & {
        service: grpc.ServiceDefinition;
      };
    };
  };
  server = new grpc.Server();
  server.addService(pkg.greet.Greeter.service, {
    sayHello: (
      call: grpc.ServerUnaryCall<{ name: string }, { message: string }>,
      cb: grpc.sendUnaryData<{ message: string }>,
    ) => {
      cb(null, { message: `hi ${call.request.name}` });
    },
    sayHelloServerStream: (
      call: grpc.ServerWritableStream<{ name: string }, { message: string }>,
    ) => {
      call.write({ message: `s1 ${call.request.name}` });
      call.write({ message: `s2 ${call.request.name}` });
      call.end();
    },
    sayHelloClientStream: (
      call: grpc.ServerReadableStream<{ name: string }, { message: string }>,
      cb: grpc.sendUnaryData<{ message: string }>,
    ) => {
      const names: string[] = [];
      call.on("data", (req: { name: string }) => {
        names.push(req.name);
      });
      call.on("end", () => {
        cb(null, { message: `collected ${names.join(",")}` });
      });
    },
    sayHelloBidi: (
      call: grpc.ServerDuplexStream<{ name: string }, { message: string }>,
    ) => {
      call.on("data", (req: { name: string }) =>
        call.write({ message: `echo ${req.name}` }),
      );
      call.on("end", () => call.end());
    },
  });
  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      "127.0.0.1:0",
      grpc.ServerCredentials.createInsecure(),
      (err, p) => {
        if (err) {
          reject(err);
          return;
        }
        port = p;
        resolve();
      },
    );
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.tryShutdown(() => resolve()));
});

/** 构造一个指向本地测试服务端的 gRPC ConnectionConfig. */
const baseGrpc = (method: string, msg: string): ConnectionConfig => ({
  protocol: "grpc",
  grpc: {
    protoSource: { kind: "file", value: protoFile },
    target: `127.0.0.1:${port}`,
    tls: false,
    serviceName: "greet.Greeter",
    methodName: method,
    metadata: [],
    requestMessage: msg,
    settings: {
      followRedirects: true,
      maxRedirects: 5,
      timeoutMs: 10000,
      sslVerify: true,
    },
  },
});

/** 收集所有事件直到 closed 或 error, 返回事件序列. */
function collectUntilDone(config: ConnectionConfig): Promise<DriverEvent[]> {
  return new Promise<DriverEvent[]>((resolve) => {
    const events: DriverEvent[] = [];
    connectGrpc(config, (e) => {
      events.push(e);
      if (e.kind === "closed" || e.kind === "error") {
        // 等待同步补发的 closed (error 后立即补发); 用 queueMicrotask 让补发先落入 events.
        queueMicrotask(() => resolve(events));
      }
    });
  });
}

describe("connectGrpc", () => {
  it("一元调用收到响应 message 后 closed", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectGrpc(baseGrpc("SayHello", '{"name":"bob"}'), (e) => {
        events.push(e);
        if (e.kind === "closed") resolve();
      });
    });
    const msg = events.find((e) => e.kind === "message");
    expect((msg?.payload as { data: string }).data).toContain("hi bob");
  });

  it("双向流: 发两条 + 结束发送, 收到两条回声后 closed", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectGrpc(baseGrpc("SayHelloBidi", "{}"), (e) => {
        events.push(e);
        if (e.kind === "open") {
          handle.send({ event: "", data: '{"name":"a"}' });
          handle.send({ event: "", data: '{"name":"b"}' });
          handle.send({ event: "__grpc_end__", data: "" });
        }
        if (e.kind === "closed") resolve();
      });
    });
    const msgs = events.filter((e) => e.kind === "message");
    expect(msgs.length).toBe(2);
    expect((msgs[0].payload as { data: string }).data).toContain("echo a");
  });

  // P0 回归: grpc-js 服务端流/双向流 error 后不保证触发 end, 驱动应在 error 后补发 closed.
  it("[P0] 服务端流 error (target 不可达) 后事件序列含 error 紧跟 closed", async () => {
    const unreachable: ConnectionConfig = {
      protocol: "grpc",
      grpc: {
        protoSource: { kind: "file", value: protoFile },
        // 使用不可达端口触发连接失败, 复现 grpc-js error 不发 end 的情形.
        target: "127.0.0.1:1",
        tls: false,
        serviceName: "greet.Greeter",
        methodName: "SayHelloServerStream",
        metadata: [],
        requestMessage: '{"name":"x"}',
        settings: {
          followRedirects: true,
          maxRedirects: 5,
          timeoutMs: 3000,
          sslVerify: true,
        },
      },
    };
    const events = await collectUntilDone(unreachable);
    const errorIdx = events.findIndex((e) => e.kind === "error");
    const closedIdx = events.findIndex((e) => e.kind === "closed");
    expect(errorIdx).toBeGreaterThanOrEqual(0);
    expect(closedIdx).toBeGreaterThan(errorIdx);
    // closed 恰好一次.
    expect(events.filter((e) => e.kind === "closed")).toHaveLength(1);
    // error 消息含状态码名 (formatGrpcError 格式: "UNAVAILABLE: ..." 等).
    const errMsg = (events[errorIdx].payload as { message: string }).message;
    expect(errMsg).toMatch(/^[A-Z_]+/);
  }, 10000);

  // P0 回归: 双向流 error 后同样补发 closed.
  it("[P0] 双向流 error (target 不可达) 后事件序列含 error 紧跟 closed", async () => {
    const unreachable: ConnectionConfig = {
      protocol: "grpc",
      grpc: {
        protoSource: { kind: "file", value: protoFile },
        target: "127.0.0.1:1",
        tls: false,
        serviceName: "greet.Greeter",
        methodName: "SayHelloBidi",
        metadata: [],
        requestMessage: "{}",
        settings: {
          followRedirects: true,
          maxRedirects: 5,
          timeoutMs: 3000,
          sslVerify: true,
        },
      },
    };
    const events = await collectUntilDone(unreachable);
    const errorIdx = events.findIndex((e) => e.kind === "error");
    const closedIdx = events.findIndex((e) => e.kind === "closed");
    expect(errorIdx).toBeGreaterThanOrEqual(0);
    expect(closedIdx).toBeGreaterThan(errorIdx);
    expect(events.filter((e) => e.kind === "closed")).toHaveLength(1);
  }, 10000);

  it("服务端流正常: 收到多条 message 后 closed", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectGrpc(baseGrpc("SayHelloServerStream", '{"name":"world"}'), (e) => {
        events.push(e);
        if (e.kind === "closed") resolve();
      });
    });
    const msgs = events.filter((e) => e.kind === "message");
    expect(msgs.length).toBe(2);
    expect((msgs[0].payload as { data: string }).data).toContain("s1 world");
    expect((msgs[1].payload as { data: string }).data).toContain("s2 world");
    expect(events.at(-1)?.kind).toBe("closed");
  });

  it("客户端流: 发多条 + __grpc_end__ 半关闭, 收单条聚合响应后 closed", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectGrpc(
        baseGrpc("SayHelloClientStream", "{}"),
        (e) => {
          events.push(e);
          if (e.kind === "open") {
            handle.send({ event: "", data: '{"name":"alice"}' });
            handle.send({ event: "", data: '{"name":"bob"}' });
            handle.send({ event: "__grpc_end__", data: "" });
          }
          if (e.kind === "closed") resolve();
        },
      );
    });
    const msgs = events.filter((e) => e.kind === "message");
    expect(msgs.length).toBe(1);
    expect((msgs[0].payload as { data: string }).data).toContain("alice");
    expect((msgs[0].payload as { data: string }).data).toContain("bob");
  });

  it("close 取消幂等: open 后立即 close, closed 恰一次, 无 error 漏出", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      const handle = connectGrpc(baseGrpc("SayHelloBidi", "{}"), (e) => {
        events.push(e);
        if (e.kind === "closed") resolve();
      });
      // 立即关闭, 不等 open.
      handle.close();
    });
    // closed 恰一次.
    expect(events.filter((e) => e.kind === "closed")).toHaveLength(1);
    // 无 error 事件 (close 是正常取消, 不产生 error).
    expect(events.filter((e) => e.kind === "error")).toHaveLength(0);
  });

  it("请求消息 JSON 非法 -> error 且 message 含提示", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectGrpc(baseGrpc("SayHello", "{bad json}"), (e) => {
        events.push(e);
        if (e.kind === "error") resolve();
      });
    });
    const err = events.find((e) => e.kind === "error");
    expect((err?.payload as { message: string }).message).toMatch(/JSON 非法/);
  });

  it("方法名未找到 -> error", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectGrpc(baseGrpc("NoSuchMethod", "{}"), (e) => {
        events.push(e);
        if (e.kind === "error") resolve();
      });
    });
    const err = events.find((e) => e.kind === "error");
    expect((err?.payload as { message: string }).message).toMatch(/未找到方法/);
  });

  it("空 requestMessage 走 {} 正常发出 (一元不报错)", async () => {
    const events: DriverEvent[] = [];
    await new Promise<void>((resolve) => {
      connectGrpc(baseGrpc("SayHello", ""), (e) => {
        events.push(e);
        if (e.kind === "closed") resolve();
      });
    });
    expect(events.find((e) => e.kind === "error")).toBeUndefined();
    expect(events.find((e) => e.kind === "message")).toBeDefined();
  });
});
