import { describe, expect, it } from "vitest";

import { parseCurl } from "./curl";

describe("parseCurl", () => {
  it("解析方法/URL/头/数据", () => {
    const r = parseCurl(
      `curl -X POST 'https://api.test.com/login' -H 'Content-Type: application/json' -H 'X-K: v' --data '{"u":"a"}'`,
    );
    expect(r.method).toBe("POST");
    expect(r.url).toBe("https://api.test.com/login");
    expect(r.headers.find((h) => h.key === "X-K")?.value).toBe("v");
    expect(r.body.type === "raw" && r.body.text).toBe('{"u":"a"}');
  });

  it("有数据但无 -X 默认 POST", () => {
    const r = parseCurl(`curl https://x.com -d 'a=1'`);
    expect(r.method).toBe("POST");
  });

  it("纯 URL 默认 GET", () => {
    expect(parseCurl("curl https://x.com/get").method).toBe("GET");
  });

  it("-u 映射 basic 鉴权", () => {
    const r = parseCurl(`curl https://x.com -u alice:secret`);
    expect(r.auth.type === "basic" && r.auth.username).toBe("alice");
    expect(r.auth.type === "basic" && r.auth.password).toBe("secret");
  });

  it("跨行续行 (反斜杠) 与长选项", () => {
    const r = parseCurl(
      `curl --request PUT \\\n  --url https://x.com/u \\\n  --header 'A: 1'`,
    );
    expect(r.method).toBe("PUT");
    expect(r.url).toBe("https://x.com/u");
    expect(r.headers[0].key).toBe("A");
  });

  it("-F 映射 form-data", () => {
    const r = parseCurl(`curl https://x.com -F 'name=bob' -F 'file=@/p.png'`);
    expect(r.body.type).toBe("formdata");
  });
});
