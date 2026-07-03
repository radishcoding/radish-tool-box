import { useEffect } from "react";

import { useEncodingStore } from "@/tools/encoding/store/encoding-store";

/**
 * 编码转换工具状态持久化: 主窗口启动加载, 之后防抖回存; 弹出窗口不读写.
 * 仅需在应用外壳挂载一次.
 */
export function useEncodingPersistence(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void window.windowControls.getPopoutSnapshot().then((snapshot) => {
      if (disposed || snapshot) {
        return;
      }
      void window.fileApi.loadEncodingState().then((raw) => {
        if (!disposed) {
          useEncodingStore.getState().hydrate(raw);
        }
      });
      unsubscribe = useEncodingStore.subscribe(() => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          void window.fileApi.saveEncodingState(
            useEncodingStore.getState().serialize(),
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
