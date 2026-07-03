import { useEffect } from "react";

import { useCodecStore } from "@/tools/codec/store/codec-store";

/**
 * 编码解码工具状态持久化: 主窗口启动加载, 之后防抖回存; 弹出窗口不读写.
 * 仅需在应用外壳挂载一次.
 */
export function useCodecPersistence(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void window.windowControls.getPopoutSnapshot().then((snapshot) => {
      if (disposed || snapshot) {
        return;
      }
      void window.fileApi.loadCodecState().then((raw) => {
        if (!disposed) {
          useCodecStore.getState().hydrate(raw);
        }
      });
      unsubscribe = useCodecStore.subscribe(() => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          void window.fileApi.saveCodecState(
            useCodecStore.getState().serialize(),
          );
        }, 500);
      });
    });

    return () => {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
      unsubscribe?.();
    };
  }, []);
}
