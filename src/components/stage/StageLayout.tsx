"use client";

// ============================================================
// StageLayout — Boardroom flow (setup → boardroom → verdict)
// ============================================================
//
// Eski StageTopBar yerine AppShell'in paylaşılan sidebar + sticky
// header'ını kullanıyor. Stage progress bar shell içeriğinin en
// üstünde kalır; aşağıda sahne içerik full-width akar.
// ============================================================

import { AppShell } from "@/components/app/AppShell";
import { SITE } from "@/lib/config/site";
import { StageProgressBar, type StageStep } from "./StageProgressBar";

interface StageLayoutProps {
  currentStep: StageStep;
  children: React.ReactNode;
}

export function StageLayout({ currentStep, children }: StageLayoutProps) {
  return (
    <AppShell activePath={SITE.paths.boardroomAgents}>
      <StageProgressBar currentStep={currentStep} />
      <div className="relative">{children}</div>
    </AppShell>
  );
}
