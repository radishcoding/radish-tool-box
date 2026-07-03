import { useMemo, type ReactElement } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { decodeToken } from "./model/decode";
import type { JwtAlg } from "./model/types";
import { JwtDecoded } from "./components/jwt-decoded";
import { JwtInput } from "./components/jwt-input";
import { JwtSignPanel } from "./components/jwt-sign-panel";
import { JwtVerifyPanel } from "./components/jwt-verify-panel";
import { useJwtStore } from "./store/jwt-store";

/**
 * 令牌调试工具页: 顶部 Tab 切换解码与签发两个工作区.
 * 解码 Tab: 左侧输入 + 验签面板, 右侧 Header/Payload 卡片 + Claims 表.
 * 签发 Tab: 算法/Payload/密钥编辑 + 生成 token.
 */
export function JwtToolPage(): ReactElement {
  const tab = useJwtStore((s) => s.tab);
  const token = useJwtStore((s) => s.token);
  const setTab = useJwtStore((s) => s.setTab);

  // 实时解码; token 变化时重算.
  const decoded = useMemo(() => decodeToken(token), [token]);

  // 当前时间注入给 JwtDecoded 以判断 exp/nbf 状态; 随每次重渲染取最新值.
  const nowMs = Date.now();

  // 从 header 读取算法, 供验签面板使用.
  const alg =
    decoded.ok && typeof decoded.value.header.alg === "string"
      ? (decoded.value.header.alg as JwtAlg)
      : undefined;

  return (
    <div className="h-full min-h-0 p-3">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "decode" | "sign")}
        className="flex h-full min-h-0 w-full flex-col gap-3"
      >
        {/* Tab 标签栏 */}
        <TabsList className="w-fit">
          <TabsTrigger value="sign">签发</TabsTrigger>
          <TabsTrigger value="decode">解码</TabsTrigger>
        </TabsList>

        {/* 解码 Tab: 左侧输入区 + 右侧解码结果 */}
        <TabsContent
          value="decode"
          className="flex min-h-0 w-full flex-1 gap-3 overflow-hidden"
        >
          {/* 左侧: token 输入 + 验签面板 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                JWT Token
              </span>
              <JwtInput />
            </div>
            <JwtVerifyPanel token={token} alg={alg} />
          </div>

          {/* 右侧: Header/Payload/Claims */}
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            {decoded.ok ? (
              <JwtDecoded decoded={decoded.value} nowMs={nowMs} />
            ) : (
              token !== "" && (
                <div className="rounded-xl border bg-card px-4 py-3">
                  <span className="font-mono text-xs text-destructive">
                    {decoded.error}
                  </span>
                </div>
              )
            )}
          </div>
        </TabsContent>

        {/* 签发 Tab */}
        <TabsContent value="sign" className="min-h-0 flex-1 overflow-auto">
          <JwtSignPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
