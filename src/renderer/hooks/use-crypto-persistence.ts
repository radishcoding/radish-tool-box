import { useEffect } from "react";

import { useCryptoStore } from "@/tools/crypto/store/crypto-store";

/**
 * 算法调试工具状态持久化:
 * - 弹出窗口 (有快照): 临时副本, 不读/不写持久状态.
 * - 主窗口: 启动加载持久状态, 之后防抖回存.
 * 仅需在应用外壳挂载一次.
 */
export function useCryptoPersistence(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void window.windowControls.getPopoutSnapshot().then((snapshot) => {
      if (disposed || snapshot) {
        return; // 弹出窗口为临时副本, 不读写 crypto 持久状态
      }

      void window.fileApi.loadCryptoState().then((raw) => {
        if (!disposed) {
          useCryptoStore.getState().hydrate(raw);
        }
      });

      unsubscribe = useCryptoStore.subscribe(() => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          void window.fileApi.saveCryptoState(
            useCryptoStore.getState().serialize(),
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
