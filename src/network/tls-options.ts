import { readFile } from "node:fs/promises";

import type { RequestSettings } from "./request-channels";

/**
 * 由请求设置构建的 TLS 连接选项.
 */
export interface TlsOptions {
  readonly rejectUnauthorized: boolean;
  readonly ca?: Buffer;
  readonly cert?: Buffer;
  readonly key?: Buffer;
  readonly passphrase?: string;
  readonly minVersion?: string;
  readonly maxVersion?: string;
  readonly servername?: string;
}

/**
 * 把逐请求设置映射为 tls.connect/https.request 可用的选项.
 * 会读取自定义 CA 与客户端证书文件内容.
 * @param settings 逐请求设置.
 * @returns TLS 选项.
 */
export async function buildTlsOptions(
  settings: RequestSettings,
): Promise<TlsOptions> {
  const ca = settings.customCaPath
    ? await readFile(settings.customCaPath)
    : undefined;
  // 客户端证书与私钥并行读取, 只判断一次 clientCert.
  const [cert, key] = settings.clientCert
    ? await Promise.all([
        readFile(settings.clientCert.certPath),
        readFile(settings.clientCert.keyPath),
      ])
    : [undefined, undefined];
  return {
    rejectUnauthorized: settings.sslVerify,
    ca,
    cert,
    key,
    passphrase: settings.clientCert?.passphrase,
    minVersion: settings.tlsMinVersion,
    maxVersion: settings.tlsMaxVersion,
    servername: settings.sni,
  };
}
