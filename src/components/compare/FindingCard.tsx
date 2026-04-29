"use client";

// ============================================================
// FindingCard — one row per detected diff on the results page
// ============================================================
//
// Visual hierarchy: clause ref + risk pill on top, single-line
// summary, side-by-side v1/v2 snippet, then the agent's impact
// paragraph. Type + party-impact badges sit near the risk pill so
// users can scan a list quickly.
// ============================================================

import type {
  CompareFinding,
  CompareFindingType,
  CompareRiskLevel,
  ComparePartyImpact,
} from "@/lib/compare/types";

const RISK_CLASS: Record<CompareRiskLevel, { label: string; className: string }> = {
  high: {
    label: "Yüksek Risk",
    className:
      "bg-accent-danger/12 text-accent-danger border-accent-danger/30",
  },
  medium: {
    label: "Orta Risk",
    className:
      "bg-accent-warning/15 text-accent-warning border-accent-warning/30",
  },
  low: {
    label: "Düşük Risk",
    className:
      "bg-accent-success/12 text-accent-success border-accent-success/25",
  },
};

const TYPE_LABEL: Record<CompareFindingType, string> = {
  added: "Eklendi",
  removed: "Silindi",
  reworded: "Yeniden Yazıldı",
  numeric_change: "Sayısal Değişim",
  material: "Maddi Değişiklik",
  cosmetic: "Kozmetik",
};

const PARTY_LABEL: Record<ComparePartyImpact, string> = {
  favors_buyer: "Alıcı Lehine",
  favors_seller: "Satıcı Lehine",
  mutual_risk: "Karşılıklı Etki",
  neutral: "Nötr",
};

export function FindingCard({ finding }: { finding: CompareFinding }) {
  const risk = RISK_CLASS[finding.riskLevel];

  return (
    <article className="rounded-xl border border-workspace-border bg-workspace-surface p-5 shadow-soft hover:shadow-medium transition-shadow">
      {/* Header row */}
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold text-text-tertiary tracking-wider uppercase">
              {finding.clauseRef}
            </span>
            <span className="text-xs text-text-muted">·</span>
            <span className="text-xs text-text-secondary">
              {TYPE_LABEL[finding.type]}
            </span>
          </div>
          {finding.clauseTitle && (
            <h3 className="font-display text-lg font-semibold text-text-primary leading-tight">
              {finding.clauseTitle}
            </h3>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${risk.className}`}
          >
            {risk.label}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-text-tertiary bg-workspace-elevated border border-workspace-border">
            {PARTY_LABEL[finding.partyImpact]}
          </span>
        </div>
      </header>

      {/* Summary */}
      <p className="text-[15px] text-text-primary leading-relaxed mb-4">
        {finding.summary}
      </p>

      {/* Side-by-side v1/v2 */}
      {(finding.v1Text || finding.v2Text) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <aside className="rounded-lg border border-workspace-border bg-workspace-elevated p-3.5">
            <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-accent-info mb-2">
              v1 — Önceki
            </div>
            {finding.v1Text ? (
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {finding.v1Text}
              </p>
            ) : (
              <p className="text-sm italic text-text-muted">
                — (bu maddede v1&apos;de içerik yok)
              </p>
            )}
          </aside>
          <aside className="rounded-lg border border-accent-primary/20 bg-accent-primary/[0.04] p-3.5">
            <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-accent-primary mb-2">
              v2 — Güncel
            </div>
            {finding.v2Text ? (
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {finding.v2Text}
              </p>
            ) : (
              <p className="text-sm italic text-text-muted">
                — (bu madde v2&apos;de kaldırılmış)
              </p>
            )}
          </aside>
        </div>
      )}

      {/* Impact */}
      <footer className="border-t border-workspace-border pt-3">
        <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-text-tertiary mb-1">
          Etki
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          {finding.impact}
        </p>
      </footer>
    </article>
  );
}
