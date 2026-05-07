"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StageLayout } from "@/components/stage/StageLayout";
import { DocumentUploadPanel } from "@/components/setup/DocumentUploadPanel";
import { BoardSummaryPanel } from "@/components/setup/BoardSummaryPanel";
import { ContextNotesInput } from "@/components/setup/ContextNotesInput";
import { PartyStanceInput } from "@/components/setup/PartyStanceInput";
import { MaskMappingsInput } from "@/components/setup/MaskMappingsInput";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import { SITE } from "@/lib/config/site";
import { SceneIn } from "@/lib/motion/primitives";

export default function BoardSetupPage() {
  const router = useRouter();
  const selectedAgentIds = useBoardroomFlowStore((s) => s.selectedAgentIds);
  const canLaunch = useBoardroomFlowStore((s) => s.canLaunchBoardroom);
  const uploadStatus = useBoardroomFlowStore((s) => s.uploadStatus);
  const clientParty = useBoardroomFlowStore((s) => s.clientParty);
  const stance = useBoardroomFlowStore((s) => s.stance);

  // Redirect to Agent Gallery if no agents selected
  useEffect(() => {
    if (selectedAgentIds.length === 0) {
      router.replace(SITE.paths.boardroomAgents);
    }
  }, [selectedAgentIds.length, router]);

  // Don't render until we confirm agents are selected
  if (selectedAgentIds.length === 0) {
    return (
      <StageLayout currentStep="board-setup">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-text-muted">Yönlendiriliyor...</p>
        </div>
      </StageLayout>
    );
  }

  const isProcessing = uploadStatus === "uploading" || uploadStatus === "parsing";

  return (
    <StageLayout currentStep="board-setup">
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-12 py-5">
        {/* Header — kompakt, sola hizalı */}
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-0.5">
              Kurul Hazırlığı
            </p>
            <h1 className="font-display text-xl font-bold text-text-primary">
              Belgeyi yükleyin, kuruluna hazırlanın
            </h1>
          </div>
          <p className="text-sm text-text-muted hidden md:block">
            Belge + temsil/tutum zorunlu · maske ve bağlam opsiyonel
          </p>
        </div>

        {/* Üst sıra: Belge | Kurul | Temsil ve Tutum */}
        <SceneIn className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-3">
          <DocumentUploadPanel />
          <BoardSummaryPanel />
          <PartyStanceInput />
        </SceneIn>

        <SceneIn
          delay={0.08}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0"
        >
          <MaskMappingsInput />
          <ContextNotesInput />
        </SceneIn>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-workspace-border/30 w-full">
          {/* Back link */}
          <Link
            href={SITE.paths.boardroomAgents}
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-base font-semibold
                         bg-accent-primary text-workspace-surface border border-accent-primary
                         hover:bg-accent-secondary
                         transition-all duration-150 shadow-glow-blue"
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
                className="px-6 py-2.5 rounded-xl text-base font-semibold
                           bg-workspace-elevated text-text-muted
                           border border-workspace-border
                           cursor-not-allowed"
              >
                Tartışmayı Başlat
              </button>
              {!isProcessing && uploadStatus !== "success" && (
                <span className="text-[14px] text-text-muted mt-2">
                  Devam etmek için belge yükleyin
                </span>
              )}
              {!isProcessing && uploadStatus === "success" &&
                (clientParty.trim().length === 0 || stance === null) && (
                  <span className="text-[14px] text-text-muted mt-2">
                    Temsil ettiğiniz tarafı ve tutumu seçin
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
