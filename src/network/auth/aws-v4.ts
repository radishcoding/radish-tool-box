import { createHash, createHmac } from "node:crypto";

import type { AuthConfig, KeyValueItem } from "../request-channels";

/**
 * awsv4 鉴权配置.
 */
type AwsV4Auth = Extract<AuthConfig, { type: "awsv4" }>;

/**
 * 计算 SHA256 的十六进制摘要.
 * @param data 输入.
 * @returns 十六进制摘要.
 */
function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * 计算 HMAC-SHA256 原始字节.
 * @param key 密钥.
 * @param data 数据.
 * @returns HMAC 字节.
 */
function hmac(key: Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * 按 AWS SigV4 派生签名密钥.
 * @param secret 密钥.
 * @param date 日期 (yyyymmdd).
 * @param region 区域.
 * @param service 服务.
 * @returns 签名密钥字节.
 */
function signingKey(
  secret: string,
  date: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, "utf8"), date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * 构造一个启用的键值头.
 * @param key 头名.
 * @param value 头值.
 * @returns 键值项.
 */
function header(key: string, value: string): KeyValueItem {
  return { id: `aws-${key}`, key, value, enabled: true };
}

/**
 * 对请求做 AWS Signature V4 签名, 返回应附加的头.
 * 本阶段签名 host 与 x-amz-date (匹配 AWS get-vanilla 向量).
 * @param input 方法/URL/体/鉴权/amzDate.
 * @returns 应附加的头 (Authorization, x-amz-date, 可选 x-amz-security-token).
 */
export function signAwsV4(input: {
  method: string;
  url: string;
  body: Buffer;
  auth: AwsV4Auth;
  amzDate: string;
}): { readonly headers: readonly KeyValueItem[] } {
  const { method, url, body, auth, amzDate } = input;
  const parsed = new URL(url);
  const date = amzDate.slice(0, 8);
  const host = parsed.host;
  const canonicalUri = parsed.pathname === "" ? "/" : parsed.pathname;
  const canonicalQuery = [...parsed.searchParams.entries()]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&");
  const payloadHash = sha256Hex(body);
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${date}/${auth.region}/${auth.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const key = signingKey(auth.secretAccessKey, date, auth.region, auth.service);
  const signature = createHmac("sha256", key)
    .update(stringToSign, "utf8")
    .digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${auth.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers: KeyValueItem[] = [
    header("x-amz-date", amzDate),
    header("Authorization", authorization),
  ];
  if (auth.sessionToken !== "") {
    headers.push(header("x-amz-security-token", auth.sessionToken));
  }
  return { headers };
}
