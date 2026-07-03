import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";

import { registerFileIpcHandlers } from "./file-io";
import { registerNetworkIpcHandlers } from "./network/network-ipc";
import { registerWindowControlHandlers } from "./window-controls";
import { createAppWindow, registerPopoutHandlers } from "./windows";

if (started) {
  app.quit();
}

app.on("ready", () => {
  registerWindowControlHandlers();
  registerFileIpcHandlers();
  registerPopoutHandlers();
  registerNetworkIpcHandlers();
  createAppWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createAppWindow();
  }
});
