// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CookieJar } from "./cookie-jar";

describe("CookieJar", () => {
  it("存入后同域同路径请求回传 Cookie", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://api.test.com/v1/login", ["sid=abc; Path=/"]);
    expect(jar.headerFor("https://api.test.com/v1/data")).toBe("sid=abc");
  });

  it("跨域不回传", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://a.com/", ["x=1; Path=/"]);
    expect(jar.headerFor("https://b.com/")).toBe("");
  });

  it("secure cookie 不在 http 回传", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://a.com/", ["x=1; Path=/; Secure"]);
    expect(jar.headerFor("http://a.com/")).toBe("");
    expect(jar.headerFor("https://a.com/")).toBe("x=1");
  });

  it("已过期 cookie 不回传", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://a.com/", [
      "x=1; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
    expect(jar.headerFor("https://a.com/")).toBe("");
  });

  it("同名 cookie 覆盖旧值", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://a.com/", ["x=1; Path=/"]);
    jar.setFromHeaders("https://a.com/", ["x=2; Path=/"]);
    expect(jar.headerFor("https://a.com/")).toBe("x=2");
  });

  it("多个匹配 cookie 用分号连接", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://a.com/", ["x=1; Path=/", "y=2; Path=/"]);
    expect(jar.headerFor("https://a.com/")).toBe("x=1; y=2");
  });

  it("路径前缀须对齐 / 边界, /api 不匹配 /apiv2", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://a.com/api", ["x=1; Path=/api"]);
    expect(jar.headerFor("https://a.com/apiv2/data")).toBe("");
    expect(jar.headerFor("https://a.com/api")).toBe("x=1");
    expect(jar.headerFor("https://a.com/api/users")).toBe("x=1");
  });

  it("子域请求回传父域 cookie", () => {
    const jar = new CookieJar();
    jar.setFromHeaders("https://a.com/", ["x=1; Path=/; Domain=a.com"]);
    expect(jar.headerFor("https://sub.a.com/")).toBe("x=1");
    expect(jar.headerFor("https://evil-a.com/")).toBe("");
  });

  // -------------------------------------------------------------------------
  // 用例 (9) 回归: 超域拒绝
  // -------------------------------------------------------------------------
  describe("超域拒绝 (回归)", () => {
    // 已引入公共后缀列表 (psl): Domain 为 eTLD (com / co.uk 等) 时拒绝, 防 "超级 Cookie".
    it("Domain=com (顶级公共域) 被拒绝", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.example.com/", [
        "x=bad; Path=/; Domain=com",
      ]);
      expect(jar.getAll()).toHaveLength(0);
      expect(jar.headerFor("https://a.example.com/")).toBe("");
    });

    it("Domain=co.uk (多标签公共后缀) 被拒绝", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.example.co.uk/", [
        "x=bad; Path=/; Domain=co.uk",
      ]);
      expect(jar.getAll()).toHaveLength(0);
    });

    it("Domain=example.co.uk (公共后缀下的注册域) 接受", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.example.co.uk/", [
        "x=good; Path=/; Domain=example.co.uk",
      ]);
      expect(jar.getAll()).toHaveLength(1);
      expect(jar.headerFor("https://a.example.co.uk/")).toBe("x=good");
    });

    it("Domain=localhost (恰等单标签请求主机) 接受", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("http://localhost/", [
        "x=ok; Path=/; Domain=localhost",
      ]);
      expect(jar.getAll()).toHaveLength(1);
    });

    it("Domain=other.com (不相关域) 被拒绝", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.example.com/", [
        "x=bad; Path=/; Domain=other.com",
      ]);
      expect(jar.getAll()).toHaveLength(0);
    });

    it("Domain=example.com (合法父域) 接受, 且子域可回传", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.example.com/", [
        "x=good; Path=/; Domain=example.com",
      ]);
      expect(jar.getAll()).toHaveLength(1);
      // 请求 a.example.com 应能回传
      expect(jar.headerFor("https://a.example.com/")).toBe("x=good");
      // 请求 example.com 本身也能回传
      expect(jar.headerFor("https://example.com/")).toBe("x=good");
    });

    it("Domain=a.example.com (精确匹配请求主机) 接受", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.example.com/", [
        "x=ok; Path=/; Domain=a.example.com",
      ]);
      expect(jar.getAll()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // 用例 (10) 中: Max-Age=0 立即过期 & HttpOnly 解析
  // -------------------------------------------------------------------------
  describe("Max-Age 与 HttpOnly", () => {
    it("Max-Age=0 立即过期, headerFor 不返回该 cookie", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.com/", ["x=1; Path=/; Max-Age=0"]);
      // Max-Age=0 -> expires = Date.now() + 0 * 1000 = 现在, 即刻过期
      expect(jar.headerFor("https://a.com/")).toBe("");
    });

    it("Max-Age 正值的 cookie 在未过期前可回传", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.com/", ["x=live; Path=/; Max-Age=3600"]);
      expect(jar.headerFor("https://a.com/")).toBe("x=live");
    });

    it("HttpOnly 字段被正确解析, getAll 中 httpOnly=true", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.com/", ["sid=abc; Path=/; HttpOnly"]);
      const cookies = jar.getAll();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.httpOnly).toBe(true);
    });

    it("无 HttpOnly 的 cookie httpOnly=false", () => {
      const jar = new CookieJar();
      jar.setFromHeaders("https://a.com/", ["sid=abc; Path=/"]);
      const cookies = jar.getAll();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.httpOnly).toBe(false);
    });
  });
});
