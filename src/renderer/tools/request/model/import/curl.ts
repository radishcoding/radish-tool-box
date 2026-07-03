import type {
  AuthConfig,
  BodyConfig,
  FormDataItem,
  HttpRequest,
} from "../types";
import { buildRequest, genId, item } from "./types";

/**
 * 把 curl 命令按 shell 规则切分为 token (处理单/双引号与反斜杠续行).
 * @param command curl 命令文本.
 * @returns token 列表.
 */
function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;
  let has = false;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote !== undefined) {
      if (ch === quote) {
        quote = undefined;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (ch === "\\" && command[i + 1] === "\n") {
      i += 1;
      continue;
    }
    if (ch === "\\" && (command[i + 1] === " " || command[i + 1] === "\\")) {
      current += command[i + 1];
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
      if (current !== "" || has) {
        tokens.push(current);
        current = "";
        has = false;
      }
      continue;
    }
    current += ch;
  }
  if (current !== "" || has) {
    tokens.push(current);
  }
  return tokens;
}

/**
 * 把一段原始体文本归为 raw 请求体 (按是否 JSON 选子类型).
 * @param text 体文本.
 * @returns 请求体配置.
 */
function rawBody(text: string): BodyConfig {
  const trimmed = text.trim();
  const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  return { type: "raw", rawType: isJson ? "json" : "text", text };
}

/**
 * 解析一个 curl 命令为 HttpRequest.
 * @param command curl 命令文本.
 * @returns 高层请求.
 */
export function parseCurl(command: string): HttpRequest {
  const tokens = tokenize(command);
  let method = "";
  let url = "";
  const headers: HttpRequest["headers"][number][] = [];
  const dataParts: string[] = [];
  const formItems: FormDataItem[] = [];
  let auth: AuthConfig = { type: "none" };
  let isForm = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = (): string => tokens[(i += 1)] ?? "";
    if (t === "curl") {
      continue;
    }
    if (t === "-X" || t === "--request") {
      method = next().toUpperCase();
    } else if (t === "-H" || t === "--header") {
      const h = next();
      const idx = h.indexOf(":");
      if (idx > 0) {
        headers.push(item(h.slice(0, idx).trim(), h.slice(idx + 1).trim()));
      }
    } else if (
      t === "-d" ||
      t === "--data" ||
      t === "--data-raw" ||
      t === "--data-ascii" ||
      t === "--data-binary"
    ) {
      dataParts.push(next());
    } else if (t === "--data-urlencode") {
      dataParts.push(next());
    } else if (t === "-F" || t === "--form") {
      isForm = true;
      const f = next();
      const idx = f.indexOf("=");
      if (idx > 0) {
        const key = f.slice(0, idx);
        const val = f.slice(idx + 1);
        const isFile = val.startsWith("@");
        formItems.push({
          id: genId("fd"),
          key,
          value: isFile ? val.slice(1) : val,
          enabled: true,
          kind: isFile ? "file" : "text",
        });
      }
    } else if (t === "-u" || t === "--user") {
      const u = next();
      const idx = u.indexOf(":");
      auth = {
        type: "basic",
        username: idx >= 0 ? u.slice(0, idx) : u,
        password: idx >= 0 ? u.slice(idx + 1) : "",
      };
    } else if (t === "--url") {
      url = next();
    } else if (t === "-G" || t === "--get") {
      method = method === "" ? "GET" : method;
    } else if (
      t === "--compressed" ||
      t === "-s" ||
      t === "--silent" ||
      t === "-i" ||
      t === "-v" ||
      t === "-L" ||
      t === "--location" ||
      t === "-k" ||
      t === "--insecure"
    ) {
      // 忽略不影响请求语义的开关.
    } else if (!t.startsWith("-") && url === "") {
      url = t;
    }
  }

  let body: BodyConfig = { type: "none" };
  if (isForm) {
    body = { type: "formdata", items: formItems };
  } else if (dataParts.length > 0) {
    body = rawBody(dataParts.join("&"));
  }
  if (method === "") {
    method = body.type !== "none" ? "POST" : "GET";
  }

  return buildRequest({ method, url, headers, body, auth });
}
