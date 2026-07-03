/**
 * 手写处理的 Unicode 家族变体.
 */
export type UnicodeVariant =
  | "utf-8"
  | "utf-16le"
  | "utf-16be"
  | "utf-32le"
  | "utf-32be";

/**
 * 字符集实现方式: Unicode 家族手写, 旧字符集走 codepage 码表.
 */
export type CharsetKind = "unicode" | "codepage";

/**
 * 单个字符集定义.
 */
export interface CharsetDef {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly kind: CharsetKind;
  /** kind === "codepage" 时的 codepage 号. */
  readonly codepage?: number;
  /** kind === "unicode" 时的变体. */
  readonly unicode?: UnicodeVariant;
}

/**
 * 默认字符集 id.
 */
export const DEFAULT_CHARSET = "utf-8";

/**
 * 全部支持的字符集注册表 (按 group 分组展示).
 */
export const CHARSETS: readonly CharsetDef[] = [
  {
    id: "utf-8",
    label: "UTF-8",
    group: "Unicode",
    kind: "unicode",
    unicode: "utf-8",
  },
  {
    id: "utf-16le",
    label: "UTF-16 LE",
    group: "Unicode",
    kind: "unicode",
    unicode: "utf-16le",
  },
  {
    id: "utf-16be",
    label: "UTF-16 BE",
    group: "Unicode",
    kind: "unicode",
    unicode: "utf-16be",
  },
  {
    id: "utf-32le",
    label: "UTF-32 LE",
    group: "Unicode",
    kind: "unicode",
    unicode: "utf-32le",
  },
  {
    id: "utf-32be",
    label: "UTF-32 BE",
    group: "Unicode",
    kind: "unicode",
    unicode: "utf-32be",
  },

  {
    id: "gb2312",
    label: "GB2312",
    group: "中文",
    kind: "codepage",
    codepage: 20936,
  },
  { id: "gbk", label: "GBK", group: "中文", kind: "codepage", codepage: 936 },
  {
    id: "gb18030",
    label: "GB18030",
    group: "中文",
    kind: "codepage",
    codepage: 54936,
  },
  { id: "big5", label: "Big5", group: "中文", kind: "codepage", codepage: 950 },

  {
    id: "shift_jis",
    label: "Shift_JIS",
    group: "日文",
    kind: "codepage",
    codepage: 932,
  },
  {
    id: "euc-jp",
    label: "EUC-JP",
    group: "日文",
    kind: "codepage",
    codepage: 20932,
  },
  // 移除: iso-2022-jp (cptable 未提供码表)

  {
    id: "euc-kr",
    label: "EUC-KR",
    group: "韩文",
    kind: "codepage",
    codepage: 949,
  },

  {
    id: "ascii",
    label: "ASCII",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 20127,
  },
  {
    id: "iso-8859-1",
    label: "ISO-8859-1",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28591,
  },
  {
    id: "iso-8859-2",
    label: "ISO-8859-2",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28592,
  },
  {
    id: "iso-8859-3",
    label: "ISO-8859-3",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28593,
  },
  {
    id: "iso-8859-4",
    label: "ISO-8859-4",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28594,
  },
  {
    id: "iso-8859-5",
    label: "ISO-8859-5",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28595,
  },
  {
    id: "iso-8859-6",
    label: "ISO-8859-6",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28596,
  },
  {
    id: "iso-8859-7",
    label: "ISO-8859-7",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28597,
  },
  {
    id: "iso-8859-8",
    label: "ISO-8859-8",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28598,
  },
  {
    id: "iso-8859-9",
    label: "ISO-8859-9",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28599,
  },
  {
    id: "iso-8859-13",
    label: "ISO-8859-13",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28603,
  },
  {
    id: "iso-8859-15",
    label: "ISO-8859-15",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28605,
  },
  {
    id: "iso-8859-16",
    label: "ISO-8859-16",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 28606,
  },

  {
    id: "windows-1250",
    label: "Windows-1250",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1250,
  },
  {
    id: "windows-1251",
    label: "Windows-1251",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1251,
  },
  {
    id: "windows-1252",
    label: "Windows-1252",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1252,
  },
  {
    id: "windows-1253",
    label: "Windows-1253",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1253,
  },
  {
    id: "windows-1254",
    label: "Windows-1254",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1254,
  },
  {
    id: "windows-1255",
    label: "Windows-1255",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1255,
  },
  {
    id: "windows-1256",
    label: "Windows-1256",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1256,
  },
  {
    id: "windows-1257",
    label: "Windows-1257",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1257,
  },
  {
    id: "windows-1258",
    label: "Windows-1258",
    group: "西欧/通用",
    kind: "codepage",
    codepage: 1258,
  },

  {
    id: "koi8-r",
    label: "KOI8-R",
    group: "斯拉夫/其它",
    kind: "codepage",
    codepage: 20866,
  },
  {
    id: "koi8-u",
    label: "KOI8-U",
    group: "斯拉夫/其它",
    kind: "codepage",
    codepage: 21866,
  },
  {
    id: "mac-roman",
    label: "Mac Roman",
    group: "斯拉夫/其它",
    kind: "codepage",
    codepage: 10000,
  },
];

/**
 * 按 id 查找字符集定义.
 * @param id 字符集 id.
 */
export function findCharset(id: string): CharsetDef | undefined {
  return CHARSETS.find((c) => c.id === id);
}
