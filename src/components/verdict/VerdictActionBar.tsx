"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardroomFlowStore } from "@/lib/boardroom-flow-store";
import type { VerdictSeed } from "@/lib/boardroom-flow-store";
import { SITE } from "@/lib/config/site";
import { getBoardroomRuns } from "@/lib/run-history";
import { getPersistenceMode } from "@/lib/persistence/factory";

interface VerdictActionBarProps {
  verdict: VerdictSeed;
  documentName: string;
}

function formatVerdictAsText(verdict: VerdictSeed, documentName: string): string {
  const lines: string[] = [];
  lines.push("═══ AI BOARDROOM — KURUL KARARI ═══");
  lines.push("");
  lines.push(`Belge: ${documentName}`);
  lines.push(`Risk Düzeyi: ${verdict.riskLevel === "high" ? "Yüksek" : verdict.riskLevel === "medium" ? "Orta" : "Düşük"}`);
  lines.push("");
  lines.push("ÖZET");
  lines.push(verdict.summary);
  lines.push("");

  if (verdict.decisions.length > 0) {
    lines.push("ANA KARARLAR");
    verdict.decisions.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`));
    lines.push("");
  }

  if (verdict.agentPerspectives.length > 0) {
    lines.push("AJAN GÖRÜŞLERİ");
    verdict.agentPerspectives.forEach((p) => {
      lines.push(`  ${p.agentName}: ${p.position}`);
    });
    lines.push("");
  }

  if (verdict.disagreements.length > 0) {
    lines.push("GÖRÜŞ AYRILIKLARI");
    verdict.disagreements.forEach((d) => {
      lines.push(`  ${d.topic}: ${d.agentA} vs ${d.agentB}`);
      lines.push(`    Çözüm: ${d.resolution}`);
    });
    lines.push("");
  }

  if (verdict.actionItems.length > 0) {
    lines.push("ÖNERİLEN AKSİYONLAR");
    verdict.actionItems.forEach((a) => lines.push(`  ${a}`));
    lines.push("");
  }

  lines.push("═══════════════════════════════════");
  return lines.join("\n");
}

export function VerdictActionBar({ verdict, documentName }: VerdictActionBarProps) {
  const router = useRouter();
  const resetFlow = useBoardroomFlowStore((s) => s.resetFlow);
  const [copied, setCopied] = useState(false);
  const [redlineRunId, setRedlineRunId] = useState<string | null>(null);

  // Redline download is only available in db mode (server persists the
  // RedlineArtifact). Pick up the most recent run from localStorage — it
  // was just saved by the boardroom page a moment ago and carries the
  // runId we need for the download URL.
  useEffect(() => {
    if (getPersistenceMode() !== "db") return;
    const latest = getBoardroomRuns()[0];
    if (latest) setRedlineRunId(latest.id);
  }, []);

  const handleCopy = useCallback(async () => {
    const text = formatVerdictAsText(verdict, documentName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select-and-copy via textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [verdict, documentName]);

  const handleExport = useCallback(() => {
    const text = formatVerdictAsText(verdict, documentName);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kurul-karari-${documentName.replace(/\.[^.]+$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [verdict, documentName]);

  const handleNewRun = useCallback(() => {
    resetFlow();
    router.push(SITE.paths.app);
  }, [resetFlow, router]);

  return (
    <div className="flex items-center justify-center gap-4 pt-8 border-t border-workspace-border/30 flex-wrap">
      {/* Redline DOCX — primary Faz 4 action, only in db mode */}
      {redlineRunId && (
        <a
          href={`/api/runs/${redlineRunId}/redline`}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold
                     bg-accent-primary text-white border border-accent-primary
                     hover:bg-accent-secondary transition-colors min-h-[52px] shadow-glow-blue"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Redline DOCX İndir</span>
        </a>
      )}

      {/* Copy */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold
                   bg-workspace-surface text-text-secondary border border-workspace-border
                   hover:bg-workspace-elevated hover:text-text-primary
                   transition-colors min-h-[52px]"
      >
        {copied ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-success">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-accent-success">Kopyalandı</span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Sonucu Kopyala</span>
          </>
        )}
      </button>

      {/* Export */}
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold
                   bg-workspace-surface text-text-secondary border border-workspace-border
                   hover:bg-workspace-elevated hover:text-text-primary
                   transition-colors min-h-[52px]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Dışa Aktar</span>
      </button>

      {/* New Run */}
      <button
        onClick={handleNewRun}
        className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold
                   bg-accent-primary text-white border border-accent-primary
                   hover:bg-accent-secondary
                   transition-colors min-h-[52px]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span>Yeni Tartışma Başlat</span>
      </button>
    </div>
  );
}
