import { useEffect, useMemo, useRef } from "react";

/**
 * 返回一个防抖版回调: 多次调用只在停顿 delayMs 后执行最后一次.
 * 始终使用最新的 callback (无需把它列入调用方依赖).
 */
export function useDebouncedCallback<Args extends readonly unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return useMemo(
    () =>
      (...args: Args): void => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(
          () => callbackRef.current(...args),
          delayMs,
        );
      },
    [delayMs],
  );
}
