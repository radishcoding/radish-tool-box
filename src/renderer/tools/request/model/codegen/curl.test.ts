import { describe, expect, it } from "vitest";

import { buildRequest, item } from "../import/types";
import { generateCurl } from "./curl";

describe("generateCurl", () => {
  it("方法/URL/头/raw 体", () => {
    const out = generateCurl(
      buildRequest({
        method: "POST",
        url: "https://x.com/a",
        headers: [item("Content-Type", "application/json")],
        body: { type: "raw", rawType: "json", text: '{"a":1}' },
      }),
    );
    expect(out).toContain("curl -X POST 'https://x.com/a'");
    expect(out).toContain("-H 'Content-Type: application/json'");
    expect(out).toContain(`--data '{"a":1}'`);
  });

  it("启用的 query 参数并入 URL", () => {
    const out = generateCurl(
      buildRequest({ url: "https://x.com", params: [item("q", "1")] }),
    );
    expect(out).toContain("https://x.com?q=1");
  });

  it("basic 鉴权生成 -u, 禁用头跳过", () => {
    const out = generateCurl(
      buildRequest({
        url: "https://x.com",
        auth: { type: "basic", username: "u", password: "p" },
        headers: [{ id: "1", key: "X", value: "v", enabled: false }],
      }),
    );
    expect(out).toContain("-u 'u:p'");
    expect(out).not.toContain("-H 'X: v'");
  });

  it("urlencoded 体", () => {
    const out = generateCurl(
      buildRequest({
        method: "POST",
        url: "https://x.com",
        body: { type: "urlencoded", items: [item("a", "b")] },
      }),
    );
    expect(out).toContain("--data 'a=b'");
  });
});
