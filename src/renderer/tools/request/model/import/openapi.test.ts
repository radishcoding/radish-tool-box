import { describe, expect, it } from "vitest";

import type { HttpRequest } from "../types";
import { parseOpenApi } from "./openapi";

const v3 = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "宠物店" },
  servers: [{ url: "https://api.pets.com/v1" }],
  paths: {
    "/pets": {
      get: {
        tags: ["pet"],
        summary: "列出宠物",
        parameters: [{ name: "limit", in: "query" }],
      },
      post: { tags: ["pet"], summary: "新增宠物" },
    },
  },
});

const v2Yaml = `
swagger: "2.0"
info:
  title: 旧接口
host: api.old.com
basePath: /v2
schemes: [https]
paths:
  /users:
    get:
      summary: 用户列表
`;

describe("parseOpenApi", () => {
  it("3.x JSON: server + path + 方法 + 按 tag 分组", () => {
    const col = parseOpenApi(v3);
    expect(col.name).toBe("宠物店");
    const petFolder = col.nodes.find(
      (n) => n.type === "folder" && n.name === "pet",
    );
    expect(petFolder).toBeDefined();
    if (petFolder?.type === "folder") {
      expect(petFolder.children).toHaveLength(2);
      const get = petFolder.children.find(
        (c) => c.type === "request" && c.request.method === "GET",
      );
      expect(get?.type === "request" && get.request.url).toBe(
        "https://api.pets.com/v1/pets",
      );
    }
  });

  it("2.0 YAML: host+basePath+scheme 拼 URL", () => {
    const col = parseOpenApi(v2Yaml);
    const node = col.nodes[0];
    // 无 tag 时归到默认文件夹或顶层
    const req = node.type === "folder" ? node.children[0] : node;
    expect(req.type === "request" && req.request.url).toBe(
      "https://api.old.com/v2/users",
    );
  });

  it("非法内容抛错", () => {
    expect(() => parseOpenApi("::: not valid :::\n  - x")).toThrow();
  });

  const v3full = JSON.stringify({
    openapi: "3.0.3",
    info: { title: "完整" },
    servers: [{ url: "https://x.com" }],
    paths: {
      "/get": {
        get: {
          summary: "G",
          parameters: [
            { name: "q", in: "query", example: "hello" },
            { name: "X-H", in: "header", schema: { default: "hv" } },
          ],
        },
      },
      "/post": {
        post: {
          summary: "P",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/U" },
              },
            },
          },
        },
      },
      "/status/{code}": {
        get: {
          summary: "S",
          parameters: [{ name: "code", in: "path", example: 200 }],
        },
      },
      "/thing/{id}": {
        get: { summary: "T", parameters: [{ name: "id", in: "path" }] },
      },
    },
    components: {
      schemas: {
        U: {
          type: "object",
          properties: {
            name: { type: "string", example: "r" },
            ok: { type: "boolean", default: true },
          },
        },
      },
    },
  });

  /** 从默认文件夹按 summary 取请求. */
  function reqByName(json: string, name: string): HttpRequest {
    const col = parseOpenApi(json);
    const folder = col.nodes[0];
    if (folder.type !== "folder") {
      throw new Error("期望默认文件夹");
    }
    const node = folder.children.find((c) => c.name === name);
    if (node === undefined || node.type !== "request") {
      throw new Error(`未找到请求 ${name}`);
    }
    return node.request;
  }

  it("查询参数导入为启用并带示例/默认值", () => {
    const q = reqByName(v3full, "G").params[0];
    expect(q.key).toBe("q");
    expect(q.value).toBe("hello");
    expect(q.enabled).toBe(true);
  });

  it("头部参数 (in: header) 导入为请求头", () => {
    const headers = reqByName(v3full, "G").headers;
    const h = headers.find((x) => x.key === "X-H");
    expect(h?.value).toBe("hv");
    expect(h?.enabled).toBe(true);
  });

  it("requestBody 经 $ref 解析为 JSON 骨架体", () => {
    const body = reqByName(v3full, "P").body;
    expect(body.type).toBe("raw");
    if (body.type === "raw") {
      expect(body.rawType).toBe("json");
      const parsed = JSON.parse(body.text) as Record<string, unknown>;
      expect(parsed.name).toBe("r");
      expect(parsed.ok).toBe(true);
    }
  });

  it("路径参数有示例时替换, 无示例转 {{var}}", () => {
    expect(reqByName(v3full, "S").url).toBe("https://x.com/status/200");
    expect(reqByName(v3full, "T").url).toBe("https://x.com/thing/{{id}}");
  });
});
