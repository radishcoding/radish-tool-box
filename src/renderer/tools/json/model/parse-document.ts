import { parseTree, printParseErrorCode, type ParseError } from "jsonc-parser";
import { jsonrepair } from "jsonrepair";
import { parse } from "lossless-json";

import { buildTree, type JsonNode } from "./json-node";

/**
 * 解析错误的可读信息与字符偏移.
 */
export interface JsonParseError {
  readonly message: string;
  readonly offset: number;
}

/**
 * 一次解析的结果.
 */
export interface ParseResult {
  /**
   * lossless 解析得到的结构化值; 失败为 undefined.
   */
  readonly value: unknown;
  /**
   * 节点树根; 失败为 undefined.
   */
  readonly root: JsonNode | undefined;
  /**
   * 解析错误; 无错误为 undefined.
   */
  readonly error: JsonParseError | undefined;
  /**
   * 是否经 jsonrepair 容错得到 (此时偏移相对修复后文本).
   */
  readonly repaired: boolean;
}

/**
 * 解析文档文本: 先严格解析, 失败则尝试 jsonrepair 容错; 空白文本视为无内容无错误.
 */
export function parseDocument(text: string): ParseResult {
  if (text.trim() === "") {
    return {
      value: undefined,
      root: undefined,
      error: undefined,
      repaired: false,
    };
  }

  try {
    const value = parse(text);
    return { value, root: buildRoot(text), error: undefined, repaired: false };
  } catch {
    try {
      const repairedText = jsonrepair(text);
      const value = parse(repairedText);
      return {
        value,
        root: buildRoot(repairedText),
        error: undefined,
        repaired: true,
      };
    } catch {
      return {
        value: undefined,
        root: undefined,
        error: locateError(text),
        repaired: false,
      };
    }
  }
}

/**
 * 用 jsonc 语法树构建节点根.
 */
function buildRoot(text: string): JsonNode | undefined {
  const tree = parseTree(text);
  return tree ? buildTree(tree, text) : undefined;
}

/**
 * 借 jsonc 的错误收集定位首个错误的位置与信息.
 */
function locateError(text: string): JsonParseError {
  const errors: ParseError[] = [];
  parseTree(text, errors);
  const first = errors[0];
  if (first) {
    return { message: printParseErrorCode(first.error), offset: first.offset };
  }
  return { message: "无效的 JSON", offset: 0 };
}
