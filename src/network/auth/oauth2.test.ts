// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  bearerHeaderValue,
  buildClientCredentialsRequest,
  parseTokenResponse,
} from "./oauth2";

describe("buildClientCredentialsRequest", () => {
  it("构造 form 编码的 client_credentials 令牌请求", () => {
    const req = buildClientCredentialsRequest({
      type: "oauth2",
      grant: "client_credentials",
      accessToken: "",
      tokenUrl: "https://idp.test/token",
      clientId: "cid",
      clientSecret: "secret",
      scope: "read write",
      headerPrefix: "Bearer",
    });
    expect(req.url).toBe("https://idp.test/token");
    expect(req.contentType).toBe("application/x-www-form-urlencoded");
    expect(req.body).toContain("grant_type=client_credentials");
    expect(req.body).toContain("client_id=cid");
    expect(req.body).toContain("client_secret=secret");
    expect(req.body).toContain("scope=read+write");
  });
});

describe("parseTokenResponse", () => {
  it("取出 access_token", () => {
    expect(
      parseTokenResponse('{"access_token":"T","token_type":"Bearer"}'),
    ).toBe("T");
  });

  it("缺少 access_token 抛错", () => {
    expect(() => parseTokenResponse('{"error":"invalid"}')).toThrow();
  });
});

describe("bearerHeaderValue", () => {
  it("空前缀回退为 Bearer", () => {
    expect(bearerHeaderValue("T", "")).toBe("Bearer T");
  });

  it("自定义前缀", () => {
    expect(bearerHeaderValue("T", "Token")).toBe("Token T");
  });
});
