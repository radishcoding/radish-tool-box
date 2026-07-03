import type { ReactElement } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AuthConfig, RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";

/**
 * 鉴权类型选项.
 */
const AUTH_TYPES: ReadonlyArray<{
  readonly value: AuthConfig["type"];
  readonly label: string;
}> = [
  { value: "none", label: "无鉴权" },
  { value: "basic", label: "Basic" },
  { value: "bearer", label: "Bearer Token" },
  { value: "apikey", label: "API Key" },
  { value: "digest", label: "Digest" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "awsv4", label: "AWS Signature v4" },
];

/**
 * 切换鉴权类型时构造该类型的默认配置.
 */
function defaultAuth(type: AuthConfig["type"]): AuthConfig {
  switch (type) {
    case "basic":
      return { type: "basic", username: "", password: "" };
    case "bearer":
      return { type: "bearer", token: "" };
    case "apikey":
      return { type: "apikey", key: "", value: "", addTo: "header" };
    case "digest":
      return { type: "digest", username: "", password: "" };
    case "oauth2":
      return {
        type: "oauth2",
        grant: "token",
        accessToken: "",
        tokenUrl: "",
        clientId: "",
        clientSecret: "",
        scope: "",
        headerPrefix: "Bearer",
      };
    case "awsv4":
      return {
        type: "awsv4",
        accessKeyId: "",
        secretAccessKey: "",
        region: "",
        service: "",
        sessionToken: "",
      };
    default:
      return { type: "none" };
  }
}

/**
 * 一个带标签的文本输入行.
 */
function Field({
  label,
  value,
  onChange,
  password = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly password?: boolean;
}): ReactElement {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-28 shrink-0">{label}</span>
      <Input
        value={value}
        type={password ? "password" : "text"}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 flex-1 font-mono text-xs"
      />
    </label>
  );
}

/**
 * Auth 子页: 类型下拉 + 按类型动态表单.
 * @param tab 当前标签.
 */
export function EditorAuth({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const auth = tab.request.auth;
  const setAuth = (next: AuthConfig): void =>
    updateRequest(tab.id, { auth: next });

  return (
    <div className="flex flex-col gap-2 p-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="w-28 shrink-0">鉴权类型</span>
        <Select
          value={auth.type}
          onValueChange={(t) => setAuth(defaultAuth(t as AuthConfig["type"]))}
        >
          <SelectTrigger className="h-7 w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {auth.type === "basic" && (
        <>
          <Field
            label="用户名"
            value={auth.username}
            onChange={(username) => setAuth({ ...auth, username })}
          />
          <Field
            label="密码"
            password
            value={auth.password}
            onChange={(password) => setAuth({ ...auth, password })}
          />
        </>
      )}

      {auth.type === "bearer" && (
        <Field
          label="Token"
          value={auth.token}
          onChange={(token) => setAuth({ ...auth, token })}
        />
      )}

      {auth.type === "apikey" && (
        <>
          <Field
            label="键名"
            value={auth.key}
            onChange={(key) => setAuth({ ...auth, key })}
          />
          <Field
            label="键值"
            value={auth.value}
            onChange={(value) => setAuth({ ...auth, value })}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-28 shrink-0">加到</span>
            <Select
              value={auth.addTo}
              onValueChange={(addTo) =>
                setAuth({ ...auth, addTo: addTo as "header" | "query" })
              }
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header" className="text-xs">
                  请求头
                </SelectItem>
                <SelectItem value="query" className="text-xs">
                  查询参数
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
        </>
      )}

      {auth.type === "digest" && (
        <>
          <Field
            label="用户名"
            value={auth.username}
            onChange={(username) => setAuth({ ...auth, username })}
          />
          <Field
            label="密码"
            password
            value={auth.password}
            onChange={(password) => setAuth({ ...auth, password })}
          />
        </>
      )}

      {auth.type === "oauth2" && (
        <>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-28 shrink-0">授权方式</span>
            <Select
              value={auth.grant}
              onValueChange={(grant) =>
                setAuth({
                  ...auth,
                  grant: grant as "token" | "client_credentials",
                })
              }
            >
              <SelectTrigger className="h-7 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="token" className="text-xs">
                  直接用已有令牌
                </SelectItem>
                <SelectItem value="client_credentials" className="text-xs">
                  Client Credentials
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          {auth.grant === "token" ? (
            <Field
              label="Access Token"
              value={auth.accessToken}
              onChange={(accessToken) => setAuth({ ...auth, accessToken })}
            />
          ) : (
            <>
              <Field
                label="Token URL"
                value={auth.tokenUrl}
                onChange={(tokenUrl) => setAuth({ ...auth, tokenUrl })}
              />
              <Field
                label="Client ID"
                value={auth.clientId}
                onChange={(clientId) => setAuth({ ...auth, clientId })}
              />
              <Field
                label="Client Secret"
                password
                value={auth.clientSecret}
                onChange={(clientSecret) => setAuth({ ...auth, clientSecret })}
              />
              <Field
                label="Scope"
                value={auth.scope}
                onChange={(scope) => setAuth({ ...auth, scope })}
              />
            </>
          )}
          <Field
            label="头前缀"
            value={auth.headerPrefix}
            onChange={(headerPrefix) => setAuth({ ...auth, headerPrefix })}
          />
        </>
      )}

      {auth.type === "awsv4" && (
        <>
          <Field
            label="Access Key Id"
            value={auth.accessKeyId}
            onChange={(accessKeyId) => setAuth({ ...auth, accessKeyId })}
          />
          <Field
            label="Secret Key"
            password
            value={auth.secretAccessKey}
            onChange={(secretAccessKey) =>
              setAuth({ ...auth, secretAccessKey })
            }
          />
          <Field
            label="Region"
            value={auth.region}
            onChange={(region) => setAuth({ ...auth, region })}
          />
          <Field
            label="Service"
            value={auth.service}
            onChange={(service) => setAuth({ ...auth, service })}
          />
          <Field
            label="Session Token"
            value={auth.sessionToken}
            onChange={(sessionToken) => setAuth({ ...auth, sessionToken })}
          />
        </>
      )}
    </div>
  );
}
