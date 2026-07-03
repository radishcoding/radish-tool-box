import type { JsonNode } from "./json-node";

/**
 * 检视区值展示所需的文本与高亮语言.
 */
export interface NodeValue {
  readonly text: string;
  readonly language: "json" | "plaintext";
}

/**
 * 取节点值用于检视区展示: 容器为其子树原文切片 (json), 字符串为内容, 其余为字面量 (plaintext).
 */
export function nodeValue(node: JsonNode, documentText: string): NodeValue {
  if (node.type === "object" || node.type === "array") {
    return {
      text: documentText.slice(node.offset, node.offset + node.length),
      language: "json",
    };
  }
  return { text: node.scalarText ?? "", language: "plaintext" };
}
