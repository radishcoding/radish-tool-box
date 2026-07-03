import { describe, expect, it } from "vitest";

import { parseHar } from "./har";

const har = JSON.stringify({
  log: {
    entries: [
      {
        request: {
          method: "POST",
          url: "https://api.test.com/login?a=1",
          headers: [{ name: "Content-Type", value: "application/json" }],
          postData: { mimeType: "application/json", text: '{"u":"x"}' },
        },
      },
      {
        request: { method: "GET", url: "https://api.test.com/me", headers: [] },
      },
    ],
  },
});

describe("parseHar", () => {
  it("每个 entry 转为一个请求节点", () => {
    const col = parseHar(har);
    expect(col.nodes).toHaveLength(2);
    const first = col.nodes[0];
    expect(first.type).toBe("request");
    if (first.type === "request") {
      expect(first.request.method).toBe("POST");
      expect(first.request.body.type === "raw" && first.request.body.text).toBe(
        '{"u":"x"}',
      );
      expect(first.request.headers[0].key).toBe("Content-Type");
    }
  });

  it("非法 JSON 抛错", () => {
    expect(() => parseHar("not json")).toThrow();
  });
});
