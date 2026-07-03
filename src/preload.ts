import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  REQUEST_CHANNEL,
  type ProtoSource,
  type StreamEvent,
} from "./network/request-channels";
import {
  FILE_CHANNEL,
  WINDOW_CHANNEL,
  type FileApi,
  type NetworkApi,
  type WindowControlsApi,
} from "./ipc-channels";

const windowControls: WindowControlsApi = {
  minimize: () => ipcRenderer.send(WINDOW_CHANNEL.MINIMIZE),
  toggleMaximize: () => ipcRenderer.send(WINDOW_CHANNEL.TOGGLE_MAXIMIZE),
  close: () => ipcRenderer.send(WINDOW_CHANNEL.CLOSE),
  isMaximized: () => ipcRenderer.invoke(WINDOW_CHANNEL.IS_MAXIMIZED),
  onMaximizeChange: (callback) => {
    const listener = (_event: IpcRendererEvent, maximized: boolean): void => {
      callback(maximized);
    };
    ipcRenderer.on(WINDOW_CHANNEL.MAXIMIZE_CHANGE, listener);
    return () => {
      ipcRenderer.removeListener(WINDOW_CHANNEL.MAXIMIZE_CHANGE, listener);
    };
  },
  popout: (snapshot) => ipcRenderer.send(WINDOW_CHANNEL.POPOUT, snapshot),
  getPopoutSnapshot: () =>
    ipcRenderer.invoke(WINDOW_CHANNEL.GET_POPOUT_SNAPSHOT),
};

contextBridge.exposeInMainWorld("windowControls", windowControls);

const fileApi: FileApi = {
  open: () => ipcRenderer.invoke(FILE_CHANNEL.OPEN),
  openPath: (filters) => ipcRenderer.invoke(FILE_CHANNEL.OPEN_PATH, filters),
  saveFile: (options) => ipcRenderer.invoke(FILE_CHANNEL.SAVE_FILE, options),
  read: (filePath) => ipcRenderer.invoke(FILE_CHANNEL.READ, filePath),
  getRecent: () => ipcRenderer.invoke(FILE_CHANNEL.GET_RECENT),
  loadSession: () => ipcRenderer.invoke(FILE_CHANNEL.LOAD_SESSION),
  saveSession: (session) =>
    ipcRenderer.invoke(FILE_CHANNEL.SAVE_SESSION, session),
  loadCryptoState: () => ipcRenderer.invoke(FILE_CHANNEL.LOAD_CRYPTO),
  saveCryptoState: (state) =>
    ipcRenderer.invoke(FILE_CHANNEL.SAVE_CRYPTO, state),
  loadEncodingState: () => ipcRenderer.invoke(FILE_CHANNEL.LOAD_ENCODING),
  saveEncodingState: (state) =>
    ipcRenderer.invoke(FILE_CHANNEL.SAVE_ENCODING, state),
  loadCodecState: () => ipcRenderer.invoke(FILE_CHANNEL.LOAD_CODEC),
  saveCodecState: (state) => ipcRenderer.invoke(FILE_CHANNEL.SAVE_CODEC, state),
  loadJwtState: () => ipcRenderer.invoke(FILE_CHANNEL.LOAD_JWT),
  saveJwtState: (state) => ipcRenderer.invoke(FILE_CHANNEL.SAVE_JWT, state),
  loadRequestState: () => ipcRenderer.invoke(FILE_CHANNEL.LOAD_REQUEST),
  saveRequestState: (state) =>
    ipcRenderer.invoke(FILE_CHANNEL.SAVE_REQUEST, state),
};

contextBridge.exposeInMainWorld("fileApi", fileApi);

const networkApi: NetworkApi = {
  execute: (job) => ipcRenderer.invoke(REQUEST_CHANNEL.EXECUTE, job),
  cancel: (jobId) => ipcRenderer.send(REQUEST_CHANNEL.CANCEL, jobId),
  onEvent: (callback) => {
    const listener = (
      _event: IpcRendererEvent,
      streamEvent: StreamEvent,
    ): void => {
      callback(streamEvent);
    };
    ipcRenderer.on(REQUEST_CHANNEL.EVENT, listener);
    return () => {
      ipcRenderer.removeListener(REQUEST_CHANNEL.EVENT, listener);
    };
  },
  connect: (job) => ipcRenderer.send(REQUEST_CHANNEL.CONNECT, job),
  sendMessage: (jobId, message) =>
    ipcRenderer.send(REQUEST_CHANNEL.SEND, jobId, message),
  disconnect: (jobId) => ipcRenderer.send(REQUEST_CHANNEL.DISCONNECT, jobId),
  grpcReflect: (source: ProtoSource) =>
    ipcRenderer.invoke(REQUEST_CHANNEL.GRPC_REFLECT, source),
};

contextBridge.exposeInMainWorld("networkApi", networkApi);
