// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { RequestSettings } from "./request-channels";
import { buildTlsOptions } from "./tls-options";

const base: RequestSettings = {
  followRedirects: true,
  maxRedirects: 5,
  timeoutMs: 30000,
  sslVerify: true,
};

describe("buildTlsOptions", () => {
  it("sslVerify=false 时 rejectUnauthorized 为 false", async () => {
    const opts = await buildTlsOptions({ ...base, sslVerify: false });
    expect(opts.rejectUnauthorized).toBe(false);
  });

  it("透传 TLS 版本与 SNI", async () => {
    const opts = await buildTlsOptions({
      ...base,
      tlsMinVersion: "TLSv1.2",
      tlsMaxVersion: "TLSv1.3",
      sni: "example.com",
    });
    expect(opts.minVersion).toBe("TLSv1.2");
    expect(opts.maxVersion).toBe("TLSv1.3");
    expect(opts.servername).toBe("example.com");
  });

  it("读取自定义 CA 文件内容", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tls-"));
    const caPath = join(dir, "ca.pem");
    writeFileSync(caPath, "CA-CONTENT");
    const opts = await buildTlsOptions({ ...base, customCaPath: caPath });
    expect(opts.ca?.toString()).toBe("CA-CONTENT");
  });
});
