import { Globe } from "lucide-react";
import type { ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useRequestStore } from "../store/request-store";

/**
 * 无活动环境时的占位值 (Select 不接受空串 value).
 */
const NONE = "__none__";

/**
 * 顶部活动环境切换下拉.
 */
export function EnvironmentSwitcher(): ReactElement {
  const environments = useRequestStore((s) => s.environments);
  const activeEnvironmentId = useRequestStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useRequestStore((s) => s.setActiveEnvironment);

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="size-3.5 text-muted-foreground" />
      <Select
        value={activeEnvironmentId ?? NONE}
        onValueChange={(v) => setActiveEnvironment(v === NONE ? undefined : v)}
      >
        <SelectTrigger className="h-7 w-36 text-xs">
          <SelectValue placeholder="无环境" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE} className="text-xs">
            无环境
          </SelectItem>
          {environments.map((env) => (
            <SelectItem key={env.id} value={env.id} className="text-xs">
              {env.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
