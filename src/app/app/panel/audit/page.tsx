"use client";

import { useState, useEffect } from "react";
import { PermissionGate } from "@/components/control-room/PermissionGate";
import {
  getAuditEvents,
  ACTION_LABELS,
  TARGET_TYPE_LABELS,
  MODULE_LABELS,
  type AuditEvent,
  type AuditAction,
  type AuditTargetType,
  type AuditModule,
} from "@/lib/audit-log";
import { getPersistenceAdapter } from "@/lib/persistence/factory";

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    getPersistenceAdapter()
      .then((adapter) => adapter.audit.list({ limit: 500 }))
      .then((remoteEvents) => {
        if (!active) return;
        const localEvents = getAuditEvents();
        const remoteIds = new Set(remoteEvents.map((event) => event.id));
        const merged = [
          ...(remoteEvents as AuditEvent[]),
          ...localEvents.filter((event) => !remoteIds.has(event.id)),
        ].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setEvents(merged);
      })
      .catch(() => {
        if (active) setEvents(getAuditEvents());
      })
      .finally(() => {
        if (active) setMounted(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Filter
  let filtered = events;
  if (actionFilter !== "all") {
    filtered = filtered.filter((e) => e.action === actionFilter);
  }
  if (targetFilter !== "all") {
    filtered = filtered.filter((e) => e.targetType === targetFilter);
  }
  if (moduleFilter !== "all") {
    filtered = filtered.filter((e) => e.module === moduleFilter);
  }

  return (
    <PermissionGate require="canViewAudit">
      <div>
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Denetim Günlüğü</h1>
          <p className="text-lg text-text-secondary">
            Sistem işlem geçmişi ve değişiklik kayıtları. {mounted && `${events.length} kayıt`}
          </p>
        </div>

        {/* Filters */}
        {mounted && events.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-base min-h-[44px] focus:outline-none focus:border-accent-primary/40"
            >
              <option value="all">Tüm Aksiyonlar</option>
              {(Object.keys(ACTION_LABELS) as AuditAction[]).map((key) => (
                <option key={key} value={key}>{ACTION_LABELS[key]}</option>
              ))}
            </select>

            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-base min-h-[44px] focus:outline-none focus:border-accent-primary/40"
            >
              <option value="all">Tüm Nesneler</option>
              {(Object.keys(TARGET_TYPE_LABELS) as AuditTargetType[]).map((key) => (
                <option key={key} value={key}>{TARGET_TYPE_LABELS[key]}</option>
              ))}
            </select>

            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-base min-h-[44px] focus:outline-none focus:border-accent-primary/40"
            >
              <option value="all">Tüm Modüller</option>
              {(Object.keys(MODULE_LABELS) as AuditModule[]).map((key) => (
                <option key={key} value={key}>{MODULE_LABELS[key]}</option>
              ))}
            </select>

            {(actionFilter !== "all" || targetFilter !== "all" || moduleFilter !== "all") && (
              <button
                onClick={() => { setActionFilter("all"); setTargetFilter("all"); setModuleFilter("all"); }}
                className="px-3 py-2 rounded-lg text-[14px] text-text-muted hover:text-text-secondary transition-colors"
              >
                Filtreleri Temizle
              </button>
            )}
          </div>
        )}

        {/* Log entries */}
        {!mounted ? (
          <div className="text-base text-text-muted py-8">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-workspace-surface border border-workspace-border p-10">
            <div className="flex flex-col items-center justify-center text-center py-8">
              <span className="text-4xl mb-4">📄</span>
              <p className="text-lg font-medium text-text-primary mb-1">
                {events.length === 0 ? "Henüz log kaydı bulunmuyor" : "Filtrelerle eşleşen kayıt yok"}
              </p>
              <p className="text-base text-text-muted max-w-md">
                {events.length === 0
                  ? "CV düzenleme, prompt yayınlama ve çalıştırma gibi işlemler burada loglanacak."
                  : "Farklı filtreler deneyin."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((evt) => {
              const actionLabel = ACTION_LABELS[evt.action] ?? evt.action;
              const targetLabel = TARGET_TYPE_LABELS[evt.targetType] ?? evt.targetType;
              const moduleLabel = evt.module
                ? MODULE_LABELS[evt.module as AuditModule] ?? evt.module
                : "Sistem";
              const actorLabel = evt.actorName ?? evt.actorEmail ?? evt.actor ?? "system";
              const date = new Date(evt.timestamp);

              return (
                <div
                  key={evt.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl bg-workspace-surface border border-workspace-border"
                >
                  {/* Action icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg ${
                    evt.action.includes("published") || evt.action === "cv_published"
                      ? "bg-accent-success/10"
                      : evt.action === "run_deleted"
                        ? "bg-accent-danger/10"
                        : "bg-workspace-elevated"
                  }`}>
                    {evt.action.includes("cv") ? "👤" :
                     evt.action.includes("prompt") ? "📝" :
                     evt.action.includes("run") ? "📋" :
                     evt.action.includes("template") ? "📑" : "📄"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[15px] font-semibold text-text-primary">{actionLabel}</span>
                      <span className="text-[12px] font-mono text-text-muted bg-workspace-elevated px-1.5 py-0.5 rounded">
                        {targetLabel}
                      </span>
                      <span className="text-[12px] font-mono text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded">
                        {moduleLabel}
                      </span>
                      {evt.severity && evt.severity !== "info" ? (
                        <span className="text-[12px] font-mono text-accent-warning bg-accent-warning/10 px-1.5 py-0.5 rounded">
                          {evt.severity}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[14px] text-text-secondary truncate">{evt.summary}</p>
                    <p className="mt-1 text-[12px] text-text-muted truncate">
                      İşlemi yapan: <span className="font-medium text-text-secondary">{actorLabel}</span>
                    </p>
                    <AuditMetadataDetails event={evt} />
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0">
                    <p className="text-[14px] text-text-secondary">{date.toLocaleDateString("tr-TR")}</p>
                    <p className="text-[13px] text-text-muted">{date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}

function AuditMetadataDetails({ event }: { event: AuditEvent }) {
  if (event.action !== "signature_compared") return null;

  const metadata = event.metadata ?? {};
  const verdict = typeof metadata.verdict === "string" ? metadata.verdict : null;
  const confidence =
    typeof metadata.confidence === "number" ? metadata.confidence : null;
  const specimenCount =
    typeof metadata.specimenCount === "number" ? metadata.specimenCount : null;
  const signals = isSignalRecord(metadata.signals) ? metadata.signals : null;

  if (!verdict && confidence === null && !signals) return null;

  const verdictLabel =
    verdict === "match"
      ? "Eşleşiyor"
      : verdict === "borderline"
        ? "Sınırda"
        : verdict === "no_match"
          ? "Eşleşmiyor"
          : verdict;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {verdictLabel ? (
        <AuditMetric label="Sonuç" value={verdictLabel} tone={verdict === "match" ? "success" : verdict === "no_match" ? "danger" : "warning"} />
      ) : null}
      {confidence !== null ? (
        <AuditMetric label="Güven" value={`%${Math.round(confidence * 100)}`} />
      ) : null}
      {specimenCount !== null ? (
        <AuditMetric label="Örnek" value={`${specimenCount}`} />
      ) : null}
      {signals ? (
        <>
          <AuditMetric label="SSIM" value={`%${Math.round(signals.ssim * 100)}`} />
          <AuditMetric label="pHash" value={`${signals.phashHamming} / 64`} />
          <AuditMetric label="En-boy farkı" value={`%${Math.round(signals.aspectRatioDelta * 100)}`} />
          <AuditMetric label="Mürekkep farkı" value={`%${Math.round(signals.inkDensityDelta * 100)}`} />
        </>
      ) : null}
    </div>
  );
}

function AuditMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-accent-success/25 bg-accent-success/10 text-accent-success"
      : tone === "warning"
        ? "border-accent-warning/25 bg-accent-warning/10 text-accent-warning"
        : tone === "danger"
          ? "border-accent-danger/25 bg-accent-danger/10 text-accent-danger"
          : "border-workspace-border bg-workspace-elevated text-text-secondary";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] ${toneClass}`}>
      <span className="font-mono uppercase tracking-wider text-[10px] opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function isSignalRecord(value: unknown): value is {
  ssim: number;
  phashHamming: number;
  aspectRatioDelta: number;
  inkDensityDelta: number;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.ssim === "number" &&
    typeof record.phashHamming === "number" &&
    typeof record.aspectRatioDelta === "number" &&
    typeof record.inkDensityDelta === "number"
  );
}
