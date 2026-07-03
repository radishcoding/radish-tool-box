import { describe, expect, it } from "vitest";

import { semanticDiff } from "./semantic-diff";

describe("semanticDiff", () => {
  it("键序无关, 只报真实差异", () => {
    const a = '{"name":"radish","version":1,"tags":["a","b"]}';
    const b = '{"version":2,"tags":["a","b"],"name":"radish"}';
    const changes = semanticDiff(a, b);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "change",
      pathText: "version",
      oldValue: "1",
      newValue: "2",
    });
  });

  it("大整数精度安全比较", () => {
    const changes = semanticDiff(
      '{"id":9123372036854000123}',
      '{"id":9123372036854000124}',
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe("change");
  });

  it("数值规整后等值不算差异 (2.370 == 2.37)", () => {
    expect(semanticDiff('{"p":2.370}', '{"p":2.37}')).toHaveLength(0);
  });

  it("新增与删除", () => {
    const changes = semanticDiff('{"a":1}', '{"b":1}');
    const types = changes.map((c) => c.type).sort();
    expect(types).toEqual(["create", "remove"]);
  });
});
