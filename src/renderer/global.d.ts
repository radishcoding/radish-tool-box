import type { FileApi, NetworkApi, WindowControlsApi } from "../ipc-channels";

declare global {
  interface Window {
    readonly windowControls: WindowControlsApi;
    readonly fileApi: FileApi;
    readonly networkApi: NetworkApi;
  }
}
