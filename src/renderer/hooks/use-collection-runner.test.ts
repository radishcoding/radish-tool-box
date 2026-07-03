import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Collection,
  Environment,
  ExecuteJob,
  StreamEvent,
} from "../tools/request/model/types";
import { createDefaultRequest } from "../tools/request/model/types";
import { runCollectionById, runRequestOnce } from "./use-collection-runner";
import { useRequestStore } from "../tools/request/store/request-store";

type Listener = (event: StreamEvent) => void;

/**
 * 在 globalThis.window 上挂一个 mock networkApi.
 * script 在 execute 被调用时同步执行, 可向 listener 发事件.
 */
function installMockNetworkApi(
  script: (jobId: string, emit: Listener) => void,
): ReturnType<typeof vi.fn> {
  let listener: Listener | undefined;
  const executeMock = vi.fn((job: ExecuteJob) => {
    if (listener !== undefined) {
      script(job.jobId, listener);
    }
  });
  const api = {
    execute: executeMock,
    onEvent: (cb: Listener) => {
      listener = cb;
      return () => {
        listener = undefined;
      };
    },
    cancel: vi.fn(),
  };
  (globalThis as unknown as { window: { networkApi: unknown } }).window = {
    networkApi: api,
  };
  return executeMock;
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  vi.useRealTimers();
});

const scopes = { global: {}, collection: {}, environment: {}, local: {} };

describe("runRequestOnce", () => {
  it("收集 status/metric/test 直到 end", async () => {
    installMockNetworkApi((jobId, emit) => {
      emit({
        jobId,
        kind: "status",
        payload: { statusCode: 201, statusText: "Created", httpVersion: "1.1" },
      });
      emit({ jobId, kind: "metric", payload: { totalMs: 42 } });
      emit({ jobId, kind: "test", payload: { name: "ok", passed: true } });
      emit({ jobId, kind: "end", payload: {} });
    });
    const result = await runRequestOnce(createDefaultRequest(), scopes);
    expect(result.statusCode).toBe(201);
    expect(result.timeMs).toBe(42);
    expect(result.tests).toHaveLength(1);
    expect(result.error).toBe("");
  });

  it("error 事件以错误终态解决", async () => {
    installMockNetworkApi((jobId, emit) => {
      emit({ jobId, kind: "error", payload: { message: "连接失败" } });
    });
    const result = await runRequestOnce(createDefaultRequest(), scopes);
    expect(result.error).toBe("连接失败");
  });

  it("收集 vars 改动供链式传递", async () => {
    installMockNetworkApi((jobId, emit) => {
      emit({
        jobId,
        kind: "vars",
        payload: {
          mutations: [
            { scope: "environment", action: "set", key: "token", value: "abc" },
          ],
        },
      });
      emit({ jobId, kind: "end", payload: {} });
    });
    const result = await runRequestOnce(createDefaultRequest(), scopes);
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toMatchObject({ key: "token", value: "abc" });
  });

  it("兜底超时: 既不 emit end 也不 error 时, 推进 fallbackMs 后以 '运行超时' 解决", async () => {
    vi.useFakeTimers();
    // script 故意不发任何终态事件 (卡死).
    installMockNetworkApi(() => {
      /* intentionally hang - no events emitted */
    });
    const request = createDefaultRequest();
    // timeoutMs=30000, fallbackMs=35000.
    const fallbackMs = request.settings.timeoutMs + 5000;
    const promise = runRequestOnce(request, scopes);
    await vi.advanceTimersByTimeAsync(fallbackMs);
    const result = await promise;
    expect(result.error).toBe("运行超时");
  });

  it("finish 幂等: end 后再来 error 不重复 resolve (只解决一次)", async () => {
    let capturedEmit: Listener | undefined;
    installMockNetworkApi((jobId, emit) => {
      capturedEmit = (ev) => emit({ ...ev, jobId });
      emit({ jobId, kind: "end", payload: {} });
    });
    const resultPromise = runRequestOnce(createDefaultRequest(), scopes);
    // 确保 end 已处理.
    await Promise.resolve();
    // 再发 error — finish 已 settled, 应被幂等丢弃.
    capturedEmit?.({
      jobId: "any",
      kind: "error",
      payload: { message: "late" },
    });
    const result = await resultPromise;
    // 结果仍是首次 end 的干净结果.
    expect(result.error).toBe("");
  });
});

// ----------------------------------------------------------------
// runCollectionById - P0 链式 overlay 测试
// ----------------------------------------------------------------
describe("runCollectionById", () => {
  /** 向 store 注入一个含 2 个请求节点的集合 (无环境, 无全局变量). */
  function setupStore(collectionId: string): void {
    const col: Collection = {
      id: collectionId,
      name: "TestCol",
      variables: [],
      nodes: [
        {
          id: "req-1",
          type: "request",
          name: "Login",
          request: createDefaultRequest(),
        },
        {
          id: "req-2",
          type: "request",
          name: "GetProfile",
          request: createDefaultRequest(),
        },
      ],
    };
    useRequestStore.setState({
      collections: [col],
      environments: [],
      globals: [],
      activeEnvironmentId: undefined,
    });
  }

  beforeEach(() => {
    // 重置 store 到干净状态.
    useRequestStore.setState({
      collections: [],
      environments: [],
      globals: [],
      activeEnvironmentId: undefined,
    });
  });

  it("[P0] 第一个请求 emit vars(set token=abc), 第二个请求收到的 environment 含 token=abc", async () => {
    const collectionId = "col-overlay";
    setupStore(collectionId);

    // 记录每次 execute 收到的 scopes.environment.
    const capturedEnvs: Record<string, string>[] = [];
    let callCount = 0;

    installMockNetworkApi((jobId, emit) => {
      callCount += 1;
      if (callCount === 1) {
        // 第一个请求: emit vars(set token=abc) 后 end.
        emit({
          jobId,
          kind: "vars",
          payload: {
            mutations: [
              {
                scope: "environment",
                action: "set",
                key: "token",
                value: "abc",
              },
            ],
          },
        });
        emit({ jobId, kind: "end", payload: {} });
      } else {
        // 第二个请求: 直接 end.
        emit({ jobId, kind: "end", payload: {} });
      }
    });

    // spy execute 以捕获 variableScopes.
    const originalWindow = (
      globalThis as unknown as {
        window: { networkApi: { execute: (job: ExecuteJob) => void } };
      }
    ).window;
    const originalExecute = originalWindow.networkApi.execute;
    originalWindow.networkApi.execute = vi.fn((job: ExecuteJob) => {
      capturedEnvs.push({ ...job.variableScopes.environment });
      originalExecute(job);
    });

    await runCollectionById(collectionId, "", "csv");

    expect(capturedEnvs).toHaveLength(2);
    // 第一个请求: overlay 尚未注入, environment 为空.
    expect(capturedEnvs[0].token).toBeUndefined();
    // 第二个请求: overlay 注入后 environment 应含 token=abc.
    expect(capturedEnvs[1].token).toBe("abc");
  });

  it("[P0] unset mutation 从 overlay 删除, 后续请求不再含该 key", async () => {
    const collectionId = "col-unset";
    const col: Collection = {
      id: collectionId,
      name: "TestCol",
      variables: [],
      nodes: [
        {
          id: "r1",
          type: "request",
          name: "R1",
          request: createDefaultRequest(),
        },
        {
          id: "r2",
          type: "request",
          name: "R2",
          request: createDefaultRequest(),
        },
        {
          id: "r3",
          type: "request",
          name: "R3",
          request: createDefaultRequest(),
        },
      ],
    };
    useRequestStore.setState({
      collections: [col],
      environments: [],
      globals: [],
      activeEnvironmentId: undefined,
    });

    const capturedEnvs: Record<string, string>[] = [];
    let callCount = 0;

    installMockNetworkApi((jobId, emit) => {
      callCount += 1;
      if (callCount === 1) {
        // set token=abc.
        emit({
          jobId,
          kind: "vars",
          payload: {
            mutations: [
              {
                scope: "environment",
                action: "set",
                key: "token",
                value: "abc",
              },
            ],
          },
        });
        emit({ jobId, kind: "end", payload: {} });
      } else if (callCount === 2) {
        // unset token.
        emit({
          jobId,
          kind: "vars",
          payload: {
            mutations: [
              {
                scope: "environment",
                action: "unset",
                key: "token",
                value: "",
              },
            ],
          },
        });
        emit({ jobId, kind: "end", payload: {} });
      } else {
        emit({ jobId, kind: "end", payload: {} });
      }
    });

    const win = (
      globalThis as unknown as {
        window: { networkApi: { execute: (job: ExecuteJob) => void } };
      }
    ).window;
    const origExec = win.networkApi.execute;
    win.networkApi.execute = vi.fn((job: ExecuteJob) => {
      capturedEnvs.push({ ...job.variableScopes.environment });
      origExec(job);
    });

    await runCollectionById(collectionId, "", "csv");

    expect(capturedEnvs).toHaveLength(3);
    // R1: 无 token.
    expect(capturedEnvs[0].token).toBeUndefined();
    // R2: 有 token (R1 set 后注入).
    expect(capturedEnvs[1].token).toBe("abc");
    // R3: 无 token (R2 unset 后删除).
    expect(capturedEnvs[2].token).toBeUndefined();
  });

  it("[P0] 运行不写回 store: store 的 environments/globals 不变", async () => {
    const collectionId = "col-no-pollute";
    const env: Environment = {
      id: "env-1",
      name: "Prod",
      variables: [{ id: "v1", key: "token", value: "original", enabled: true }],
    };
    const col: Collection = {
      id: collectionId,
      name: "TestCol",
      variables: [],
      nodes: [
        {
          id: "r1",
          type: "request",
          name: "R1",
          request: createDefaultRequest(),
        },
      ],
    };
    useRequestStore.setState({
      collections: [col],
      environments: [env],
      globals: [],
      activeEnvironmentId: "env-1",
    });

    installMockNetworkApi((jobId, emit) => {
      // emit set token=hacked, 不应写回 store.
      emit({
        jobId,
        kind: "vars",
        payload: {
          mutations: [
            {
              scope: "environment",
              action: "set",
              key: "token",
              value: "hacked",
            },
          ],
        },
      });
      emit({ jobId, kind: "end", payload: {} });
    });

    await runCollectionById(collectionId, "", "csv");

    // store 中的 environment 变量仍是原始值.
    const state = useRequestStore.getState();
    const storedEnv = state.environments.find((e) => e.id === "env-1");
    const storedToken = storedEnv?.variables.find((v) => v.key === "token");
    expect(storedToken?.value).toBe("original");
  });
});
