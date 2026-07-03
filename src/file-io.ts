import { BrowserWindow, dialog, ipcMain } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadAppState, saveAppState } from "./app-store";
import {
  FILE_CHANNEL,
  type FileFilter,
  type OpenedFile,
  type PersistedSession,
  type SaveFileOptions,
} from "./ipc-channels";
import { addRecentFile } from "./recent-files";

/**
 * 读取文件并登记为最近文件.
 */
async function readAndRecord(
  filePath: string,
): Promise<OpenedFile | undefined> {
  try {
    const content = await readFile(filePath, "utf8");
    const state = await loadAppState();
    await saveAppState({
      ...state,
      recentFiles: addRecentFile(state.recentFiles, filePath),
    });
    return { path: filePath, name: path.basename(filePath), content };
  } catch {
    return undefined;
  }
}

/**
 * 注册文件与持久化的全部 IPC 处理器, 整个应用仅需调用一次.
 */
export function registerFileIpcHandlers(): void {
  ipcMain.handle(FILE_CHANNEL.OPEN, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const result = await (window
      ? dialog.showOpenDialog(window, {
          properties: ["openFile"],
          filters: [
            { name: "JSON", extensions: ["json", "json5", "txt"] },
            { name: "所有文件", extensions: ["*"] },
          ],
        })
      : dialog.showOpenDialog({ properties: ["openFile"] }));
    if (result.canceled || result.filePaths.length === 0) {
      return undefined;
    }
    return readAndRecord(result.filePaths[0]);
  });

  ipcMain.handle(
    FILE_CHANNEL.OPEN_PATH,
    async (event, filters?: readonly FileFilter[]) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const dialogFilters = (filters ?? []).map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      }));
      const options = {
        properties: ["openFile" as const],
        ...(dialogFilters.length > 0 ? { filters: dialogFilters } : {}),
      };
      const result = await (window
        ? dialog.showOpenDialog(window, options)
        : dialog.showOpenDialog(options));
      return result.canceled || result.filePaths.length === 0
        ? undefined
        : result.filePaths[0];
    },
  );

  ipcMain.handle(
    FILE_CHANNEL.SAVE_FILE,
    async (event, options: SaveFileOptions): Promise<boolean> => {
      const window = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions = { defaultPath: options.defaultName };
      const result = await (window
        ? dialog.showSaveDialog(window, dialogOptions)
        : dialog.showSaveDialog(dialogOptions));
      if (result.canceled || result.filePath === undefined) {
        return false;
      }
      await writeFile(result.filePath, Buffer.from(options.base64, "base64"));
      return true;
    },
  );

  ipcMain.handle(FILE_CHANNEL.READ, (_event, filePath: string) =>
    readAndRecord(filePath),
  );

  ipcMain.handle(FILE_CHANNEL.GET_RECENT, async () => {
    const state = await loadAppState();
    return state.recentFiles;
  });

  ipcMain.handle(FILE_CHANNEL.LOAD_SESSION, async () => {
    const state = await loadAppState();
    return state.session;
  });

  ipcMain.handle(
    FILE_CHANNEL.SAVE_SESSION,
    async (_event, session: PersistedSession) => {
      const state = await loadAppState();
      await saveAppState({ ...state, session });
    },
  );

  ipcMain.handle(FILE_CHANNEL.LOAD_CRYPTO, async () => {
    const state = await loadAppState();
    return state.cryptoState;
  });

  ipcMain.handle(
    FILE_CHANNEL.SAVE_CRYPTO,
    async (_event, cryptoState: unknown) => {
      const state = await loadAppState();
      await saveAppState({ ...state, cryptoState });
    },
  );

  ipcMain.handle(FILE_CHANNEL.LOAD_ENCODING, async () => {
    const state = await loadAppState();
    return state.encodingState;
  });

  ipcMain.handle(
    FILE_CHANNEL.SAVE_ENCODING,
    async (_event, encodingState: unknown) => {
      const state = await loadAppState();
      await saveAppState({ ...state, encodingState });
    },
  );

  ipcMain.handle(FILE_CHANNEL.LOAD_CODEC, async () => {
    const state = await loadAppState();
    return state.codecState;
  });

  ipcMain.handle(
    FILE_CHANNEL.SAVE_CODEC,
    async (_event, codecState: unknown) => {
      const state = await loadAppState();
      await saveAppState({ ...state, codecState });
    },
  );

  ipcMain.handle(FILE_CHANNEL.LOAD_JWT, async () => {
    const state = await loadAppState();
    return state.jwtState;
  });

  ipcMain.handle(FILE_CHANNEL.SAVE_JWT, async (_event, jwtState: unknown) => {
    const state = await loadAppState();
    await saveAppState({ ...state, jwtState });
  });

  ipcMain.handle(FILE_CHANNEL.LOAD_REQUEST, async () => {
    const state = await loadAppState();
    return state.requestState;
  });

  ipcMain.handle(
    FILE_CHANNEL.SAVE_REQUEST,
    async (_event, requestState: unknown) => {
      const state = await loadAppState();
      await saveAppState({ ...state, requestState });
    },
  );
}
