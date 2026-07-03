import { useEffect } from "react";

import { useJwtStore } from "@/tools/jwt/store/jwt-store";

/**
 * 令牌调试工具状态持久化: 主窗口启动加载, 之后防抖回存; 弹出窗口不读写.
 * 回存时只传 serialize() 的快照, 该快照不含 verifyKey/signKey, 确保密钥不落盘.
 * 仅需在应用外壳挂载一次.
 */
export function useJwtPersistence(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void window.windowControls.getPopoutSnapshot().then((snapshot) => {
      if (disposed || snapshot) {
        return;
      }
      void window.fileApi.loadJwtState().then((raw) => {
        if (!disposed) {
          useJwtStore.getState().hydrate(raw);
        }
      });
      unsubscribe = useJwtStore.subscribe(() => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          void window.fileApi.saveJwtState(useJwtStore.getState().serialize());
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
