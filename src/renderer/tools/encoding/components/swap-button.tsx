import { ArrowRightLeft } from "lucide-react";
import type { ReactElement } from "react";

import { IconAction } from "@/components/common/icon-action";

/**
 * 交换按钮: 对调源与目标.
 * @param onSwap 点击回调.
 */
export function SwapButton({
  onSwap,
}: {
  readonly onSwap: () => void;
}): ReactElement {
  return (
    <div className="flex shrink-0 items-center justify-center">
      <IconAction icon={ArrowRightLeft} label="交换源与目标" onClick={onSwap} />
    </div>
  );
}
