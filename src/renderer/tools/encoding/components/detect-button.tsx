import { ScanSearch } from "lucide-react";
import type { ReactElement } from "react";

import { base64ToBytes, parseHex } from "@/lib/bytes-codec";
import { Button } from "@/components/ui/button";

import { findCharset } from "../model/charsets";
import { detectCharset } from "../model/detect";
import type { SideState } from "../model/types";

/**
 * 探测按钮: 对源字节探测编码并回调采用.
 * 仅当源形态为 hex/base64 时有意义.
 * @param source 源侧状态.
 * @param onApply 采用探测到的字符集.
 */
export function DetectButton({
  source,
  onApply,
}: {
  readonly source: SideState;
  readonly onApply: (charset: string) => void;
}): ReactElement | null {
  if (source.form !== "hex" && source.form !== "base64") {
    return null;
  }
  const onDetect = (): void => {
    try {
      const bytes =
        source.form === "hex"
          ? parseHex(source.text)
          : base64ToBytes(source.text);
      const result = detectCharset(bytes);
      if (result !== undefined && findCharset(result.charset) !== undefined) {
        onApply(result.charset);
      }
    } catch {
      // 源字节非法时忽略探测
    }
  };
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1.5"
      onClick={onDetect}
    >
      <ScanSearch className="size-4" />
      探测编码
    </Button>
  );
}
