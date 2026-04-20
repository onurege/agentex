"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BOARDROOM_AGENTS } from "@/lib/boardroom-agents";
import { CHIEF_AGENT } from "@/lib/boardroom-flow-store";
import { getDashboardMetrics, type DashboardMetrics } from "@/lib/dashboard-metrics";
import { getBoardroomRuns } from "@/lib/run-history";
import { getRecentAuditEvents, ACTION_LABELS, type AuditEvent } from "@/lib/audit-log";

export default function ControlRoomDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentRuns, setRecentRuns] = useState<Array<{ id: string; name: string; date: string; risk: string }>>([]);
  const [recentAudit, setRecentAudit] = useState<AuditEvent[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMetrics(getDashboardMetrics());
    const runs = getBoardroomRuns().slice(0, 5);
    setRecentRuns(runs.map((r) => ({ id: r.id, name: r.documentName, date: r.createdAt, risk: r.verdictSeed.riskLevel })));
    setRecentAudit(getRecentAuditEvents(8));
    setMounted(true);
  }, []);

  const totalAgents = BOARDROOM_AGENTS.length + 1;

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Dashboard</h1>
        <p className="text-lg text-text-secondary">Sistem genel durumu ve hızlı erişim.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
        <Link href="/app/panel/runs">
          <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6 hover:border-accent-primary/20 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📋</span>
              <span className="text-base text-text-secondary font-medium">Toplam Çalıştırma</span>
            </div>
            <p className="text-4xl font-bold text-text-primary">{mounted ? metrics?.totalRuns ?? 0 : "—"}</p>
            {mounted && metrics && metrics.aiRuns > 0 && (
              <p className="text-[13px] text-text-muted mt-2">{metrics.aiRuns} AI · {metrics.fallbackRuns} Fallback</p>
            )}
          </div>
        </Link>

        <Link href="/app/panel/agents">
          <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6 hover:border-accent-primary/20 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">👥</span>
              <span className="text-base text-text-secondary font-medium">Toplam Ajan</span>
            </div>
            <p className="text-4xl font-bold text-text-primary">{totalAgents}</p>
            {mounted && metrics && metrics.customizedAgents > 0 && (
              <p className="text-[13px] text-text-muted mt-2">{metrics.customizedAgents} özel CV</p>
            )}
          </div>
        </Link>

        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📝</span>
            <span className="text-base text-text-secondary font-medium">Yayınlı Prompt</span>
          </div>
          <p className="text-4xl font-bold text-text-primary">{mounted ? metrics?.publishedPrompts ?? 0 : "—"}</p>
        </div>

        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🕐</span>
            <span className="text-base text-text-secondary font-medium">Son Çalıştırma</span>
          </div>
          <p className="text-xl font-bold text-text-primary">
            {mounted && metrics?.lastRunDate
              ? new Date(metrics.lastRunDate).toLocaleDateString("tr-TR")
              : "—"}
          </p>
          {mounted && metrics?.lastRunDate && (
            <p className="text-[13px] text-text-muted mt-1">
              {new Date(metrics.lastRunDate).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {/* Two-column: Recent Runs + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Recent Runs */}
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold text-text-primary">Son Çalıştırmalar</h2>
            <Link href="/app/panel/runs" className="text-[14px] font-medium text-accent-primary hover:text-accent-secondary transition-colors">
              Tümünü Gör →
            </Link>
          </div>

          {recentRuns.length === 0 ? (
            <p className="text-base text-text-muted py-6 text-center">Henüz çalıştırma yok.</p>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <Link key={run.id} href={`/app/runs/${run.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-workspace-bg/50 hover:bg-workspace-elevated/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-text-primary truncate">{run.name}</p>
                      <p className="text-[13px] text-text-muted">
                        {new Date(run.date).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                    <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${
                      run.risk === "high" ? "text-accent-danger bg-accent-danger/10"
                      : run.risk === "low" ? "text-accent-success bg-accent-success/10"
                      : "text-accent-warning bg-accent-warning/10"
                    }`}>
                      {run.risk === "high" ? "Yüksek" : run.risk === "low" ? "Düşük" : "Orta"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
          <h2 className="text-xl font-semibold text-text-primary mb-5">Son Aktiviteler</h2>
          {recentAudit.length === 0 ? (
            <p className="text-base text-text-muted py-6 text-center">Henüz aktivite kaydı yok.</p>
          ) : (
            <div className="space-y-3">
              {recentAudit.map((evt) => (
                <div key={evt.id} className="flex items-start gap-3 p-3 rounded-lg bg-workspace-bg/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-text-primary">
                      {ACTION_LABELS[evt.action] ?? evt.action}
                    </p>
                    <p className="text-[13px] text-text-secondary truncate">{evt.summary}</p>
                  </div>
                  <span className="text-[12px] text-text-muted shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
