import { runInNewContext } from "node:vm";

import type {
  ScriptMutation,
  TestResult,
  VariableScopes,
} from "./request-channels";
import { makeExpect } from "./script-expect";

/**
 * 传给脚本的请求视图 (只读).
 */
export interface ScriptRequestView {
  readonly method: string;
  readonly url: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}

/**
 * 传给后置脚本的响应视图.
 */
export interface ScriptResponseView {
  readonly code: number;
  readonly status: string;
  readonly responseTime: number;
  readonly headers: Record<string, string | string[]>;
  readonly body: string;
}

/**
 * 脚本执行产出.
 */
export interface ScriptOutcome {
  readonly mutations: readonly ScriptMutation[];
  readonly tests: readonly TestResult[];
  readonly logs: readonly string[];
  readonly error: string;
}

/**
 * 把任意参数格式化为日志行.
 * @param args console 参数.
 * @returns 拼接后的日志文本.
 */
function formatLog(args: readonly unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : safeStringify(a)))
    .join(" ");
}

/**
 * 安全地序列化日志值.
 * @param value 任意值.
 * @returns 字符串.
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * 在 node:vm 沙箱中执行一段 pm.* 脚本, 返回变量改动/断言/日志.
 * 脚本同步执行, 5 秒超时; 异常归一为 outcome.error.
 * @param code 脚本源码.
 * @param ctx 请求视图, 可选响应视图, 当前变量作用域.
 * @returns 执行产出.
 */
export function runScript(
  code: string,
  ctx: {
    request: ScriptRequestView;
    response?: ScriptResponseView;
    scopes: VariableScopes;
  },
): ScriptOutcome {
  const mutations: ScriptMutation[] = [];
  const tests: TestResult[] = [];
  const logs: string[] = [];

  // 各作用域的工作副本 (脚本读写以此为准, set 同时记 mutation).
  const work: Record<ScriptMutation["scope"], Record<string, string>> = {
    globals: { ...ctx.scopes.global },
    collection: { ...ctx.scopes.collection },
    environment: { ...ctx.scopes.environment },
    local: { ...ctx.scopes.local },
  };

  const scopeApi = (scope: ScriptMutation["scope"]) => ({
    get: (key: string): string | undefined => work[scope][key],
    set: (key: string, value: string): void => {
      const v = String(value);
      work[scope][key] = v;
      mutations.push({ scope, action: "set", key, value: v });
    },
    unset: (key: string): void => {
      delete work[scope][key];
      mutations.push({ scope, action: "unset", key, value: "" });
    },
  });

  // pm.variables.get: local > environment > collection > globals.
  const resolveVar = (key: string): string | undefined =>
    work.local[key] ??
    work.environment[key] ??
    work.collection[key] ??
    work.globals[key];

  const pm = {
    globals: scopeApi("globals"),
    collectionVariables: scopeApi("collection"),
    environment: scopeApi("environment"),
    variables: {
      get: resolveVar,
      set: (key: string, value: string): void =>
        scopeApi("local").set(key, value),
    },
    // 浅拷贝传入沙箱, 防脚本就地变异主进程的请求/响应头对象 (与各作用域工作副本一致).
    request: { ...ctx.request },
    response: (() => {
      if (!ctx.response) {
        return undefined;
      }
      const resp = ctx.response;
      return {
        code: resp.code,
        status: resp.status,
        responseTime: resp.responseTime,
        headers: { ...resp.headers },
        text: (): string => resp.body ?? "",
        json: (): unknown => JSON.parse(resp.body ?? "null"),
        to: {
          have: {
            status: (expected: number): void => {
              if (resp.code !== expected) {
                throw new Error(`期望状态 ${expected}, 实际 ${resp.code}`);
              }
            },
          },
          be: {
            get ok(): void {
              const code = resp.code ?? 0;
              if (code < 200 || code >= 300) {
                throw new Error(`期望 2xx, 实际 ${code}`);
              }
              return;
            },
          },
        },
      };
    })(),
    test: (name: string, fn: () => void): void => {
      try {
        fn();
        tests.push({ name, passed: true, error: "" });
      } catch (err) {
        tests.push({
          name,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    expect: makeExpect,
  };

  const sandbox = {
    pm,
    console: {
      log: (...args: unknown[]): void => {
        logs.push(formatLog(args));
      },
      error: (...args: unknown[]): void => {
        logs.push(formatLog(args));
      },
      warn: (...args: unknown[]): void => {
        logs.push(formatLog(args));
      },
    },
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
  };

  let error = "";
  try {
    runInNewContext(code, sandbox, { timeout: 5000 });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return { mutations, tests, logs, error };
}
