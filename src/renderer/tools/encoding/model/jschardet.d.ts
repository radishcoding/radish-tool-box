/**
 * jschardet ambient 声明.
 * @types/jschardet 在 npm 上不存在, 故手写此声明.
 * jschardet 是 CommonJS 模块, 无默认导出, 须以 `import * as jschardet` 引入.
 */
declare module "jschardet" {
  /** 编码探测结果. */
  export interface DetectedEncoding {
    /** 检测到的编码名, 无法识别时为 null. */
    readonly encoding: string | null;
    /** 置信度 (0~1). */
    readonly confidence: number;
  }

  /**
   * 探测字符串或字节缓冲区最可能的编码.
   * @param buffer 待探测内容 (Latin1 二进制字符串或 Uint8Array).
   * @returns 探测结果.
   */
  export function detect(buffer: string | Uint8Array): DetectedEncoding;
}
