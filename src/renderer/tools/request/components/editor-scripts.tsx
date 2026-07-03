import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { RequestTab } from "../model/types";
import { useRequestStore } from "../store/request-store";

/**
 * 常用 pm 片段 (点击插入到当前脚本末尾).
 */
const SNIPPETS: ReadonlyArray<{
  readonly label: string;
  readonly code: string;
}> = [
  { label: "设置环境变量", code: 'pm.environment.set("key", "value");' },
  { label: "取响应 JSON", code: "const data = pm.response.json();" },
  {
    label: "断言状态 200",
    code: 'pm.test("状态为 200", function () {\n  pm.response.to.have.status(200);\n});',
  },
  {
    label: "断言字段",
    code: 'pm.test("字段校验", function () {\n  pm.expect(pm.response.json().key).to.equal("value");\n});',
  },
  { label: "打印日志", code: "console.log(pm.response.text());" },
];

/**
 * Scripts 子页: 前置/后置脚本编辑 (Tab 切换) + 常用片段.
 * @param tab 当前标签.
 */
export function EditorScripts({
  tab,
}: {
  readonly tab: RequestTab;
}): ReactElement {
  const updateRequest = useRequestStore((s) => s.updateRequest);
  const [active, setActive] = useState<"pre" | "post">("pre");
  const value =
    active === "pre" ? tab.request.preScript : tab.request.postScript;
  const setValue = (next: string): void =>
    updateRequest(
      tab.id,
      active === "pre" ? { preScript: next } : { postScript: next },
    );

  return (
    <div className="flex min-h-0 flex-col gap-2 p-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActive("pre")}
          className={cn(
            "h-7 cursor-pointer text-xs",
            active === "pre" && "bg-primary/10 text-primary",
          )}
        >
          前置脚本
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActive("post")}
          className={cn(
            "h-7 cursor-pointer text-xs",
            active === "post" && "bg-primary/10 text-primary",
          )}
        >
          后置脚本 (Tests)
        </Button>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          active === "pre"
            ? "// 发送前执行, 可改变量\npm.environment.set(...)"
            : "// 收到响应后执行, 可断言\npm.test(...)"
        }
        className="min-h-48 flex-1 resize-none bg-muted/40 font-mono text-xs"
      />
      <div className="flex flex-wrap gap-1">
        {SNIPPETS.map((s) => (
          <Button
            key={s.label}
            variant="outline"
            size="sm"
            onClick={() =>
              setValue(value === "" ? s.code : `${value}\n${s.code}`)
            }
            className="h-6 cursor-pointer text-[11px] text-muted-foreground"
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
