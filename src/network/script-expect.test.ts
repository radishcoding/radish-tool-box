// @vitest-environment node
import { describe, expect, it } from "vitest";

import { AssertionError, makeExpect } from "./script-expect";

describe("makeExpect", () => {
  it("equal 通过与失败", () => {
    expect(() => makeExpect(1).to.equal(1)).not.toThrow();
    expect(() => makeExpect(1).to.equal(2)).toThrow(AssertionError);
  });

  it("eql 深比较", () => {
    expect(() => makeExpect({ a: 1 }).to.eql({ a: 1 })).not.toThrow();
    expect(() => makeExpect({ a: 1 }).to.eql({ a: 2 })).toThrow();
  });

  it("be.true / be.false / be.ok", () => {
    expect(() => makeExpect(true).to.be.true).not.toThrow();
    expect(() => makeExpect(false).to.be.true).toThrow();
    expect(() => makeExpect(1).to.be.ok).not.toThrow();
  });

  it("include / above / below / lengthOf", () => {
    expect(() => makeExpect("hello").to.include("ell")).not.toThrow();
    expect(() => makeExpect([1, 2, 3]).to.include(2)).not.toThrow();
    expect(() => makeExpect(5).to.be.above(3)).not.toThrow();
    expect(() => makeExpect(5).to.be.below(3)).toThrow();
    expect(() => makeExpect([1, 2]).to.have.lengthOf(2)).not.toThrow();
  });

  it("oneOf / a / property", () => {
    expect(() => makeExpect("b").to.be.oneOf(["a", "b"])).not.toThrow();
    expect(() => makeExpect(1).to.be.a("number")).not.toThrow();
    expect(() => makeExpect({ x: 1 }).to.have.property("x")).not.toThrow();
    expect(() => makeExpect({ x: 1 }).to.have.property("x", 1)).not.toThrow();
    expect(() => makeExpect({ x: 1 }).to.have.property("x", 2)).toThrow();
  });

  it("an 是 a 的别名, 且区分 array/null/object", () => {
    expect(() => makeExpect({ a: 1 }).to.be.an("object")).not.toThrow();
    expect(() => makeExpect([1]).to.be.an("array")).not.toThrow();
    expect(() => makeExpect(null).to.be.an("null")).not.toThrow();
    // 数组不是 object (与 chai 一致).
    expect(() => makeExpect([1]).to.be.an("object")).toThrow();
    // null 不是 object.
    expect(() => makeExpect(null).to.be.a("object")).toThrow();
    expect(() => makeExpect("s").to.not.be.an("object")).not.toThrow();
  });

  it("not 取反", () => {
    expect(() => makeExpect(1).to.not.equal(2)).not.toThrow();
    expect(() => makeExpect(1).to.not.equal(1)).toThrow();
    expect(() => makeExpect(false).to.not.be.true).not.toThrow();
  });
});

// ── 断言失败 message 内容校验 ──────────────────────────────────────────────────
describe("makeExpect 失败 message 有意义", () => {
  it("equal: message 含实际值与期望值", () => {
    expect(() => makeExpect(42).to.equal(99)).toThrow(/42/);
    expect(() => makeExpect(42).to.equal(99)).toThrow(/99/);
  });

  it("eql: message 含 '深等于'", () => {
    expect(() => makeExpect({ a: 1 }).to.eql({ a: 2 })).toThrow(/深等于/);
  });

  it("above: message 含 '大于'", () => {
    expect(() => makeExpect(1).to.be.above(5)).toThrow(/大于/);
  });

  it("include: message 含 '包含'", () => {
    expect(() => makeExpect("hello").to.include("xyz")).toThrow(/包含/);
  });

  it("a(type): message 含类型文本", () => {
    expect(() => makeExpect("str").to.be.a("number")).toThrow(/number/);
  });

  it("property: message 含属性名", () => {
    expect(() => makeExpect({}).to.have.property("missing")).toThrow(/missing/);
  });

  it("property 含值时 message 含期望值", () => {
    expect(() => makeExpect({ x: 1 }).to.have.property("x", 99)).toThrow(/99/);
  });

  it("not.equal: message 含 '期望不满足'", () => {
    expect(() => makeExpect(1).to.not.equal(1)).toThrow(/期望不满足/);
  });

  it("not.include: message 含 '期望不满足'", () => {
    expect(() => makeExpect("hello").to.not.include("ell")).toThrow(
      /期望不满足/,
    );
  });
});
