import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
} from "node:http";
import { request as httpsRequest } from "node:https";

import type { ConnectionHandle } from "./network-ipc";
import type {
  ConnectionConfig,
  DriverEvent,
  KeyValueItem,
} from "./request-channels";
import { buildTlsOptions } from "./tls-options";

/**
 * 把启用的键值头组装为头对象 (附 SSE 必需的 Accept).
 * @param items 头项.
 * @returns 头对象.
 */
function sseHeaders(items: readonly KeyValueItem[]): Record<string, string> {
  const headers: Record<string, string> = { accept: "text/event-stream" };
  for (const it of items) {
    if (it.enabled && it.key !== "") {
      headers[it.key.toLowerCase()] = it.value;
    }
  }
  return headers;
}

/**
 * 解析一个 SSE 事件块 (空行分隔) 为 event 与 data.
 * @param block 事件块文本 (不含末尾空行).
 * @returns 事件名与 data; 无 data 行返回 undefined.
 */
function parseBlock(
  block: string,
): { event: string; data: string } | undefined {
  let event = "";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (dataLines.length === 0) {
    return undefined;
  }
  return { event, data: dataLines.join("\n") };
}

/**
 * 建立一个 SSE 连接 (GET 读 text/event-stream), 逐事件回传 message; 只收不发.
 * @param config 连接配置 (protocol 必为 sse).
 * @param onEvent 事件回调.
 * @returns 连接句柄 (send 为 no-op).
 */
export function connectSse(
  config: ConnectionConfig,
  onEvent: (event: DriverEvent) => void,
): ConnectionHandle {
  if (config.protocol !== "sse") {
    onEvent({ kind: "error", payload: { message: "协议不匹配" } });
    return { send: () => undefined, close: () => undefined };
  }
  const { url, headers, settings } = config.sse;
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  let aborted = false;
  let ended = false;
  let response: IncomingMessage | undefined;
  let clientRequest: ClientRequest | undefined;

  // closed 只发一次 (流结束 / 主动断开 / 任一路径), 避免 connectToSender 删表后孤儿事件.
  const emitClosed = (reason: string): void => {
    if (!ended) {
      ended = true;
      onEvent({ kind: "closed", payload: { code: 0, reason } });
    }
  };

  void (async (): Promise<void> => {
    const tls = isHttps ? await buildTlsOptions(settings) : {};
    const requestFn = isHttps ? httpsRequest : httpRequest;
    clientRequest = requestFn(
      parsed,
      { method: "GET", headers: sseHeaders(headers), ...tls },
      (res) => {
        response = res;
        const status = res.statusCode ?? 0;
        // SSE 期望 2xx + event-stream; 非 2xx 视为错误而非成功连接.
        if (status < 200 || status >= 300) {
          res.resume();
          onEvent({
            kind: "error",
            payload: { message: `SSE 响应状态 ${status}` },
          });
          emitClosed(`状态 ${status}`);
          return;
        }
        onEvent({
          kind: "open",
          payload: { info: `已连接 (${status})` },
        });
        let buffer = "";
        res.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          let idx = buffer.indexOf("\n\n");
          while (idx !== -1) {
            const block = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const parsedBlock = parseBlock(block);
            if (parsedBlock !== undefined) {
              onEvent({
                kind: "message",
                payload: { direction: "received", ...parsedBlock },
              });
            }
            idx = buffer.indexOf("\n\n");
          }
        });
        res.on("end", () => emitClosed("流结束"));
        res.on("error", (err: Error) => {
          if (!aborted) {
            onEvent({ kind: "error", payload: { message: err.message } });
            emitClosed("流错误");
          }
        });
      },
    );
    clientRequest.on("error", (err: Error) => {
      if (!aborted) {
        onEvent({ kind: "error", payload: { message: err.message } });
      }
    });
    clientRequest.end();
  })();

  return {
    send: () => undefined,
    close: () => {
      aborted = true;
      // 销毁响应流与底层请求: 响应未到达时 clientRequest.destroy 取消挂起的请求, 避免 socket 悬挂.
      response?.destroy();
      clientRequest?.destroy();
      emitClosed("已断开");
    },
  };
}
