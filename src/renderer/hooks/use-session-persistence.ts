import { useEffect } from "react";

import { useDocumentStore } from "@/tools/json/store/document-store";

/**
 * 会话持久化:
 * - 弹出窗口 (有快照): 用快照 hydrate, 作为临时副本不读/不写持久会话.
 * - 主窗口 (无快照): 启动加载持久会话, 之后防抖回存.
 * 仅需在应用外壳挂载一次.
 */
export function useSessionPersistence(): void {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void window.windowControls.getPopoutSnapshot().then((snapshot) => {
      if (disposed) {
        return;
      }
      if (snapshot) {
        if (snapshot.documents.length > 0) {
          useDocumentStore.getState().hydrateSession(snapshot);
        }
        return; // 临时副本: 不读/不写持久会话
      }

      void window.fileApi.loadSession().then((session) => {
        if (!disposed && session && session.documents.length > 0) {
          useDocumentStore.getState().hydrateSession(session);
        }
      });

      unsubscribe = useDocumentStore.subscribe(() => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          void window.fileApi.saveSession(
            useDocumentStore.getState().serializeSession(),
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
