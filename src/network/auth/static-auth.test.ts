// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AuthConfig } from "../request-channels";
import { applyStaticAuth } from "./static-auth";

describe("applyStaticAuth", () => {
  it("basic 生成 base64 的 Authorization 头", () => {
    const auth: AuthConfig = {
      type: "basic",
      username: "Aladdin",
      password: "open sesame",
    };
    const add = applyStaticAuth(auth);
    expect(add.headers[0].key).toBe("Authorization");
    expect(add.headers[0].value).toBe("Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
    expect(add.queryParams).toHaveLength(0);
  });

  it("bearer 生成 Bearer 头", () => {
    const add = applyStaticAuth({ type: "bearer", token: "abc.def" });
    expect(add.headers[0].value).toBe("Bearer abc.def");
  });

  it("apikey 加到 header", () => {
    const add = applyStaticAuth({
      type: "apikey",
      key: "X-Api-Key",
      value: "k123",
      addTo: "header",
    });
    expect(add.headers[0]).toMatchObject({ key: "X-Api-Key", value: "k123" });
    expect(add.queryParams).toHaveLength(0);
  });

  it("apikey 加到 query", () => {
    const add = applyStaticAuth({
      type: "apikey",
      key: "api_key",
      value: "k123",
      addTo: "query",
    });
    expect(add.queryParams[0]).toMatchObject({ key: "api_key", value: "k123" });
    expect(add.headers).toHaveLength(0);
  });

  it("none 返回空", () => {
    const add = applyStaticAuth({ type: "none" });
    expect(add.headers).toHaveLength(0);
    expect(add.queryParams).toHaveLength(0);
  });
});
