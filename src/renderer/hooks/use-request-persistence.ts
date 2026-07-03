import { useEffect } from "react";

import { useRequestStore } from "@/tools/request/store/request-store";

/**
 * 请求调试工具状态持久化: 主窗口启动加载, 之后防抖回存; 弹出窗口不读写.
 * 按规格采用本地明文保存 (含 auth 字段), 与 Postman 桌面版一致.
 * 仅需在应用外壳挂载一次.
 */
export function useRequestPersistence(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void window.windowControls.getPopoutSnapshot().then((snapshot) => {
      if (disposed || snapshot) {
        return;
      }
      void window.fileApi.loadRequestState().then((raw) => {
        if (!disposed) {
          useRequestStore.getState().hydrate(raw);
        }
      });
      unsubscribe = useRequestStore.subscribe(() => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          void window.fileApi.saveRequestState(
            useRequestStore.getState().serialize(),
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
