"use client";

// ============================================================
// /app/compare/[id] — Compare run results
// ============================================================
//
// Stats header + filterable findings list. Real redline preview
// and DOCX export wire up in Faz 2 — for now we surface everything
// the mock engine produced.
// ============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileDiff,
} from "lucide-react";
import { CompareLayout } from "@/components/compare/CompareLayout";
import { FindingCard } from "@/components/compare/FindingCard";
import { useCompareStore } from "@/lib/compare/store";
import type { CompareRiskLevel } from "@/lib/compare/types";

type RiskFilter = "all" | CompareRiskLevel;

const RISK_FILTERS: { key: RiskFilter; label: string; icon: React.ElementType }[] =
  [
    { key: "all", label: "Tümü", icon: FileDiff },
    { key: "high", label: "Yüksek", icon: AlertTriangle },
    { key: "medium", label: "Orta", icon: Circle },
    { key: "low", label: "Düşük", icon: CheckCircle2 },
  ];

export default function CompareResultsPage() {
  const params = useParams<{ id: string }>();
  const run = useCompareStore((s) => s.getRun(params.id));

  const [risk, setRisk] = useState<RiskFilter>("all");

  const filtered = useMemo(() => {
    if (!run) return [];
    if (risk === "all") return run.findings;
    return run.findings.filter((f) => f.riskLevel === risk);
  }, [run, risk]);

  if (!run) {
    // Direct-URL hit with a missing id — defer to not-found so users
    // aren't stuck on a blank page.
    if (typeof window !== "undefined") notFound();
    return null;
  }

  return (
    <CompareLayout pageTitle="Sonuç">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          href="/app/compare"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-5 transition-colors"
        >
          <ArrowLeft size={14} />
          Karşılaştırma modülüne dön
        </Link>

        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-text-tertiary mb-1.5 tracking-wider uppercase">
                Karşılaştırma Raporu
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary leading-tight">
                <span className="text-accent-info">{run.v1.fileName}</span>{" "}
                <span className="text-text-muted">→</span>{" "}
                <span className="text-accent-primary">{run.v2.fileName}</span>
              </h1>
            </div>

            {/* Export is mock in Faz 1; real DOCX redline lands in Faz 2. */}
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-workspace-elevated text-text-tertiary border border-workspace-border cursor-not-allowed opacity-70"
              title="Faz 2'de redline DOCX export eklenecek"
            >
              <Download size={15} />
              DOCX Redline <span className="text-xs font-mono">(yakında)</span>
            </button>
          </div>
        </header>

        {/* Stats strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Toplam Fark"
            value={run.stats.total}
            tone="neutral"
          />
          <StatCard
            label="Yüksek Risk"
            value={run.stats.high}
            tone="danger"
          />
          <StatCard
            label="Orta Risk"
            value={run.stats.medium}
            tone="warning"
          />
          <StatCard
            label="Düşük Risk"
            value={run.stats.low}
            tone="success"
          />
        </section>

        {/* Filter strip */}
        <section className="flex items-center gap-2 flex-wrap mb-5">
          {RISK_FILTERS.map((f) => {
            const Icon = f.icon;
            const count =
              f.key === "all"
                ? run.stats.total
                : f.key === "high"
                  ? run.stats.high
                  : f.key === "medium"
                    ? run.stats.medium
                    : run.stats.low;
            const active = risk === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setRisk(f.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-all
                  ${
                    active
                      ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                      : "bg-workspace-surface text-text-secondary border-workspace-border hover:border-accent-primary/30 hover:text-text-primary"
                  }`}
              >
                <Icon size={14} />
                {f.label}
                <span className="text-xs font-mono opacity-75">({count})</span>
              </button>
            );
          })}
        </section>

        {/* Findings */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-10 text-center">
            <p className="text-text-secondary">
              Bu filtre için fark yok.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((f) => (
              <li key={f.id}>
                <FindingCard finding={f} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </CompareLayout>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "danger" | "warning" | "success";
}) {
  const toneClass = {
    neutral: "border-workspace-border bg-workspace-surface",
    danger: "border-accent-danger/30 bg-accent-danger/[0.05]",
    warning: "border-accent-warning/30 bg-accent-warning/[0.05]",
    success: "border-accent-success/30 bg-accent-success/[0.05]",
  }[tone];
  const textClass = {
    neutral: "text-text-primary",
    danger: "text-accent-danger",
    warning: "text-accent-warning",
    success: "text-accent-success",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-mono font-semibold tracking-widest uppercase text-text-tertiary mb-1">
        {label}
      </div>
      <div className={`font-display text-3xl font-bold ${textClass}`}>
        {value}
      </div>
    </div>
  );
}
