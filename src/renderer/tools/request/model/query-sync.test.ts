import { describe, expect, it } from "vitest";

import type { KeyValueItem } from "../../../../network/request-channels";
import { applyParamsToUrl, parseQueryToParams } from "./query-sync";

const item = (
  key: string,
  value: string,
  enabled = true,
  id = key,
): KeyValueItem => ({ id, key, value, enabled });

describe("parseQueryToParams", () => {
  it("从 URL 查询串解析出启用参数", () => {
    const params = parseQueryToParams("https://x.com/get?a=1&b=2", []);
    expect(params.map((p) => [p.key, p.value, p.enabled])).toEqual([
      ["a", "1", true],
      ["b", "2", true],
    ]);
  });

  it("无查询串返回空 (不含旧禁用项时)", () => {
    expect(parseQueryToParams("https://x.com/get", [])).toHaveLength(0);
  });

  it("保留上一份的禁用项, 并复用同名 id", () => {
    const prev = [
      item("a", "old", true, "id-a"),
      item("z", "9", false, "id-z"),
    ];
    const params = parseQueryToParams("https://x.com?a=1", prev);
    // a 复用旧 id; 禁用的 z 保留在末尾.
    expect(params[0]).toMatchObject({ key: "a", value: "1", id: "id-a" });
    expect(params[1]).toMatchObject({ key: "z", enabled: false });
  });

  it("解码值并保留 {{var}}", () => {
    const params = parseQueryToParams("https://x.com?q=a%20b&t={{tok}}", []);
    expect(params[0].value).toBe("a b");
    expect(params[1].value).toBe("{{tok}}");
  });
});

describe("applyParamsToUrl", () => {
  it("用启用参数重建查询串, 跳过禁用与空键", () => {
    const url = applyParamsToUrl("https://x.com/get?old=1", [
      item("a", "1"),
      item("b", "2", false),
      item("", "x"),
      item("c", "3"),
    ]);
    expect(url).toBe("https://x.com/get?a=1&c=3");
  });

  it("无启用参数时去掉查询串", () => {
    expect(applyParamsToUrl("https://x.com/get?a=1", [])).toBe(
      "https://x.com/get",
    );
  });

  it("保留片段并保留 {{var}}", () => {
    const url = applyParamsToUrl("https://x.com/p?x=1#frag", [
      item("t", "{{tok}}"),
    ]);
    expect(url).toBe("https://x.com/p?t={{tok}}#frag");
  });

  it("与 parseQueryToParams 往返一致", () => {
    const original = "https://x.com/api?a=1&b=2";
    const params = parseQueryToParams(original, []);
    expect(applyParamsToUrl(original, params)).toBe(original);
  });
});
