"use client";

// /app/panel/support — super_admin destek talepleri inbox'ı.
// Open / resolved sekmesi, tek panel detay görüntüleme + resolved
// işaretleme.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

interface SupportTicketDTO {
  id: string;
  title: string;
  content: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

interface ListResponse {
  tickets: SupportTicketDTO[];
  summary: { open: number; resolved: number };
}

export default function SupportInboxPage() {
  const [tickets, setTickets] = useState<SupportTicketDTO[]>([]);
  const [summary, setSummary] = useState({ open: 0, resolved: 0 });
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    if (filter === "all") return "";
    return `?status=${filter}`;
  }, [filter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/support${queryString}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ListResponse;
      setTickets(data.tickets);
      setSummary(data.summary);
      if (data.tickets.length > 0 && !selectedId) {
        setSelectedId(data.tickets[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme başarısız.");
    } finally {
      setLoading(false);
    }
  }, [queryString, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, status: "open" | "resolved") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/support/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Güncellenemedi.");
    } finally {
      setBusyId(null);
    }
  };

  const selectedTicket =
    tickets.find((t) => t.id === selectedId) ?? tickets[0] ?? null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <div className="flex h-full">
      <div className="w-[360px] shrink-0 border-r border-workspace-border bg-workspace-surface flex flex-col">
        <header className="px-5 h-[72px] flex items-center justify-between border-b border-workspace-border/50">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-text-secondary" />
            <h1 className="font-display text-lg font-semibold text-text-primary">
              Destek Talepleri
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-workspace-elevated transition-colors disabled:opacity-50"
            aria-label="Yenile"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
          </button>
        </header>

        <div className="px-3 pt-3 pb-2 flex items-center gap-1">
          {(
            [
              ["open", `Açık (${summary.open})`],
              ["resolved", `Çözüldü (${summary.resolved})`],
              ["all", "Tümü"],
            ] as const
          ).map(([v, label]) => {
            const active = filter === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent-primary/15 text-accent-primary"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-workspace-elevated"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {error && (
            <div className="mx-1 mt-2 rounded-lg border border-accent-danger/30 bg-accent-danger/[0.06] px-3 py-2 text-xs text-accent-danger">
              {error}
            </div>
          )}
          {tickets.length === 0 && !loading ? (
            <div className="px-3 py-12 text-center text-sm text-text-tertiary">
              Bu sekmede talep yok.
            </div>
          ) : (
            <ul className="space-y-1">
              {tickets.map((t) => {
                const isActive = selectedTicket?.id === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-workspace-elevated border border-workspace-border"
                          : "hover:bg-workspace-elevated/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider ${
                            t.status === "open"
                              ? "text-accent-warning"
                              : "text-accent-success"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              t.status === "open"
                                ? "bg-accent-warning"
                                : "bg-accent-success"
                            }`}
                          />
                          {t.status === "open" ? "Açık" : "Çözüldü"}
                        </span>
                        <span className="text-[10px] text-text-tertiary shrink-0">
                          {formatDate(t.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-text-primary line-clamp-1 mb-0.5">
                        {t.title}
                      </div>
                      <div className="text-xs text-text-tertiary line-clamp-1">
                        {t.user.email}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-workspace-bg">
        {selectedTicket ? (
          <div className="max-w-3xl mx-auto px-8 py-8">
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
                  selectedTicket.status === "open"
                    ? "bg-accent-warning/10 text-accent-warning border-accent-warning/30"
                    : "bg-accent-success/10 text-accent-success border-accent-success/30"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    selectedTicket.status === "open"
                      ? "bg-accent-warning"
                      : "bg-accent-success"
                  }`}
                />
                {selectedTicket.status === "open" ? "Açık" : "Çözüldü"}
              </span>
              <span className="text-xs text-text-tertiary">
                {formatDate(selectedTicket.createdAt)}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-text-primary tracking-tight mb-4">
              {selectedTicket.title}
            </h2>

            <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5 mb-6">
              <div className="text-xs font-mono uppercase tracking-wider text-text-tertiary mb-2">
                Gönderen
              </div>
              <div className="text-sm text-text-primary">
                {selectedTicket.user.name ?? selectedTicket.user.email}
                <span className="text-text-tertiary">
                  {" "}
                  · {selectedTicket.user.email} · {selectedTicket.user.role}
                </span>
              </div>
            </section>

            <section className="rounded-xl border border-workspace-border bg-workspace-surface p-6 mb-6">
              <div className="text-xs font-mono uppercase tracking-wider text-text-tertiary mb-3">
                İçerik
              </div>
              <p className="text-[15px] text-text-primary leading-[1.75] whitespace-pre-wrap">
                {selectedTicket.content}
              </p>
            </section>

            <div className="flex items-center gap-2">
              {selectedTicket.status === "open" ? (
                <button
                  type="button"
                  onClick={() => void updateStatus(selectedTicket.id, "resolved")}
                  disabled={busyId === selectedTicket.id}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-success text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {busyId === selectedTicket.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Çözüldü olarak işaretle
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void updateStatus(selectedTicket.id, "open")}
                  disabled={busyId === selectedTicket.id}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-workspace-border text-text-secondary hover:text-text-primary hover:bg-workspace-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {busyId === selectedTicket.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  Yeniden aç
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-text-tertiary">
            {loading ? "Yükleniyor…" : "Soldan bir talep seçin."}
          </div>
        )}
      </main>
    </div>
  );
}
