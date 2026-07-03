import { BrowserWindow, ipcMain } from "electron";

import { WINDOW_CHANNEL } from "./ipc-channels";

/**
 * 注册窗口控制的全局 IPC 处理器, 整个应用仅需调用一次.
 */
export function registerWindowControlHandlers(): void {
  ipcMain.on(WINDOW_CHANNEL.MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on(WINDOW_CHANNEL.TOGGLE_MAXIMIZE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.on(WINDOW_CHANNEL.CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle(WINDOW_CHANNEL.IS_MAXIMIZED, (event) =>
    Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized()),
  );
}

/**
 * 绑定窗口最大化/还原事件, 实时同步状态到渲染进程.
 * @param window 目标窗口.
 */
export function bindWindowMaximizeState(window: BrowserWindow): void {
  const notify = (maximized: boolean): void => {
    window.webContents.send(WINDOW_CHANNEL.MAXIMIZE_CHANGE, maximized);
  };
  window.on("maximize", () => notify(true));
  window.on("unmaximize", () => notify(false));
}
