/**
 * 调试辅助信息的一条, 展示在面板的诊断区.
 */
export interface Diagnostic {
  readonly level: "info" | "warn" | "error";
  readonly message: string;
}

/**
 * 计算结果的判别联合: 成功带值, 失败带原因; 两者都带诊断.
 * model 层统一返回此类型, 不靠抛异常控制正常流程.
 */
export type Outcome<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly diagnostics: readonly Diagnostic[];
    };

/**
 * 构造成功结果.
 * @param value 结果值.
 * @param diagnostics 诊断信息, 缺省为空.
 */
export function ok<T>(
  value: T,
  diagnostics: readonly Diagnostic[] = [],
): Outcome<T> {
  return { ok: true, value, diagnostics };
}

/**
 * 构造失败结果.
 * @param error 失败原因 (可读文案).
 * @param diagnostics 诊断信息, 缺省为空.
 */
export function fail<T>(
  error: string,
  diagnostics: readonly Diagnostic[] = [],
): Outcome<T> {
  return { ok: false, error, diagnostics };
}

/**
 * 面板可直接渲染且可持久化的结果视图 (纯字符串, 不含二进制).
 */
export interface ResultView {
  readonly output: string;
  readonly error: string;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * 空结果, 用于初始态与清空.
 */
export const EMPTY_RESULT: ResultView = {
  output: "",
  error: "",
  diagnostics: [],
};
