import type { ReactElement } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { FileFilter } from "../../../../ipc-channels";
import type { ClientCert, RequestSettings } from "../model/types";
import { FilePathInput } from "./file-path-input";

/**
 * 证书/私钥文件的选择过滤器.
 */
const CERT_FILTERS: readonly FileFilter[] = [
  { name: "证书/私钥", extensions: ["pem", "crt", "cer", "key"] },
  { name: "所有文件", extensions: ["*"] },
];

/**
 * TLS 版本下拉选项 (空串表示默认, 不固定版本).
 */
const TLS_VERSIONS = ["", "TLSv1.2", "TLSv1.3"] as const;

/**
 * TLS 版本下拉的统一样式.
 */
const TLS_SELECT_CLASS =
  "h-7 rounded-md border border-input bg-transparent px-2 text-xs text-foreground";

/**
 * 共享的 TLS 相关设置字段: 校验 SSL / SNI / TLS 版本 / 自定义 CA / 客户端证书 (mTLS).
 * HTTP 请求与各连接协议 (WS/TCP/MQTT/gRPC 等) 复用同一套字段.
 * @param settings 当前设置.
 * @param onPatch 局部更新回调.
 */
export function TlsSettingsFields({
  settings,
  onPatch,
}: {
  readonly settings: RequestSettings;
  readonly onPatch: (partial: Partial<RequestSettings>) => void;
}): ReactElement {
  // 客户端证书是一个对象; certPath 与 keyPath 都空则整体清空 (视为未配).
  const cert = settings.clientCert;
  const patchCert = (partial: Partial<ClientCert>): void => {
    const merged: ClientCert = {
      certPath: cert?.certPath ?? "",
      keyPath: cert?.keyPath ?? "",
      passphrase: cert?.passphrase,
      ...partial,
    };
    onPatch({
      clientCert:
        merged.certPath === "" && merged.keyPath === "" ? undefined : merged,
    });
  };

  return (
    <>
      <label className="flex items-center gap-2">
        <Switch
          checked={settings.sslVerify}
          onCheckedChange={(sslVerify) => onPatch({ sslVerify })}
        />
        校验 SSL 证书
      </label>
      <label className="flex items-center gap-2">
        <span className="w-28 shrink-0">SNI 服务器名</span>
        <Input
          value={settings.sni ?? ""}
          spellCheck={false}
          onChange={(e) =>
            onPatch({ sni: e.target.value === "" ? undefined : e.target.value })
          }
          className="h-7 flex-1 font-mono text-xs"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-28 shrink-0">TLS 版本</span>
        <select
          aria-label="TLS 最低版本"
          value={settings.tlsMinVersion ?? ""}
          onChange={(e) =>
            onPatch({
              tlsMinVersion: e.target.value === "" ? undefined : e.target.value,
            })
          }
          className={TLS_SELECT_CLASS}
        >
          {TLS_VERSIONS.map((v) => (
            <option key={v} value={v}>
              {v === "" ? "最低 (默认)" : `最低 ${v}`}
            </option>
          ))}
        </select>
        <select
          aria-label="TLS 最高版本"
          value={settings.tlsMaxVersion ?? ""}
          onChange={(e) =>
            onPatch({
              tlsMaxVersion: e.target.value === "" ? undefined : e.target.value,
            })
          }
          className={TLS_SELECT_CLASS}
        >
          {TLS_VERSIONS.map((v) => (
            <option key={v} value={v}>
              {v === "" ? "最高 (默认)" : `最高 ${v}`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-28 shrink-0">自定义 CA 路径</span>
        <FilePathInput
          value={settings.customCaPath ?? ""}
          placeholder="CA 证书文件绝对路径 (PEM)"
          filters={CERT_FILTERS}
          onChange={(p) => onPatch({ customCaPath: p === "" ? undefined : p })}
        />
      </label>
      <div className="flex flex-col gap-1.5 border-t pt-2">
        <span className="text-muted-foreground">客户端证书 (mTLS)</span>
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0">证书路径</span>
          <FilePathInput
            value={cert?.certPath ?? ""}
            placeholder="client-cert.pem 绝对路径"
            filters={CERT_FILTERS}
            onChange={(p) => patchCert({ certPath: p })}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0">私钥路径</span>
          <FilePathInput
            value={cert?.keyPath ?? ""}
            placeholder="client-key.pem 绝对路径"
            filters={CERT_FILTERS}
            onChange={(p) => patchCert({ keyPath: p })}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0">私钥密码</span>
          <Input
            type="password"
            value={cert?.passphrase ?? ""}
            placeholder="无则留空"
            spellCheck={false}
            onChange={(e) =>
              patchCert({
                passphrase: e.target.value === "" ? undefined : e.target.value,
              })
            }
            className="h-7 flex-1 font-mono text-xs"
          />
        </label>
      </div>
    </>
  );
}
