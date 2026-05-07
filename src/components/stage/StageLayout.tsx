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
      {/* Stage sahnesi viewport'un kalanını doldursun ki boardroom'un
          3D düzeni gibi h-full'a güvenen layout'lar deterministik
          yükseklik bulsun. Header (h-20) + progress (~3.5rem) çıkarıldı. */}
      <div className="relative flex flex-col min-h-[calc(100vh-7.5rem)]">
        {children}
      </div>
    </AppShell>
  );
}
