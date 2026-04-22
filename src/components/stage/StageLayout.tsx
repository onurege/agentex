"use client";

import { StageTopBar } from "./StageTopBar";
import { StageProgressBar, type StageStep } from "./StageProgressBar";

interface StageLayoutProps {
  currentStep: StageStep;
  children: React.ReactNode;
}

export function StageLayout({ currentStep, children }: StageLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-workspace-bg text-text-primary overflow-hidden">
      <StageTopBar />
      <StageProgressBar currentStep={currentStep} />

      {/* Scene container — fills remaining space */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Cinematic vignette overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)",
          }}
        />
        <div className="relative z-0 h-full">{children}</div>
      </main>
    </div>
  );
}
