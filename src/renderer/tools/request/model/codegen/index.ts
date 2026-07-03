import type { HttpRequest } from "../types";
import { generateCurl } from "./curl";

/**
 * 一个代码生成目标 (语言/工具).
 */
export interface CodegenTarget {
  readonly id: string;
  readonly label: string;
  readonly generate: (request: HttpRequest) => string;
}

/**
 * 全部代码生成目标 (本阶段仅 curl, 注册表式便于后续扩展).
 */
export const CODEGEN_TARGETS: readonly CodegenTarget[] = [
  { id: "curl", label: "cURL", generate: generateCurl },
];
