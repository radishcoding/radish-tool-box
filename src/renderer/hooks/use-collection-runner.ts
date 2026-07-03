import { buildExecuteJob } from "@/tools/request/model/build-job";
import {
  flattenRequests,
  parseDataRows,
  runCollection,
  type DataFormat,
  type RunExecution,
  type RunSummary,
} from "@/tools/request/model/runner";
import type {
  ScriptMutation,
  VariableScopes,
} from "../../network/request-channels";
import type { HttpRequest, TestResult } from "@/tools/request/model/types";
import { buildScopesFromStore } from "@/tools/request/model/variable-scopes";
import { useRequestStore } from "@/tools/request/store/request-store";

/**
 * 发起一次请求执行并 await 终态, 收集状态码/耗时/断言.
 * @param request 高层请求.
 * @param scopes 四级变量作用域.
 * @returns 单次执行结果.
 */
export function runRequestOnce(
  request: HttpRequest,
  scopes: VariableScopes,
): Promise<RunExecution> {
  return new Promise<RunExecution>((resolve) => {
    const jobId = `run-${crypto.randomUUID()}`;
    let statusCode = 0;
    let timeMs = 0;
    let settled = false;
    const tests: TestResult[] = [];
    const mutations: ScriptMutation[] = [];
    // 兜底超时 (请求超时 + 余量): 防止某请求既无 end 也无 error 时整个运行卡死.
    const fallbackMs = request.settings.timeoutMs + 5000;
    const finish = (error: string): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve({ statusCode, timeMs, tests, error, mutations });
    };
    const unsubscribe = window.networkApi.onEvent((event) => {
      if (event.jobId !== jobId) {
        return;
      }
      switch (event.kind) {
        case "status":
          statusCode = (event.payload as { statusCode: number }).statusCode;
          break;
        case "metric":
          timeMs = (event.payload as { totalMs: number }).totalMs;
          break;
        case "test":
          tests.push(event.payload as TestResult);
          break;
        case "vars":
          mutations.push(
            ...(event.payload as { mutations: readonly ScriptMutation[] })
              .mutations,
          );
          break;
        case "end":
          finish("");
          break;
        case "error":
          finish((event.payload as { message: string }).message);
          break;
        default:
          break;
      }
    });
    const timer = setTimeout(() => {
      finish("运行超时");
    }, fallbackMs);
    void window.networkApi.execute(buildExecuteJob(request, jobId, scopes));
  });
}

/**
 * 按集合 id 运行整个集合 (数据驱动迭代, 行数据进 local 作用域).
 * @param collectionId 集合 id.
 * @param dataText 数据源文本 (空则跑 1 次).
 * @param format 数据源格式.
 * @param onProgress 进度回调.
 * @returns 运行汇总.
 */
export function runCollectionById(
  collectionId: string,
  dataText: string,
  format: DataFormat,
  onProgress?: (done: number, total: number) => void,
): Promise<RunSummary> {
  const state = useRequestStore.getState();
  const collection = state.collections.find((c) => c.id === collectionId);
  if (collection === undefined) {
    return Promise.resolve({
      iterations: 0,
      totalRequests: 0,
      totalAssertions: 0,
      passed: 0,
      failed: 0,
      results: [],
    });
  }
  const activeEnv = state.environments.find(
    (e) => e.id === state.activeEnvironmentId,
  );
  const baseScopes = buildScopesFromStore(
    state.globals,
    activeEnv,
    collection.variables,
  );
  const requests = flattenRequests(collection.nodes);
  const rows = parseDataRows(dataText, format);
  // 运行期变量叠加层: 收集脚本写入 (pm.environment.set 等), 累积传给后续请求, 实现链式
  // 鉴权 (登录请求写 token -> 后续请求用 {{token}}); 不污染用户已存的全局/环境/集合变量.
  const overlay: Record<string, string> = {};
  return runCollection(
    requests,
    rows,
    async (request, dataRow) => {
      const scopes = {
        ...baseScopes,
        environment: { ...baseScopes.environment, ...overlay },
        local: { ...dataRow },
      };
      const execution = await runRequestOnce(request, scopes);
      for (const mutation of execution.mutations) {
        if (mutation.action === "unset") {
          delete overlay[mutation.key];
        } else {
          overlay[mutation.key] = mutation.value;
        }
      }
      return execution;
    },
    onProgress,
  );
}
