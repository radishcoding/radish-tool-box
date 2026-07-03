import { describe, expect, it } from "vitest";

import { CHARSETS, findCharset } from "./charsets";

describe("字符集注册表", () => {
  it("id 唯一且 label 非空", () => {
    const ids = CHARSETS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHARSETS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.group.length).toBeGreaterThan(0);
    }
  });

  it("codepage 型必带 codepage 号, unicode 型必带 unicode 变体", () => {
    for (const c of CHARSETS) {
      if (c.kind === "codepage") {
        expect(typeof c.codepage).toBe("number");
      } else {
        expect(c.unicode).toBeDefined();
      }
    }
  });

  it("包含核心字符集", () => {
    for (const id of [
      "utf-8",
      "utf-16le",
      "gbk",
      "gb18030",
      "big5",
      "shift_jis",
      "euc-kr",
    ]) {
      expect(findCharset(id)?.id).toBe(id);
    }
  });
});
