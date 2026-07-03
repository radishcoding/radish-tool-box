// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { BodyConfig } from "./request-channels";
import { serializeBody } from "./body";

describe("serializeBody", () => {
  it("none 返回空", async () => {
    expect(await serializeBody({ type: "none" })).toEqual({});
  });

  it("raw json 带 application/json", async () => {
    const r = await serializeBody({
      type: "raw",
      rawType: "json",
      text: '{"a":1}',
    });
    expect(r.contentType).toBe("application/json");
    expect(r.body?.toString()).toBe('{"a":1}');
  });

  it("urlencoded 编码并带正确 content-type", async () => {
    const body: BodyConfig = {
      type: "urlencoded",
      items: [
        { id: "1", key: "a b", value: "c&d", enabled: true },
        { id: "2", key: "skip", value: "x", enabled: false },
      ],
    };
    const r = await serializeBody(body);
    expect(r.contentType).toBe("application/x-www-form-urlencoded");
    expect(r.body?.toString()).toBe("a%20b=c%26d");
  });

  it("graphql 打包为 { query, variables }", async () => {
    const r = await serializeBody({
      type: "graphql",
      query: "{ me }",
      variables: '{"x":1}',
    });
    expect(r.contentType).toBe("application/json");
    expect(JSON.parse(r.body?.toString() ?? "")).toEqual({
      query: "{ me }",
      variables: { x: 1 },
    });
  });

  it("binary 读取文件原样为体", async () => {
    const dir = mkdtempSync(join(tmpdir(), "body-"));
    const file = join(dir, "blob.bin");
    writeFileSync(file, Buffer.from([1, 2, 3]));
    const r = await serializeBody({ type: "binary", filePath: file });
    expect([...(r.body ?? [])]).toEqual([1, 2, 3]);
    expect(r.contentType).toBe("application/octet-stream");
  });

  it("formdata name/filename 中的双引号和换行被转义", async () => {
    const r = await serializeBody(
      {
        type: "formdata",
        items: [
          {
            id: "1",
            key: 'fi"eld\r\nX',
            value: "val",
            enabled: true,
            kind: "text",
          },
        ],
      },
      "B",
    );
    const text = r.body?.toString() ?? "";
    // name= 不含裸双引号 (除边界的那对) 和换行
    const nameMatch = text.match(/name="([^"]*)"/);
    expect(nameMatch).not.toBeNull();
    expect(nameMatch![1]).not.toContain('"');
    expect(nameMatch![1]).not.toMatch(/[\r\n]/);
    // 结构完整 (包含转义后的内容)
    expect(text).toContain("fi%22eld");
  });

  it("formdata 用注入 boundary 拼 multipart (文本 + 文件)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fd-"));
    const file = join(dir, "f.txt");
    writeFileSync(file, "FILE");
    const r = await serializeBody(
      {
        type: "formdata",
        items: [
          { id: "1", key: "field", value: "val", enabled: true, kind: "text" },
          {
            id: "2",
            key: "upload",
            value: file,
            enabled: true,
            kind: "file",
            filename: "f.txt",
            contentType: "text/plain",
          },
        ],
      },
      "BOUNDARY",
    );
    expect(r.contentType).toBe("multipart/form-data; boundary=BOUNDARY");
    const text = r.body?.toString() ?? "";
    expect(text).toContain(
      '--BOUNDARY\r\nContent-Disposition: form-data; name="field"\r\n\r\nval\r\n',
    );
    expect(text).toContain('name="upload"; filename="f.txt"');
    expect(text).toContain("Content-Type: text/plain");
    expect(text).toContain("FILE");
    expect(text.endsWith("--BOUNDARY--\r\n")).toBe(true);
  });
});
