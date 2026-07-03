import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import type { BodyConfig, FormDataItem, RawType } from "./request-channels";

/**
 * 序列化后的请求体与对应 content-type.
 */
export interface SerializedBody {
  readonly body?: Buffer;
  readonly contentType?: string;
}

/**
 * raw 子类型到 content-type 的映射.
 */
const RAW_CONTENT_TYPE: Readonly<Record<RawType, string>> = {
  json: "application/json",
  xml: "application/xml",
  text: "text/plain",
  html: "text/html",
  javascript: "application/javascript",
};

/**
 * 生成 multipart 边界串.
 * @returns 边界串.
 */
export function generateBoundary(): string {
  return `----RadishFormBoundary${randomBytes(12).toString("hex")}`;
}

/**
 * 解析 graphql 变量文本为对象 (空串视为空对象).
 * @param text 变量 JSON 文本.
 * @returns 变量对象.
 * @throws Error JSON 非法时.
 */
function parseGraphqlVariables(text: string): unknown {
  return text.trim() === "" ? {} : JSON.parse(text);
}

/**
 * 转义 multipart Content-Disposition 中 name/filename 字段值.
 *
 * 去除 CR/LF (防止头注入), 将双引号替换为 %22 (防止破坏引号边界).
 * @param value 原始字段值.
 * @returns 转义后的值.
 */
function escapeFormName(value: string): string {
  return value.replace(/[\r\n]/g, "").replace(/"/g, "%22");
}

/**
 * 拼接 multipart/form-data 体.
 * @param items 表单项.
 * @param boundary 边界串.
 * @returns multipart 字节.
 */
async function serializeFormData(
  items: readonly FormDataItem[],
  boundary: string,
): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const item of items) {
    if (!item.enabled || item.key === "") {
      continue;
    }
    if (item.kind === "file") {
      const content = await readFile(item.value);
      const filename = item.filename ?? basename(item.value);
      const contentType = item.contentType ?? "application/octet-stream";
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${escapeFormName(item.key)}"; ` +
            `filename="${escapeFormName(filename)}"\r\nContent-Type: ${contentType}\r\n\r\n`,
          "utf8",
        ),
        content,
        Buffer.from("\r\n", "utf8"),
      );
    } else {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${escapeFormName(item.key)}"\r\n\r\n` +
            `${item.value}\r\n`,
          "utf8",
        ),
      );
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  return Buffer.concat(parts);
}

/**
 * 把请求体配置序列化为字节与 content-type.
 * @param body 请求体配置.
 * @param boundary multipart 边界 (默认随机生成; 测试可注入).
 * @returns 序列化结果.
 */
export async function serializeBody(
  body: BodyConfig,
  boundary: string = generateBoundary(),
): Promise<SerializedBody> {
  switch (body.type) {
    case "none":
      return {};
    case "raw":
      return {
        body: Buffer.from(body.text, "utf8"),
        contentType: RAW_CONTENT_TYPE[body.rawType],
      };
    case "graphql":
      return {
        body: Buffer.from(
          JSON.stringify({
            query: body.query,
            variables: parseGraphqlVariables(body.variables),
          }),
          "utf8",
        ),
        contentType: "application/json",
      };
    case "urlencoded": {
      const encoded = body.items
        .filter((item) => item.enabled && item.key !== "")
        .map(
          (item) =>
            `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`,
        )
        .join("&");
      return {
        body: Buffer.from(encoded, "utf8"),
        contentType: "application/x-www-form-urlencoded",
      };
    }
    case "binary":
      return {
        body: await readFile(body.filePath),
        contentType: "application/octet-stream",
      };
    case "formdata":
      return {
        body: await serializeFormData(body.items, boundary),
        contentType: `multipart/form-data; boundary=${boundary}`,
      };
    default:
      return {};
  }
}
