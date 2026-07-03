import { app } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PersistedSession } from "./ipc-channels";

/**
 * 持久化的应用状态.
 */
export interface AppState {
  readonly recentFiles: readonly string[];
  readonly session: PersistedSession | undefined;
  readonly cryptoState: unknown;
  readonly encodingState: unknown;
  readonly codecState: unknown;
  readonly jwtState: unknown;
  readonly requestState: unknown;
}

/**
 * 空状态.
 */
const EMPTY_STATE: AppState = {
  recentFiles: [],
  session: undefined,
  cryptoState: undefined,
  encodingState: undefined,
  codecState: undefined,
  jwtState: undefined,
  requestState: undefined,
};

/**
 * 状态文件路径 (用户数据目录下).
 */
function stateFilePath(): string {
  return path.join(app.getPath("userData"), "radish-state.json");
}

/**
 * 读取持久化状态; 不存在或损坏时返回空状态.
 */
export async function loadAppState(): Promise<AppState> {
  try {
    const raw = await readFile(stateFilePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      recentFiles: parsed.recentFiles ?? [],
      session: parsed.session,
      cryptoState: parsed.cryptoState,
      encodingState: parsed.encodingState,
      codecState: parsed.codecState,
      jwtState: parsed.jwtState,
      requestState: parsed.requestState,
    };
  } catch {
    return EMPTY_STATE;
  }
}

/**
 * 写入持久化状态; 失败静默 (不影响运行).
 */
export async function saveAppState(state: AppState): Promise<void> {
  try {
    await writeFile(stateFilePath(), JSON.stringify(state), "utf8");
  } catch {
    // 持久化失败不影响运行
  }
}
