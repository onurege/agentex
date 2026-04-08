"use client";

import { useState } from "react";
import { useWorkspaceStore } from "@/lib/store";
import { getAnalysisProvider } from "@/lib/engine";
import {
  Shield,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const RISK_LABELS: Record<string, string> = {
  high: "YÜKSEK",
  medium: "ORTA",
  low: "DÜŞÜK",
};

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  mock: { label: "Demo", color: "text-text-muted" },
  gemini: { label: "Gemini AI", color: "text-accent-primary" },
};

export function ManagerSummaryPanel() {
  const summary = useWorkspaceStore((s) => s.job.managerSummary);
  const discussion = useWorkspaceStore((s) => s.job.discussionSummary);
  const parsedDocument = useWorkspaceStore((s) => s.job.parsedDocument);
  const inputSource = useWorkspaceStore((s) => s.job.inputSource);
  const findings = useWorkspaceStore((s) => s.job.findings);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const provider = getAnalysisProvider();
  const providerConf = PROVIDER_LABELS[provider] ?? PROVIDER_LABELS.mock;

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-sm text-text-secondary">Henüz özet yok</p>
        <p className="text-xs text-text-muted mt-1">
          Yönetici özeti analiz sonrası görünecek
        </p>
      </div>
    );
  }

  const scoreColor =
    summary.contractHealthScore >= 70
      ? "text-accent-success"
      : summary.contractHealthScore >= 40
      ? "text-accent-warning"
      : "text-accent-danger";

  const scoreBg =
    summary.contractHealthScore >= 70
      ? "bg-accent-success/10"
      : summary.contractHealthScore >= 40
      ? "bg-accent-warning/10"
      : "bg-accent-danger/10";

  // Compute diagnostics info
  const sectionCount = parsedDocument?.sections.length ?? 0;
  const clauseCount = parsedDocument?.sections.reduce(
    (sum, s) => sum + (s.clauses?.length ?? 0),
    0,
  ) ?? 0;
  const extractionQuality = parsedDocument?.metadata.extractionQuality;
  const findingsWithClause = findings.filter((f) => f.clause).length;
  const findingsWithSection = findings.filter((f) => f.section).length;
  const sourceType = inputSource?.type ?? (parsedDocument?.source.type);
  const isGeminiFinding = findings.some((f) => f.id.startsWith("f-gemini-"));
  const isMockFinding = findings.some((f) => !f.id.startsWith("f-gemini-"));

  return (
    <div className="p-3 space-y-4">
      {/* Sağlık Puanı */}
      <div className={`flex items-center gap-4 p-4 rounded-xl ${scoreBg} border border-workspace-border-subtle`}>
        <div className="text-center">
          <p className={`text-3xl font-bold ${scoreColor}`}>
            {summary.contractHealthScore}
          </p>
          <p className="text-2xs text-text-muted mt-0.5">/ 100</p>
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-text-primary">Sözleşme Sağlığı</p>
          <p className="text-2xs text-text-secondary mt-0.5">
            Risk seviyesi:{" "}
            <span
              className={
                summary.riskLevel === "high"
                  ? "text-accent-danger"
                  : summary.riskLevel === "medium"
                  ? "text-accent-warning"
                  : "text-accent-success"
              }
            >
              {RISK_LABELS[summary.riskLevel] ?? summary.riskLevel.toUpperCase()}
            </span>
          </p>
          {/* AI Provider badge */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-2xs font-mono ${providerConf.color}`}>
              {providerConf.label}
            </span>
            {provider === "gemini" && isMockFinding && (
              <span className="text-2xs font-mono text-accent-warning px-1 py-px rounded bg-accent-warning/10">
                kısmi fallback
              </span>
            )}
          </div>
        </div>
        <Shield size={20} className={scoreColor} />
      </div>

      {/* Tartışma istatistikleri */}
      {discussion && (
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-workspace-elevated">
            <p className="text-lg font-bold text-text-primary">{discussion.totalFindings}</p>
            <p className="text-2xs text-text-muted">Bulgular</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-workspace-elevated">
            <p className="text-lg font-bold text-accent-danger">{discussion.criticalIssues}</p>
            <p className="text-2xs text-text-muted">Kritik</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-workspace-elevated">
            <p className="text-lg font-bold text-accent-warning">{discussion.disagreements}</p>
            <p className="text-2xs text-text-muted">Tartışmalar</p>
          </div>
        </div>
      )}

      {/* Değerlendirme */}
      <div>
        <h3 className="text-xs font-semibold text-text-primary mb-1.5">Değerlendirme</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          {summary.overallAssessment}
        </p>
      </div>

      {/* Temel Bulgular */}
      <div>
        <h3 className="text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
          <AlertCircle size={12} className="text-accent-danger" />
          Temel Bulgular
        </h3>
        <div className="space-y-1.5">
          {summary.keyFindings.map((kf, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-text-secondary"
            >
              <span className="text-accent-danger mt-1 flex-shrink-0">•</span>
              <span className="leading-relaxed">{kf}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Önerilen Eylemler */}
      <div>
        <h3 className="text-xs font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
          <TrendingUp size={12} className="text-accent-success" />
          Önerilen Eylemler
        </h3>
        <div className="space-y-1.5">
          {summary.recommendedActions.map((ra, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-text-secondary"
            >
              <CheckCircle2 size={12} className="text-accent-success flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{ra}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Uzlaşı Noktaları */}
      {discussion && discussion.consensusPoints.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-primary mb-1.5">
            Uzlaşı Noktaları
          </h3>
          <div className="space-y-1.5">
            {discussion.consensusPoints.map((cp, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-text-secondary"
              >
                <span className="text-accent-info mt-1 flex-shrink-0">✓</span>
                <span className="leading-relaxed">{cp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diagnostics (collapsible, developer-oriented) */}
      <div className="border-t border-workspace-border pt-2">
        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center gap-1 text-2xs font-mono text-text-muted hover:text-text-secondary transition-colors w-full"
        >
          {showDiagnostics ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          Sistem Bilgileri
        </button>

        {showDiagnostics && (
          <div className="mt-2 p-2 bg-workspace-bg/50 rounded border border-workspace-border space-y-1">
            <DiagRow label="Sağlayıcı" value={providerConf.label} />
            <DiagRow
              label="Kaynak"
              value={sourceType === "scenario" ? "Demo Senaryo" : "Yüklenen Belge"}
            />
            {extractionQuality && (
              <DiagRow label="Çıkarım kalitesi" value={extractionQuality} />
            )}
            <DiagRow label="Bölüm sayısı" value={String(sectionCount)} />
            {clauseCount > 0 && (
              <DiagRow label="Madde sayısı" value={String(clauseCount)} />
            )}
            <DiagRow
              label="Bulgu referansları"
              value={`${findingsWithClause} madde, ${findingsWithSection} bölüm`}
            />
            {provider === "gemini" && (
              <>
                <DiagRow
                  label="AI bulguları"
                  value={isGeminiFinding ? "Evet" : "Hayır"}
                />
                {isMockFinding && isGeminiFinding && (
                  <DiagRow
                    label="Fallback"
                    value="Bazı bulgular demo veriden"
                    warn
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DiagRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-2xs font-mono text-text-muted">{label}</span>
      <span
        className={`text-2xs font-mono ${
          warn ? "text-accent-warning" : "text-text-secondary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
