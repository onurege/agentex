"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getBoardroomRuns, deleteBoardroomRun, type BoardroomRunSnapshot } from "@/lib/run-history";
import { saveAuditEvent } from "@/lib/audit-log";

const RISK_LABELS: Record<string, { label: string; style: string }> = {
  high: { label: "Yüksek", style: "text-accent-danger bg-accent-danger/10" },
  medium: { label: "Orta", style: "text-accent-warning bg-accent-warning/10" },
  low: { label: "Düşük", style: "text-accent-success bg-accent-success/10" },
};

const MODE_LABELS: Record<string, { label: string; style: string }> = {
  ai: { label: "AI", style: "text-accent-primary bg-accent-primary/10" },
  "ai-partial": { label: "AI Kısmi", style: "text-accent-info bg-accent-info/10" },
  fallback: { label: "Fallback", style: "text-text-muted bg-workspace-elevated" },
};

export default function PanelRunsPage() {
  const [allRuns, setAllRuns] = useState<BoardroomRunSnapshot[]>([]);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setAllRuns(getBoardroomRuns());
    setMounted(true);
  }, []);

  const handleDelete = useCallback((runId: string, docName: string) => {
    deleteBoardroomRun(runId);
    saveAuditEvent({
      action: "run_deleted",
      targetType: "run",
      targetId: runId,
      summary: `"${docName}" çalıştırması silindi`,
    });
    setAllRuns(getBoardroomRuns());
    setDeleteConfirm(null);
  }, []);

  // Filter runs
  let filtered = allRuns;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((r) => r.documentName.toLowerCase().includes(q));
  }
  if (modeFilter !== "all") {
    filtered = filtered.filter((r) => (r.analysisMode ?? "fallback") === modeFilter);
  }
  if (riskFilter !== "all") {
    filtered = filtered.filter((r) => r.verdictSeed.riskLevel === riskFilter);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Runs</h1>
        <p className="text-lg text-text-secondary">
          Tamamlanan kurul tartışmaları ve sonuçları. {mounted && `${allRuns.length} kayıt`}
        </p>
      </div>

      {/* Search + Filters */}
      {mounted && allRuns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="Belge adı ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary placeholder:text-text-muted text-base min-h-[44px] min-w-[240px] focus:outline-none focus:border-accent-primary/40"
          />
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-base min-h-[44px] focus:outline-none focus:border-accent-primary/40"
          >
            <option value="all">Tüm Modlar</option>
            <option value="ai">AI</option>
            <option value="ai-partial">AI Kısmi</option>
            <option value="fallback">Fallback</option>
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-base min-h-[44px] focus:outline-none focus:border-accent-primary/40"
          >
            <option value="all">Tüm Risk</option>
            <option value="high">Yüksek Risk</option>
            <option value="medium">Orta Risk</option>
            <option value="low">Düşük Risk</option>
          </select>
          {(search || modeFilter !== "all" || riskFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setModeFilter("all"); setRiskFilter("all"); }}
              className="px-3 py-2 rounded-lg text-[14px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      )}

      {!mounted ? (
        <div className="text-base text-text-muted py-8">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-10">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <span className="text-5xl mb-5">📋</span>
            <p className="text-xl font-semibold text-text-primary mb-2">
              {allRuns.length === 0 ? "Henüz çalıştırma kaydı bulunmuyor" : "Filtrelerle eşleşen sonuç yok"}
            </p>
            <p className="text-base text-text-secondary max-w-md">
              {allRuns.length === 0
                ? "Kurul tartışmaları tamamlandığında geçmiş çalıştırmalar burada listelenecek."
                : "Farklı filtreler deneyin veya arama terimini değiştirin."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((run) => {
            const risk = RISK_LABELS[run.verdictSeed.riskLevel] ?? RISK_LABELS.medium;
            const mode = MODE_LABELS[run.analysisMode ?? "fallback"] ?? MODE_LABELS.fallback;
            const expertCount = run.agentSnapshots.filter((a) => !a.isChief).length;
            const date = new Date(run.createdAt);
            const hasCustomPrompt = run.agentSnapshots.some((a) => a.promptSnapshot !== null);
            const isDeleting = deleteConfirm === run.id;

            return (
              <div
                key={run.id}
                className="flex items-center gap-4 p-5 rounded-xl bg-workspace-surface border border-workspace-border hover:border-accent-primary/20 transition-colors"
              >
                {/* Document icon */}
                <div className="w-12 h-12 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-accent-primary uppercase font-mono">
                    {run.documentName.split(".").pop()?.toUpperCase() ?? "DOC"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-text-primary truncate">{run.documentName}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base text-text-secondary">
                      {date.toLocaleDateString("tr-TR")} · {date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[13px] text-text-muted">· {expertCount} ajan</span>
                    {hasCustomPrompt && (
                      <span className="text-[11px] font-mono font-semibold text-accent-info bg-accent-info/10 px-1.5 py-0.5 rounded">
                        Özel Prompt
                      </span>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${mode.style}`}>
                  {mode.label}
                </span>
                <span className={`text-[13px] font-semibold px-3 py-1 rounded-full shrink-0 ${risk.style}`}>
                  {risk.label}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/app/runs/${run.id}`}
                    className="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-accent-primary text-workspace-surface border border-accent-primary hover:bg-accent-secondary transition-colors min-h-[40px]"
                  >
                    Görüntüle
                  </Link>
                  <Link
                    href={`/app/runs/${run.id}/boardroom`}
                    className="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50 hover:text-text-primary transition-colors min-h-[40px]"
                  >
                    Oynat
                  </Link>

                  {/* Delete */}
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(run.id, run.documentName)}
                        className="px-3 py-2 rounded-lg text-[13px] font-semibold bg-accent-danger/15 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/25 transition-colors min-h-[40px]"
                      >
                        Onayla
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-2 rounded-lg text-[13px] font-medium text-text-muted hover:text-text-secondary transition-colors min-h-[40px]"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(run.id)}
                      className="px-3 py-2.5 rounded-lg text-[14px] font-medium text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 border border-transparent hover:border-accent-danger/20 transition-colors min-h-[40px]"
                      title="Sil"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
