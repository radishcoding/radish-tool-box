import { ipcMain } from "electron";

import { resolveConnectionConfig } from "./connection-resolve";
import { CookieJar } from "./cookie-jar";
import { listServices } from "./grpc-proto";
import { connectGrpc } from "./grpc-driver";
import { connectMqtt } from "./mqtt-driver";
import { runJob } from "./pipeline";
import { connectSocketIo } from "./socketio-driver";
import { connectSse } from "./sse-driver";
import { connectTcp } from "./tcp-driver";
import { connectWs } from "./ws-driver";
import {
  REQUEST_CHANNEL,
  type ConnectJob,
  type ConnectionConfig,
  type DriverEvent,
  type ExecuteJob,
  type GrpcReflectResult,
  type OutboundMessage,
  type Protocol,
  type ProtoSource,
  type StreamEvent,
} from "./request-channels";

/**
 * 可向渲染层发送消息的目标 (便于测试用假对象替身).
 */
export interface EventSender {
  send(channel: string, payload: unknown): void;
}

/**
 * 进程级共享 Cookie Jar (按窗口生命周期, 本阶段单例足够).
 */
const sharedJar = new CookieJar();

/**
 * 执行一个作业, 把流式事件经 sender 回传, 并在作业表中登记/清理 AbortController.
 * @param job 执行作业.
 * @param sender 事件发送目标.
 * @param jobs 进行中的作业表 (jobId -> AbortController).
 */
export async function runJobToSender(
  job: ExecuteJob,
  sender: EventSender,
  jobs: Map<string, AbortController>,
): Promise<void> {
  const controller = new AbortController();
  jobs.set(job.jobId, controller);
  try {
    await runJob(
      job,
      sharedJar,
      (event: StreamEvent) => sender.send(REQUEST_CHANNEL.EVENT, event),
      controller.signal,
    );
  } finally {
    jobs.delete(job.jobId);
  }
}

/**
 * 一个存活连接的句柄.
 */
export interface ConnectionHandle {
  send(message: OutboundMessage): void;
  close(): void;
}

/**
 * 连接器: 由配置与事件回调建立连接, 返回句柄.
 */
export type Connector = (
  config: ConnectionConfig,
  onEvent: (event: DriverEvent) => void,
) => ConnectionHandle;

/**
 * 协议到连接器的注册表 (由各驱动任务注入).
 */
const connectors: Partial<Record<Protocol, Connector>> = {};

/**
 * 注册一组连接器 (合并到全局注册表).
 * @param next 协议到连接器的映射.
 */
export function registerConnectors(
  next: Partial<Record<Protocol, Connector>>,
): void {
  Object.assign(connectors, next);
}

/**
 * 建立一个连接, 把事件经 sender 回传, 句柄登记到连接表.
 * @param job 连接作业.
 * @param sender 事件发送目标.
 * @param connections 存活连接表 (jobId -> 句柄).
 */
export function connectToSender(
  job: ConnectJob,
  sender: EventSender,
  connections: Map<string, ConnectionHandle>,
): void {
  const resolved = resolveConnectionConfig(job.config, job.variableScopes);
  const connector = connectors[resolved.protocol];
  if (connector === undefined) {
    const errorEvent: StreamEvent = {
      jobId: job.jobId,
      kind: "error",
      payload: { message: `不支持的协议: ${resolved.protocol}` },
    };
    sender.send(REQUEST_CHANNEL.EVENT, errorEvent);
    return;
  }
  const handle = connector(resolved, (event: DriverEvent) => {
    sender.send(REQUEST_CHANNEL.EVENT, { ...event, jobId: job.jobId });
    if (event.kind === "closed" || event.kind === "error") {
      connections.delete(job.jobId);
    }
  });
  connections.set(job.jobId, handle);
}

/**
 * 注册请求调试相关的全部 IPC 处理器, 整个应用仅需调用一次.
 */
export function registerNetworkIpcHandlers(): void {
  registerConnectors({
    websocket: connectWs,
    sse: connectSse,
    socketio: connectSocketIo,
    tcp: connectTcp,
    mqtt: connectMqtt,
    grpc: connectGrpc,
  });
  const jobs = new Map<string, AbortController>();
  ipcMain.handle(REQUEST_CHANNEL.EXECUTE, (event, job: ExecuteJob) =>
    runJobToSender(job, event.sender, jobs),
  );
  ipcMain.on(REQUEST_CHANNEL.CANCEL, (_event, jobId: string) => {
    jobs.get(jobId)?.abort();
    jobs.delete(jobId);
  });

  const connections = new Map<string, ConnectionHandle>();
  ipcMain.on(REQUEST_CHANNEL.CONNECT, (event, job: ConnectJob) => {
    connectToSender(job, event.sender, connections);
  });
  ipcMain.on(
    REQUEST_CHANNEL.SEND,
    (_event, jobId: string, message: OutboundMessage) => {
      connections.get(jobId)?.send(message);
    },
  );
  ipcMain.on(REQUEST_CHANNEL.DISCONNECT, (_event, jobId: string) => {
    connections.get(jobId)?.close();
    connections.delete(jobId);
  });

  ipcMain.handle(
    REQUEST_CHANNEL.GRPC_REFLECT,
    (_event, source: ProtoSource): Promise<GrpcReflectResult> =>
      listServices(source),
  );
}
