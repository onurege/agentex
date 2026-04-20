"use client";

import { useState, useEffect } from "react";
import { PermissionGate } from "@/components/control-room/PermissionGate";
import {
  getAuditEvents,
  ACTION_LABELS,
  TARGET_TYPE_LABELS,
  type AuditEvent,
  type AuditAction,
  type AuditTargetType,
} from "@/lib/audit-log";

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [mounted, setMounted] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");

  useEffect(() => {
    setEvents(getAuditEvents());
    setMounted(true);
  }, []);

  // Filter
  let filtered = events;
  if (actionFilter !== "all") {
    filtered = filtered.filter((e) => e.action === actionFilter);
  }
  if (targetFilter !== "all") {
    filtered = filtered.filter((e) => e.targetType === targetFilter);
  }

  return (
    <PermissionGate require="canViewAudit">
      <div>
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Audit Log</h1>
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

            {(actionFilter !== "all" || targetFilter !== "all") && (
              <button
                onClick={() => { setActionFilter("all"); setTargetFilter("all"); }}
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
                    </div>
                    <p className="text-[14px] text-text-secondary truncate">{evt.summary}</p>
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
