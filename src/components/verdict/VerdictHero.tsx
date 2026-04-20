"use client";

import type { VerdictSeed } from "@/lib/boardroom-flow-store";

interface VerdictHeroProps {
  verdict: VerdictSeed;
  documentName: string;
  agentCount: number;
}

const RISK_CONFIG = {
  high: {
    label: "Yüksek Risk",
    color: "text-accent-danger",
    bg: "bg-accent-danger/10",
    border: "border-accent-danger/20",
    dot: "bg-accent-danger",
  },
  medium: {
    label: "Orta Risk",
    color: "text-accent-warning",
    bg: "bg-accent-warning/10",
    border: "border-accent-warning/20",
    dot: "bg-accent-warning",
  },
  low: {
    label: "Düşük Risk",
    color: "text-accent-success",
    bg: "bg-accent-success/10",
    border: "border-accent-success/20",
    dot: "bg-accent-success",
  },
};

const CONFIDENCE_CONFIG = {
  high: {
    label: "Yüksek Güven",
    color: "text-accent-success",
    bg: "bg-accent-success/10",
    border: "border-accent-success/20",
  },
  medium: {
    label: "Orta Güven",
    color: "text-accent-info",
    bg: "bg-accent-info/10",
    border: "border-accent-info/20",
  },
  low: {
    label: "Düşük Güven",
    color: "text-accent-warning",
    bg: "bg-accent-warning/10",
    border: "border-accent-warning/20",
  },
};

export function VerdictHero({ verdict, documentName, agentCount }: VerdictHeroProps) {
  const risk = RISK_CONFIG[verdict.riskLevel];
  const confidence = verdict.confidenceLevel ? CONFIDENCE_CONFIG[verdict.confidenceLevel] : null;

  return (
    <div className="text-center mb-10">
      <h1 className="font-display text-4xl font-bold text-text-primary mb-4">
        Kurul Kararı
      </h1>

      {/* Executive summary */}
      <p className="text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed mb-6">
        {verdict.summary}
      </p>

      {/* Risk + Confidence badges + meta */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {/* Risk badge */}
        <div className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full ${risk.bg} border ${risk.border}`}>
          <span className={`w-3 h-3 rounded-full ${risk.dot}`} />
          <span className={`text-base font-semibold ${risk.color}`}>
            {risk.label}
          </span>
        </div>

        {/* Confidence badge */}
        {confidence && (
          <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full ${confidence.bg} border ${confidence.border}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={confidence.color}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className={`text-base font-semibold ${confidence.color}`}>
              {confidence.label}
            </span>
          </div>
        )}

        <span className="text-[14px] text-text-muted">
          {documentName} · {agentCount} uzman ajan
        </span>
      </div>
    </div>
  );
}
