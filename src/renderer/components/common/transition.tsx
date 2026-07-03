import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 内置切换动效变体, 均为克制的入场动画 (基于 tw-animate-css).
 */
const TRANSITION_VARIANTS = {
  fade: "fade-in-0",
  "fade-up": "fade-in-0 slide-in-from-bottom-2",
  "fade-scale": "fade-in-0 zoom-in-95",
} as const;

/**
 * 切换动效变体名.
 */
export type TransitionVariant = keyof typeof TRANSITION_VARIANTS;

/**
 * 全局通用切换动效容器: transitionKey 变化时重挂载内层并重放入场动画.
 *
 * 结构为外静内动两层: 外层静止且 overflow-hidden 作裁剪边界, 内层承载位移动画;
 * 这样 slide 变体入场时的瞬时位移被外层裁掉, 不会溢出祖先布局产生滚动条.
 * 适用于工具/页面/视图等任意 "整块替换" 的切换; 自动尊重 prefers-reduced-motion.
 * @param transitionKey 标识当前内容的键, 变化即触发切换动画.
 * @param children 当前要展示的内容.
 * @param variant 动效变体, 默认 fade.
 * @param className 附加在外层容器上的类名 (如布局尺寸).
 */
export function Transition({
  transitionKey,
  children,
  variant = "fade",
  className,
}: {
  readonly transitionKey: string | number;
  readonly children: ReactNode;
  readonly variant?: TransitionVariant;
  readonly className?: string;
}): ReactElement {
  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        key={transitionKey}
        className={cn(
          "h-full animate-in duration-200 ease-out motion-reduce:animate-none",
          TRANSITION_VARIANTS[variant],
        )}
      >
        {children}
      </div>
    </div>
  );
}
