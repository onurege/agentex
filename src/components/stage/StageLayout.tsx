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
  // `-mb-20` AppShell main'in alt padding'ini siler. Sahne yalnızca
  // viewport - header (5rem) yüksekliğinde sabit kalır; iç bölgeler
  // (debate stream gibi) kendi `overflow-y-auto`'ları ile scroll eder
  // ki sayfa gövdesi kaymadan tüm panel sabit dursun.
  return (
    <AppShell activePath={SITE.paths.boardroomAgents}>
      <div className="flex flex-col h-[calc(100vh-5rem)] -mb-20 overflow-hidden">
        <StageProgressBar currentStep={currentStep} />
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </AppShell>
  );
}
