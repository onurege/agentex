"use client";

import type { VerdictSeed } from "@/lib/boardroom-flow-store";

interface DisagreementLedgerCardProps {
  disagreements: VerdictSeed["disagreements"];
  resolvedDisagreements?: VerdictSeed["resolvedDisagreements"];
  unresolvedDisagreements?: VerdictSeed["unresolvedDisagreements"];
}

export function DisagreementLedgerCard({
  disagreements,
  resolvedDisagreements,
  unresolvedDisagreements,
}: DisagreementLedgerCardProps) {
  const hasStructured = (resolvedDisagreements && resolvedDisagreements.length > 0) ||
    (unresolvedDisagreements && unresolvedDisagreements.length > 0);

  return (
    <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
      <h2 className="text-xl font-semibold text-text-primary mb-5">
        Görüş Ayrılıkları
      </h2>

      {/* No disagreements at all */}
      {disagreements.length === 0 && !hasStructured && (
        <p className="text-base text-text-muted">
          Görüş ayrılığı kaydedilmedi. Kurul uzlaşı ile sonuçlandı.
        </p>
      )}

      {/* Structured view: resolved + unresolved separately */}
      {hasStructured && (
        <div className="space-y-5">
          {/* Resolved */}
          {resolvedDisagreements && resolvedDisagreements.length > 0 && (
            <div>
              <h3 className="text-[15px] font-semibold text-accent-success mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Çözülen Görüş Ayrılıkları
              </h3>
              <div className="space-y-3">
                {resolvedDisagreements.map((d, i) => (
                  <div key={i} className="p-4 rounded-lg bg-accent-success/5 border border-accent-success/15">
                    <p className="text-[15px] font-medium text-text-primary mb-1">
                      {d.topic}
                    </p>
                    <p className="text-[14px] text-text-secondary mb-2">
                      <span className="font-medium">{d.agentA}</span>
                      {" ve "}
                      <span className="font-medium">{d.agentB}</span>
                    </p>
                    <p className="text-[14px] text-accent-success">
                      {d.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unresolved */}
          {unresolvedDisagreements && unresolvedDisagreements.length > 0 && (
            <div>
              <h3 className="text-[15px] font-semibold text-accent-warning mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Çözülemeyen Görüş Ayrılıkları
              </h3>
              <div className="space-y-3">
                {unresolvedDisagreements.map((d, i) => (
                  <div key={i} className="p-4 rounded-lg bg-accent-warning/5 border border-accent-warning/15">
                    <p className="text-[15px] font-medium text-text-primary mb-1">
                      {d.topic}
                    </p>
                    <p className="text-[14px] text-text-secondary mb-2">
                      <span className="font-medium">{d.agentA}</span>
                      {" ve "}
                      <span className="font-medium">{d.agentB}</span>
                    </p>
                    <p className="text-[14px] text-accent-warning">
                      {d.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legacy fallback: flat disagreements list (no resolved/unresolved distinction) */}
      {!hasStructured && disagreements.length > 0 && (
        <div className="space-y-4">
          {disagreements.map((d, i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-accent-warning/5 border border-accent-warning/15"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-accent-warning uppercase tracking-wide">
                  Görüş Ayrılığı
                </span>
                <span className="text-[14px] text-text-secondary">—</span>
                <span className="text-[15px] font-medium text-text-primary">
                  {d.topic}
                </span>
              </div>
              <p className="text-[15px] text-text-secondary mb-2">
                <span className="font-medium text-text-primary">{d.agentA}</span>
                {" ve "}
                <span className="font-medium text-text-primary">{d.agentB}</span>
                {" arasında"}
              </p>
              <div className="flex items-start gap-2 mt-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-success shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[14px] text-text-secondary">
                  {d.resolution}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
