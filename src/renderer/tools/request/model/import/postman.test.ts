import { describe, expect, it } from "vitest";

import { parsePostman } from "./postman";

const collection = JSON.stringify({
  info: { name: "我的集合" },
  variable: [{ key: "base", value: "https://api.test.com" }],
  item: [
    {
      name: "用户",
      item: [
        {
          name: "登录",
          request: {
            method: "POST",
            url: { raw: "{{base}}/login", host: ["{{base}}"], path: ["login"] },
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: '{"u":"a"}' },
            auth: { type: "bearer", bearer: [{ key: "token", value: "T" }] },
          },
        },
      ],
    },
    {
      name: "健康检查",
      request: { method: "GET", url: "{{base}}/health" },
    },
  ],
});

describe("parsePostman", () => {
  it("名称/变量/树/请求映射", () => {
    const col = parsePostman(collection);
    expect(col.name).toBe("我的集合");
    expect(col.variables.find((v) => v.key === "base")?.value).toBe(
      "https://api.test.com",
    );
    expect(col.nodes).toHaveLength(2);
    const folder = col.nodes[0];
    expect(folder.type).toBe("folder");
    if (folder.type === "folder") {
      const login = folder.children[0];
      expect(login.type).toBe("request");
      if (login.type === "request") {
        expect(login.request.method).toBe("POST");
        expect(login.request.url).toBe("{{base}}/login");
        expect(login.request.auth.type).toBe("bearer");
        expect(
          login.request.body.type === "raw" && login.request.body.text,
        ).toBe('{"u":"a"}');
      }
    }
  });

  it("非法 JSON 抛错", () => {
    expect(() => parsePostman("x")).toThrow();
  });
});
