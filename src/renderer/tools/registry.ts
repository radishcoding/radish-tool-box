import {
  ArrowRightLeft,
  Binary,
  Braces,
  KeyRound,
  KeySquare,
  Send,
} from "lucide-react";
import type { ComponentType } from "react";

import { CodecToolPage } from "./codec/codec-tool-page";
import { CryptoToolPage } from "./crypto/crypto-tool-page";
import { EncodingToolPage } from "./encoding/encoding-tool-page";
import { JsonToolPage } from "./json/json-tool-page";
import { JwtToolPage } from "./jwt/jwt-tool-page";
import { RequestToolPage } from "./request/request-tool-page";

/**
 * 单个工具的元信息; Component 缺省时由外壳渲染占位页.
 */
export interface ToolDefinition {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly Component?: ComponentType;
}

/**
 * 工具箱注册表, 导航与内容区均由此生成 (新增工具只改此处).
 */
export const TOOLS: readonly ToolDefinition[] = [
  { id: "json", label: "文档解析", icon: Braces, Component: JsonToolPage },
  {
    id: "crypto",
    label: "算法调试",
    icon: KeyRound,
    Component: CryptoToolPage,
  },
  {
    id: "encoding",
    label: "编码转换",
    icon: ArrowRightLeft,
    Component: EncodingToolPage,
  },
  {
    id: "codec",
    label: "编码解码",
    icon: Binary,
    Component: CodecToolPage,
  },
  {
    id: "jwt",
    label: "令牌调试",
    icon: KeySquare,
    Component: JwtToolPage,
  },
  {
    id: "request",
    label: "请求调试",
    icon: Send,
    Component: RequestToolPage,
  },
];
