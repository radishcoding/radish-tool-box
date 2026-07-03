import { useEffect, type ReactElement } from "react";

import { Diagnostics } from "@/components/common/diagnostics";

import { convert } from "../model/convert";
import { useEncodingStore } from "../store/encoding-store";
import { CodecPane } from "./codec-pane";
import { DetectButton } from "./detect-button";
import { EncodingToolbar } from "./encoding-toolbar";
import { SwapButton } from "./swap-button";

/**
 * 编码转换工作区: 顶部条 + 左右双栏 + 底部诊断, 防抖实时转换.
 */
export function EncodingWorkspace(): ReactElement {
  // 逐个订阅状态, 避免 exhaustive-deps 对对象引用的误报.
  const source = useEncodingStore((s) => s.source);
  const targetForm = useEncodingStore((s) => s.targetForm);
  const targetCharset = useEncodingStore((s) => s.targetCharset);
  const strict = useEncodingStore((s) => s.strict);
  const hex = useEncodingStore((s) => s.hex);
  const result = useEncodingStore((s) => s.result);

  // zustand 动作函数引用恒稳定, 逐个订阅不会触发额外重渲染.
  const updateSource = useEncodingStore((s) => s.updateSource);
  const setTargetForm = useEncodingStore((s) => s.setTargetForm);
  const setTargetCharset = useEncodingStore((s) => s.setTargetCharset);
  const setStrict = useEncodingStore((s) => s.setStrict);
  const setHex = useEncodingStore((s) => s.setHex);
  const swap = useEncodingStore((s) => s.swap);
  const setResult = useEncodingStore((s) => s.setResult);

  useEffect(() => {
    const timer = setTimeout(() => {
      setResult(convert({ source, targetForm, targetCharset, hex, strict }));
    }, 150);
    return () => clearTimeout(timer);
  }, [source, targetForm, targetCharset, hex, strict, setResult]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
      <EncodingToolbar
        strict={strict}
        hex={hex}
        onStrictChange={setStrict}
        onHexChange={setHex}
      />
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <CodecPane
          title="源"
          form={source.form}
          charset={source.charset}
          text={source.text}
          onFormChange={(form) => updateSource({ form })}
          onCharsetChange={(charset) => updateSource({ charset })}
          onTextChange={(text) => updateSource({ text })}
          extra={
            <DetectButton
              source={source}
              onApply={(charset) => updateSource({ charset })}
            />
          }
        />
        <SwapButton onSwap={swap} />
        <CodecPane
          title="目标"
          form={targetForm}
          charset={targetCharset}
          text={result.error !== "" ? result.error : result.output}
          readOnly
          onFormChange={setTargetForm}
          onCharsetChange={setTargetCharset}
        />
      </div>
      <div className="shrink-0 px-3 pb-3">
        <Diagnostics items={result.diagnostics} />
      </div>
    </div>
  );
}
