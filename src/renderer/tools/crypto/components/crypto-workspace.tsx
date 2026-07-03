import type { ReactElement } from "react";

import { Transition } from "@/components/common/transition";

import type { AlgorithmCategory } from "../model/types";
import { useCryptoStore } from "../store/crypto-store";
import { AsymmetricPanel } from "./asymmetric-panel";
import { HashPanel } from "./hash-panel";
import { HmacPanel } from "./hmac-panel";
import { KdfPanel } from "./kdf-panel";
import { SymmetricPanel } from "./symmetric-panel";

/**
 * 按算法大类返回对应面板.
 * @param category 当前算法大类.
 */
function renderPanel(category: AlgorithmCategory): ReactElement {
  switch (category) {
    case "hash":
      return <HashPanel />;
    case "hmac":
      return <HmacPanel />;
    case "symmetric":
      return <SymmetricPanel />;
    case "kdf":
      return <KdfPanel />;
    case "asymmetric":
      return <AsymmetricPanel />;
    default: {
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

/**
 * 右侧工作区: 按当前类别渲染对应面板, 切换类别时播放统一的过渡动效.
 *
 * 外层 Transition 以当前类别为 key, 切换即重挂载内层并重放入场动画;
 * 内层用一个 flex 包装让面板保持 flex-1 充满可用空间, 故无需改动各面板自身结构.
 */
export function CryptoWorkspace(): ReactElement {
  const activeCategory = useCryptoStore((state) => state.activeCategory);

  return (
    <Transition
      transitionKey={activeCategory}
      variant="fade-up"
      className="min-w-0 flex-1"
    >
      <div className="flex h-full w-full">{renderPanel(activeCategory)}</div>
    </Transition>
  );
}
