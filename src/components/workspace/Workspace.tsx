"use client";

import { useWorkspaceStore } from "@/lib/store";
import { LeftPanel } from "./LeftPanel";
import { CenterCanvas } from "./CenterCanvas";
import { RightPanel } from "./RightPanel";
import { TopBar } from "./TopBar";

export function Workspace() {
  const isLeftCollapsed = useWorkspaceStore((s) => s.isLeftPanelCollapsed);
  const isRightCollapsed = useWorkspaceStore((s) => s.isRightPanelCollapsed);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div
          className={`
            flex-shrink-0 transition-all duration-300 ease-in-out
            ${isLeftCollapsed ? "w-0 opacity-0" : "w-[320px] opacity-100"}
          `}
        >
          {!isLeftCollapsed && <LeftPanel />}
        </div>

        {/* Center Canvas — flexible */}
        <div className="flex-1 min-w-0">
          <CenterCanvas />
        </div>

        {/* Right Panel */}
        <div
          className={`
            flex-shrink-0 transition-all duration-300 ease-in-out
            ${isRightCollapsed ? "w-0 opacity-0" : "w-[380px] opacity-100"}
          `}
        >
          {!isRightCollapsed && <RightPanel />}
        </div>
      </div>
    </div>
  );
}
