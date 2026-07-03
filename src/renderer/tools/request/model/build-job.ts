import type {
  ExecuteJob,
  HttpRequest,
  VariableScopes,
} from "../../../../network/request-channels";

/**
 * 把高层请求包装为可下发的执行作业.
 * @param request 高层请求.
 * @param jobId 作业 id.
 * @param scopes 四级变量作用域 (由 store 装配).
 * @returns 执行作业.
 */
export function buildExecuteJob(
  request: HttpRequest,
  jobId: string,
  scopes: VariableScopes,
): ExecuteJob {
  return { jobId, spec: request, variableScopes: scopes };
}
