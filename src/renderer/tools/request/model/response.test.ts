import { describe, expect, it } from "vitest";

import {
  bytesToBase64,
  bytesToText,
  collectCookies,
  decodeBase64Chunks,
  deriveFileName,
  detectBodyKind,
  formatPretty,
  parseCookieHeader,
  injectBaseHref,
  parseSetCookieHeaders,
  singleHeaderValue,
  tryParseJson,
} from "./response";

/**
 * 把字符串编码为 base64 (测试辅助, 用 Web API).
 */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

describe("decodeBase64Chunks + bytesToText", () => {
  it("拼接多块 base64 并 UTF-8 解码 (含中文)", () => {
    const chunks = [toBase64("你好"), toBase64(", 世界")];
    expect(bytesToText(decodeBase64Chunks(chunks))).toBe("你好, 世界");
  });

  it("空块返回空串", () => {
    expect(bytesToText(decodeBase64Chunks([]))).toBe("");
  });
});

describe("formatPretty", () => {
  it("JSON content-type 格式化缩进", () => {
    expect(formatPretty('{"a":1}', "application/json; charset=utf-8")).toBe(
      '{\n  "a": 1\n}',
    );
  });

  it("非法 JSON 原样返回", () => {
    expect(formatPretty("not json", "application/json")).toBe("not json");
  });

  it("非 JSON content-type 原样返回", () => {
    expect(formatPretty("<a>1</a>", "text/html")).toBe("<a>1</a>");
  });
});

describe("detectBodyKind", () => {
  it("按 content-type 归类", () => {
    expect(detectBodyKind("application/json")).toBe("json");
    expect(detectBodyKind("text/html; charset=utf-8")).toBe("html");
    expect(detectBodyKind("image/png")).toBe("image");
    expect(detectBodyKind("text/plain")).toBe("text");
    expect(detectBodyKind("")).toBe("text");
  });
});

describe("parseSetCookieHeaders", () => {
  it("从 set-cookie 头提取 name/value", () => {
    const cookies = parseSetCookieHeaders({
      "set-cookie": ["sid=abc; Path=/", "theme=dark; Secure"],
    });
    expect(cookies).toEqual([
      { name: "sid", value: "abc" },
      { name: "theme", value: "dark" },
    ]);
  });

  it("无 set-cookie 返回空", () => {
    expect(parseSetCookieHeaders({ "content-type": "text/plain" })).toEqual([]);
  });
});

describe("bytesToBase64", () => {
  it("字节编码为 base64 (与 decode 往返一致)", () => {
    const bytes = new TextEncoder().encode("你好, world");
    const base64 = bytesToBase64(bytes);
    expect(bytesToText(decodeBase64Chunks([base64]))).toBe("你好, world");
  });

  it("空字节返回空串", () => {
    expect(bytesToBase64(new Uint8Array())).toBe("");
  });
});

describe("deriveFileName", () => {
  it("URL 末段带扩展名时直接用该文件名", () => {
    expect(deriveFileName("https://a.com/path/data.json", "text/html")).toBe(
      "data.json",
    );
  });

  it("URL 无扩展名时按 content-type 生成", () => {
    expect(deriveFileName("https://a.com/get", "application/json")).toBe(
      "response.json",
    );
    expect(deriveFileName("https://a.com/", "text/html; charset=utf-8")).toBe(
      "response.html",
    );
  });

  it("图片 content-type 用其子类型 (jpeg 归一为 jpg)", () => {
    expect(deriveFileName("https://a.com/", "image/png")).toBe("response.png");
    expect(deriveFileName("https://a.com/", "image/jpeg")).toBe("response.jpg");
  });

  it("URL 非法 (含未解析变量) 时回退 content-type", () => {
    expect(deriveFileName("https://{{host}}/get", "application/json")).toBe(
      "response.json",
    );
  });

  it("未知 content-type 回退 txt", () => {
    expect(deriveFileName("https://a.com/x", "application/octet-stream")).toBe(
      "response.txt",
    );
  });
});

describe("injectBaseHref", () => {
  it("在 <head> 内插入 base 标签", () => {
    const out = injectBaseHref(
      "<html><head><title>x</title></head></html>",
      "https://a.com/p",
    );
    expect(out).toBe(
      '<html><head><base href="https://a.com/p"><title>x</title></head></html>',
    );
  });

  it("无 head 时于 <html> 后补建 head", () => {
    const out = injectBaseHref("<html><body>x</body></html>", "https://a.com");
    expect(out).toBe(
      '<html><head><base href="https://a.com"></head><body>x</body></html>',
    );
  });

  it("片段无 html 时前置 base", () => {
    expect(injectBaseHref("<div>x</div>", "https://a.com")).toBe(
      '<base href="https://a.com"><div>x</div>',
    );
  });

  it("空 URL 原样返回", () => {
    expect(injectBaseHref("<div>x</div>", "")).toBe("<div>x</div>");
  });

  it("转义 URL 中的引号与和号", () => {
    expect(injectBaseHref("<div/>", 'https://a.com/?x=1&y="2"')).toBe(
      '<base href="https://a.com/?x=1&amp;y=&quot;2&quot;"><div/>',
    );
  });
});

describe("tryParseJson", () => {
  it("合法 JSON 对象解析成功", () => {
    expect(tryParseJson('{"a":1,"b":[true,null]}')).toEqual({
      ok: true,
      value: { a: 1, b: [true, null] },
    });
  });

  it("合法 JSON 数组解析成功", () => {
    expect(tryParseJson("[1,2,3]")).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it("非法 JSON 返回 ok:false 而不抛错", () => {
    expect(tryParseJson("<html></html>")).toEqual({ ok: false });
    expect(tryParseJson("")).toEqual({ ok: false });
  });
});

describe("parseCookieHeader", () => {
  it("解析 Cookie 请求头为名值对", () => {
    expect(parseCookieHeader("foo=bar; a=1")).toEqual([
      { name: "foo", value: "bar" },
      { name: "a", value: "1" },
    ]);
  });

  it("空串返回空", () => {
    expect(parseCookieHeader("")).toEqual([]);
  });
});

describe("collectCookies", () => {
  it("合并发送的与设置的, 各带来源标记", () => {
    const cookies = collectCookies({
      setCookie: ["theme=dark; Secure"],
      sent: "foo=bar",
    });
    expect(cookies).toEqual([
      { name: "foo", value: "bar", source: "sent" },
      { name: "theme", value: "dark", source: "set" },
    ]);
  });

  it("同名时以设置的为准 (覆盖发送的)", () => {
    const cookies = collectCookies({
      setCookie: ["foo=new; Path=/"],
      sent: "foo=old",
    });
    expect(cookies).toEqual([{ name: "foo", value: "new", source: "set" }]);
  });

  it("仅发送无设置时只显示发送的 (对应访问 /cookies 场景)", () => {
    const cookies = collectCookies({ setCookie: [], sent: "foo=bar" });
    expect(cookies).toEqual([{ name: "foo", value: "bar", source: "sent" }]);
  });
});

describe("singleHeaderValue", () => {
  it("数组取首个, undefined 取空串", () => {
    expect(singleHeaderValue(["a", "b"])).toBe("a");
    expect(singleHeaderValue("x")).toBe("x");
    expect(singleHeaderValue(undefined)).toBe("");
  });
});
