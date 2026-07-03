import { BrowserWindow, ipcMain } from "electron";
import path from "node:path";

import { WINDOW_CHANNEL, type PersistedSession } from "./ipc-channels";
import { bindWindowMaximizeState } from "./window-controls";

/**
 * 弹出窗口的初始快照 (按 webContents id 暂存); 临时副本, 不入持久化.
 */
const popoutSnapshots = new Map<number, PersistedSession>();

/**
 * 创建应用窗口; 传入 snapshot 时为弹出的独立副本窗口.
 */
export function createAppWindow(snapshot?: PersistedSession): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 700,
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (snapshot) {
    // 窗口存活时捕获 id; closed 触发时窗口与 webContents 已销毁, 不能再访问
    const webContentsId = window.webContents.id;
    popoutSnapshots.set(webContentsId, snapshot);
    window.on("closed", () => {
      popoutSnapshots.delete(webContentsId);
    });
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    if (!snapshot) {
      window.webContents.openDevTools();
    }
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  bindWindowMaximizeState(window);
  return window;
}

/**
 * 注册弹出相关 IPC 处理器, 整个应用仅需调用一次.
 */
export function registerPopoutHandlers(): void {
  ipcMain.on(WINDOW_CHANNEL.POPOUT, (_event, snapshot: PersistedSession) => {
    createAppWindow(snapshot);
  });
  ipcMain.handle(WINDOW_CHANNEL.GET_POPOUT_SNAPSHOT, (event) =>
    popoutSnapshots.get(event.sender.id),
  );
}
