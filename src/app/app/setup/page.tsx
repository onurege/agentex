"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StageLayout } from "@/components/stage/StageLayout";
import { DocumentUploadPanel } from "@/components/setup/DocumentUploadPanel";
import { BoardSummaryPanel } from "@/components/setup/BoardSummaryPanel";
import { ContextNotesInput } from "@/components/setup/ContextNotesInput";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { SITE } from "@/lib/config/site";

export default function BoardSetupPage() {
  const router = useRouter();
  const selectedAgentIds = useBoardroomFlowStore((s) => s.selectedAgentIds);
  const canLaunch = useBoardroomFlowStore((s) => s.canLaunchBoardroom);
  const uploadStatus = useBoardroomFlowStore((s) => s.uploadStatus);

  // Redirect to Agent Gallery if no agents selected
  useEffect(() => {
    if (selectedAgentIds.length === 0) {
      router.replace(SITE.paths.app);
    }
  }, [selectedAgentIds.length, router]);

  // Don't render until we confirm agents are selected
  if (selectedAgentIds.length === 0) {
    return (
      <StageLayout currentStep="board-setup">
        <div className="flex items-center justify-center h-full">
          <p className="text-lg text-text-muted">Yönlendiriliyor...</p>
        </div>
      </StageLayout>
    );
  }

  const isProcessing = uploadStatus === "uploading" || uploadStatus === "parsing";

  return (
    <StageLayout currentStep="board-setup">
      <div className="flex flex-col h-full px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">
            Kurul Hazırlığı
          </h1>
          <p className="text-xl text-text-secondary">
            Belgenizi yükleyin ve tartışmayı başlatın.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto w-full">
          {/* Left — Document Upload */}
          <DocumentUploadPanel />

          {/* Right — Board & Context */}
          <div className="flex flex-col gap-8">
            <BoardSummaryPanel />
            <ContextNotesInput />
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-workspace-border/30 max-w-5xl mx-auto w-full">
          {/* Back link */}
          <Link
            href={SITE.paths.app}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-medium
                       text-text-secondary hover:text-text-primary hover:bg-workspace-elevated
                       transition-colors duration-150 min-h-[48px]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Ajan Seçimine Dön
          </Link>

          {/* Launch CTA */}
          {canLaunch ? (
            <Link
              href={SITE.paths.boardroom}
              className="flex items-center gap-2 px-10 py-4 rounded-xl text-xl font-semibold
                         bg-accent-primary text-white border border-accent-primary
                         hover:bg-accent-secondary
                         transition-all duration-150 min-h-[56px] shadow-glow-blue"
            >
              <span>Tartışmayı Başlat</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ) : (
            <div className="flex flex-col items-end">
              <button
                disabled
                className="px-10 py-4 rounded-xl text-xl font-semibold
                           bg-workspace-elevated text-text-muted
                           border border-workspace-border
                           cursor-not-allowed min-h-[56px]"
              >
                Tartışmayı Başlat
              </button>
              {!isProcessing && uploadStatus !== "success" && (
                <span className="text-[14px] text-text-muted mt-2">
                  Devam etmek için belge yükleyin
                </span>
              )}
              {isProcessing && (
                <span className="text-[14px] text-accent-primary mt-2">
                  Belge işleniyor...
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </StageLayout>
  );
}
