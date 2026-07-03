import { useState, type ReactElement } from "react";

import { Transition } from "@/components/common/transition";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCodecPersistence } from "@/hooks/use-codec-persistence";
import { useCryptoPersistence } from "@/hooks/use-crypto-persistence";
import { useEncodingPersistence } from "@/hooks/use-encoding-persistence";
import { useJwtPersistence } from "@/hooks/use-jwt-persistence";
import { useRequestExecution } from "@/hooks/use-request-execution";
import { useRequestPersistence } from "@/hooks/use-request-persistence";
import { useSessionPersistence } from "@/hooks/use-session-persistence";
import { PlaceholderTool } from "@/tools/placeholder-tool";
import { TOOLS } from "@/tools/registry";

import { Navbar } from "./navbar";
import { TitleBar } from "./title-bar";

/**
 * 应用外壳: 顶部导航 + 内容区, 负责当前工具的切换与渲染.
 */
export function AppShell(): ReactElement {
  useSessionPersistence();
  useCryptoPersistence();
  useEncodingPersistence();
  useCodecPersistence();
  useJwtPersistence();
  useRequestPersistence();
  useRequestExecution();

  const [activeToolId, setActiveToolId] = useState<string>(TOOLS[0].id);
  const activeTool = TOOLS.find((tool) => tool.id === activeToolId) ?? TOOLS[0];
  const ToolComponent = activeTool.Component;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-background">
        <TitleBar />
        <Navbar activeToolId={activeToolId} onSelect={setActiveToolId} />
        <main className="min-h-0 flex-1">
          <Transition
            transitionKey={activeToolId}
            variant="fade-up"
            className="h-full"
          >
            {ToolComponent ? (
              <ToolComponent />
            ) : (
              <PlaceholderTool name={activeTool.label} />
            )}
          </Transition>
        </main>
      </div>
    </TooltipProvider>
  );
}
