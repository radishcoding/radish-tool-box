// @vitest-environment node
import { describe, expect, it } from "vitest";

import { computeDigestHeader, generateCnonce, parseChallenge } from "./digest";

describe("parseChallenge", () => {
  it("解析 WWW-Authenticate 中的 Digest 参数", () => {
    const c = parseChallenge(
      'Digest realm="testrealm@host.com", qop="auth,auth-int", ' +
        'nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", ' +
        'opaque="5ccc069c403ebaf9f0171e9517f40e41"',
    );
    expect(c?.realm).toBe("testrealm@host.com");
    expect(c?.nonce).toBe("dcd98b7102dd2f0e8b11d0f600bfb0c093");
    expect(c?.qop).toBe("auth,auth-int");
    expect(c?.opaque).toBe("5ccc069c403ebaf9f0171e9517f40e41");
  });

  it("非 Digest 方案返回 undefined", () => {
    expect(parseChallenge('Basic realm="x"')).toBeUndefined();
  });
});

describe("computeDigestHeader (RFC 2617 向量)", () => {
  it("qop=auth 产出官方 response", () => {
    const header = computeDigestHeader({
      username: "Mufasa",
      password: "Circle Of Life",
      method: "GET",
      uri: "/dir/index.html",
      cnonce: "0a4f113b",
      nc: "00000001",
      challenge: {
        realm: "testrealm@host.com",
        nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093",
        qop: "auth",
        opaque: "5ccc069c403ebaf9f0171e9517f40e41",
      },
    });
    expect(header).toContain('response="6629fae49393a05397450978507c4ef1"');
    expect(header).toContain('username="Mufasa"');
    expect(header).toContain("qop=auth");
    expect(header).toContain("nc=00000001");
    expect(header).toContain('cnonce="0a4f113b"');
    expect(header).toContain('opaque="5ccc069c403ebaf9f0171e9517f40e41"');
  });
});

describe("generateCnonce", () => {
  it("产出非空十六进制串", () => {
    expect(generateCnonce()).toMatch(/^[0-9a-f]+$/);
  });
});
