/**
 * 断言失败时抛出的错误.
 */
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

/**
 * 链式断言接口 (chai 子集).
 */
export interface ExpectChain {
  readonly to: ExpectChain;
  readonly be: ExpectChain;
  readonly been: ExpectChain;
  readonly is: ExpectChain;
  readonly that: ExpectChain;
  readonly has: ExpectChain;
  readonly have: ExpectChain;
  readonly and: ExpectChain;
  readonly not: ExpectChain;
  readonly true: void;
  readonly false: void;
  readonly null: void;
  readonly undefined: void;
  readonly ok: void;
  equal(expected: unknown): void;
  eql(expected: unknown): void;
  above(n: number): void;
  below(n: number): void;
  include(part: unknown): void;
  lengthOf(n: number): void;
  oneOf(list: readonly unknown[]): void;
  a(type: string): void;
  an(type: string): void;
  property(name: string, value?: unknown): void;
}

/**
 * 把值格式化为可读字符串 (用于断言信息).
 * @param value 任意值.
 * @returns 字符串.
 */
function fmt(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * 判定值的类型名 (与 chai 一致: 区分 null 与 array).
 * @param value 任意值.
 * @returns 类型名 (null / array / object / string / number ...).
 */
function typeName(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

/**
 * 深比较两个值.
 * @param a 左值.
 * @param b 右值.
 * @returns 相等返回 true.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const ak = Object.keys(a as Record<string, unknown>);
  const bk = Object.keys(b as Record<string, unknown>);
  if (ak.length !== bk.length) {
    return false;
  }
  return ak.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

/**
 * 构造链式断言.
 * @param actual 被断言的值.
 * @param negate 是否取反.
 * @returns 链式断言对象.
 */
export function makeExpect(actual: unknown, negate = false): ExpectChain {
  const check = (pass: boolean, message: string): void => {
    if (pass === negate) {
      throw new AssertionError(negate ? `期望不满足: ${message}` : message);
    }
  };
  const self = (): ExpectChain => makeExpect(actual, negate);
  const chain: ExpectChain = {
    get to() {
      return self();
    },
    get be() {
      return self();
    },
    get been() {
      return self();
    },
    get is() {
      return self();
    },
    get that() {
      return self();
    },
    get has() {
      return self();
    },
    get have() {
      return self();
    },
    get and() {
      return self();
    },
    get not() {
      return makeExpect(actual, !negate);
    },
    get true(): void {
      check(actual === true, `期望 ${fmt(actual)} 为 true`);
      return;
    },
    get false(): void {
      check(actual === false, `期望 ${fmt(actual)} 为 false`);
      return;
    },
    get null(): void {
      check(actual === null, `期望 ${fmt(actual)} 为 null`);
      return;
    },
    get undefined(): void {
      check(actual === undefined, `期望 ${fmt(actual)} 为 undefined`);
      return;
    },
    get ok(): void {
      check(Boolean(actual), `期望 ${fmt(actual)} 为真值`);
      return;
    },
    equal(expected) {
      check(actual === expected, `期望 ${fmt(actual)} 等于 ${fmt(expected)}`);
    },
    eql(expected) {
      check(
        deepEqual(actual, expected),
        `期望 ${fmt(actual)} 深等于 ${fmt(expected)}`,
      );
    },
    above(n) {
      check(
        typeof actual === "number" && actual > n,
        `期望 ${fmt(actual)} 大于 ${n}`,
      );
    },
    below(n) {
      check(
        typeof actual === "number" && actual < n,
        `期望 ${fmt(actual)} 小于 ${n}`,
      );
    },
    include(part) {
      const ok =
        (typeof actual === "string" && actual.includes(String(part))) ||
        (Array.isArray(actual) && actual.includes(part));
      check(ok, `期望 ${fmt(actual)} 包含 ${fmt(part)}`);
    },
    lengthOf(n) {
      const len = (actual as { length?: number } | null)?.length;
      check(len === n, `期望长度为 ${n}, 实际为 ${fmt(len)}`);
    },
    oneOf(list) {
      check(list.includes(actual), `期望 ${fmt(actual)} 属于 ${fmt(list)}`);
    },
    a(type) {
      check(
        typeName(actual) === type,
        `期望类型为 ${type}, 实际为 ${typeName(actual)}`,
      );
    },
    an(type) {
      check(
        typeName(actual) === type,
        `期望类型为 ${type}, 实际为 ${typeName(actual)}`,
      );
    },
    property(name, value) {
      const obj = actual as Record<string, unknown> | null;
      const has = obj !== null && typeof obj === "object" && name in obj;
      if (value === undefined) {
        check(has, `期望含属性 ${name}`);
        return;
      }
      check(
        has && obj?.[name] === value,
        `期望属性 ${name} 等于 ${fmt(value)}`,
      );
    },
  };
  return chain;
}
