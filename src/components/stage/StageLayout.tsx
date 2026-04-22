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
        {children}
      </main>
    </div>
  );
}
