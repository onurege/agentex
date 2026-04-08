"use client";

import { DiscussionScene } from "../scene/DiscussionScene";

export function CenterCanvas() {
  return (
    <div className="h-full w-full relative bg-workspace-bg overflow-hidden">
      {/* Subtle ambient gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(59,130,246,0.02) 0%, transparent 100%)",
        }}
      />
      <DiscussionScene />
    </div>
  );
}
