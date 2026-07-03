import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as grpc from "@grpc/grpc-js";
import { load as loadProto } from "@grpc/proto-loader";

import type {
  GrpcReflectResult,
  GrpcServiceInfo,
  ProtoSource,
} from "./request-channels";

/**
 * proto-loader 的标准加载选项 (保留原始大小写, long 转字符串, enum 转字符串).
 */
const LOAD_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
} as const;

/**
 * 把 proto 来源解析为一个可加载的文件路径 (粘贴文本写入临时 .proto).
 * @param source proto 来源.
 * @returns 文件路径.
 */
async function resolveProtoPath(
  source: ProtoSource,
): Promise<{ readonly path: string; readonly cleanup: () => Promise<void> }> {
  if (source.kind === "file") {
    return { path: source.value, cleanup: async () => undefined };
  }
  const dir = await mkdtemp(join(tmpdir(), "radish-proto-"));
  const file = join(dir, "schema.proto");
  await writeFile(file, source.value, "utf8");
  // proto-loader 在 load 完成后即不再需要文件, 加载后删除临时目录避免堆积.
  return {
    path: file,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

/**
 * 加载 proto 并返回 grpc 包对象 (含服务构造器).
 * @param source proto 来源.
 * @returns grpc 包对象.
 */
export async function loadProtoObject(
  source: ProtoSource,
): Promise<grpc.GrpcObject> {
  const { path, cleanup } = await resolveProtoPath(source);
  try {
    const packageDefinition = await loadProto(path, LOAD_OPTIONS);
    return grpc.loadPackageDefinition(packageDefinition);
  } finally {
    await cleanup();
  }
}

/**
 * 判断一个 grpc 包对象成员是否为服务客户端构造器.
 * @param value 待判定值.
 * @returns 是服务构造器返回 true.
 */
function isServiceClient(
  value: unknown,
): value is grpc.ServiceClientConstructor {
  return (
    typeof value === "function" &&
    "service" in value &&
    typeof (value as { service: unknown }).service === "object"
  );
}

/**
 * 递归遍历 grpc 包对象, 收集服务与方法自省信息.
 * @param node 当前节点.
 * @param prefix 当前全限定名前缀.
 * @param out 收集容器.
 */
function collectServices(
  node: grpc.GrpcObject,
  prefix: string,
  out: GrpcServiceInfo[],
): void {
  for (const [key, value] of Object.entries(node)) {
    const qualified = prefix === "" ? key : `${prefix}.${key}`;
    if (isServiceClient(value)) {
      const definition = value.service;
      const methods = Object.entries(definition).map(([name, def]) => ({
        name,
        requestStream: def.requestStream === true,
        responseStream: def.responseStream === true,
      }));
      out.push({ name: qualified, methods });
    } else if (value !== null && typeof value === "object") {
      collectServices(value as grpc.GrpcObject, qualified, out);
    }
  }
}

/**
 * 加载 proto 并列出全部服务与方法 (失败返回 ok:false + error).
 * @param source proto 来源.
 * @returns 自省结果.
 */
export async function listServices(
  source: ProtoSource,
): Promise<GrpcReflectResult> {
  try {
    const grpcObject = await loadProtoObject(source);
    const services: GrpcServiceInfo[] = [];
    collectServices(grpcObject, "", services);
    return { ok: true, services, error: "" };
  } catch (err) {
    return {
      ok: false,
      services: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 按全限定名取服务客户端构造器 (供驱动建 client; 未找到抛错).
 * @param source proto 来源.
 * @param serviceName 服务全限定名.
 * @returns 服务客户端构造器.
 */
export async function findServiceClient(
  source: ProtoSource,
  serviceName: string,
): Promise<grpc.ServiceClientConstructor> {
  const grpcObject = await loadProtoObject(source);
  const parts = serviceName.split(".");
  let node: unknown = grpcObject;
  for (const part of parts) {
    if (node !== null && typeof node === "object" && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      throw new Error(`未找到服务: ${serviceName}`);
    }
  }
  if (!isServiceClient(node)) {
    throw new Error(`不是有效的 gRPC 服务: ${serviceName}`);
  }
  return node;
}
