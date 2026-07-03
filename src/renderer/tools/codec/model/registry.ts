import { BINARY_CODECS } from "./codecs/binary";
import { ESCAPE_CODECS } from "./codecs/escape";
import { FUN_CODECS } from "./codecs/fun";
import { RADIX_CODECS } from "./codecs/radix";
import { TRANSPORT_CODECS } from "./codecs/transport";
import { WEB_CODECS } from "./codecs/web";
import type { CodecDef, CodecGroup } from "./types";

/**
 * 全部编解码项.
 */
export const CODECS: readonly CodecDef[] = [
  ...BINARY_CODECS,
  ...WEB_CODECS,
  ...ESCAPE_CODECS,
  ...RADIX_CODECS,
  ...TRANSPORT_CODECS,
  ...FUN_CODECS,
];

/**
 * 按 id 查找 codec.
 * @param id codec id.
 * @returns 命中的定义或 undefined.
 */
export function findCodec(id: string): CodecDef | undefined {
  return CODECS.find((codec) => codec.id === id);
}

/**
 * 族到中文名的有序映射 (sidebar 分组展示用).
 */
export const CODEC_GROUPS: ReadonlyArray<{
  readonly id: CodecGroup;
  readonly label: string;
}> = [
  { id: "binary", label: "二进制" },
  { id: "web", label: "Web" },
  { id: "escape", label: "转义" },
  { id: "number", label: "数值" },
  { id: "transport", label: "传输" },
  { id: "fun", label: "趣味" },
];
