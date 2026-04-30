"use client";

// ============================================================
// /app/regulations — Mevzuat Takibi
// ============================================================
//
// DB-backed feed; sayfa açılışında /api/regulations çağırır,
// "Şimdi Tara" butonu /api/regulations/scan'a POST atar. Filtreler
// URL search params'a yansıtılmaz (basit MVP); Faz 2'de paylaşılabilir
// link için param sync düşünülebilir.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { RegulationsLayout } from "@/components/regulations/RegulationsLayout";
import { TopicChips } from "@/components/regulations/TopicChips";
import { RegulationCard } from "@/components/regulations/RegulationCard";
import { DEFAULT_TOPIC_FILTER } from "@/lib/regulations/topics";
import type {
  RegulationFeedResponse,
  RegulationItemDTO,
  RegulationPriority,
} from "@/lib/regulations/types";

const PRIORITY_LABEL: Record<RegulationPriority | "all", string> = {
  all: "Tüm öncelikler",
  critical: "Kritik+",
  high: "Yüksek+",
  medium: "Orta+",
  low: "Düşük+",
};

export default function RegulationsPage() {
  const [items, setItems] = useState<RegulationItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const [topicFilter, setTopicFilter] = useState<Set<string>>(
    () => new Set(DEFAULT_TOPIC_FILTER),
  );
  const [priorityFloor, setPriorityFloor] = useState<
    RegulationPriority | "all"
  >("all");
  const [search, setSearch] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (topicFilter.size > 0) {
      params.set("topics", Array.from(topicFilter).join(","));
    }
    if (priorityFloor !== "all") {
      params.set("priority", priorityFloor);
    }
    if (search.trim()) {
      params.set("search", search.trim());
    }
    params.set("limit", "100");
    return params.toString();
  }, [topicFilter, priorityFloor, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/regulations?${queryString}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RegulationFeedResponse;
      setItems(data.items);
      setTotal(data.total);
      setLastScannedAt(data.lastScannedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const triggerScan = useCallback(async () => {
    setScanning(true);
    setScanNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/regulations/scan", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          `Tarama başarısız (HTTP ${res.status}).`;
        throw new Error(msg);
      }
      const r = data?.result;
      const added = r?.added ?? 0;
      const updated = r?.updated ?? 0;
      setScanNotice(
        `Tarama tamam: ${added} yeni, ${updated} güncellendi.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarama başarısız.");
    } finally {
      setScanning(false);
    }
  }, [load]);

  const handleTogglePin = useCallback(
    async (id: string, pinned: boolean) => {
      // Optimistic update
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, pinned } : it)),
      );
      try {
        const res = await fetch(`/api/regulations/${id}/read`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        // Revert on failure
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, pinned: !pinned } : it)),
        );
      }
    },
    [],
  );

  const toggleTopic = (topicId: string) => {
    setTopicFilter((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const lastScannedLabel = lastScannedAt
    ? new Date(lastScannedAt).toLocaleString("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "henüz tarama yapılmadı";

  return (
    <RegulationsLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-mono font-semibold tracking-wider uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
            <ShieldAlert size={12} />
            Mevzuat Takibi
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3 tracking-tight">
            Param Grubu&apos;nu ilgilendiren güncel düzenlemeler
          </h1>
          <p className="text-base text-text-secondary max-w-2xl leading-relaxed">
            E-para, ödeme hizmetleri, MASAK, KVKK, vergi ve şirket
            mevzuatından son düzenlemeler. Otomatik takip değildir; her
            yayım hukuki tavsiye değil bilgilendirme amaçlıdır.
          </p>
        </header>

        <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="text-sm text-text-secondary">
              <span className="font-mono uppercase tracking-wide text-text-tertiary text-xs mr-2">
                Son tarama
              </span>
              {lastScannedLabel}
            </div>
            <button
              type="button"
              onClick={() => void triggerScan()}
              disabled={scanning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {scanning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {scanning ? "Taranıyor…" : "Şimdi Tara"}
            </button>
          </div>

          <div className="space-y-4">
            <TopicChips selected={topicFilter} onToggle={toggleTopic} />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={priorityFloor}
                onChange={(e) =>
                  setPriorityFloor(
                    e.target.value as RegulationPriority | "all",
                  )
                }
                className="px-3 py-2 rounded-lg text-sm bg-workspace-surface border border-workspace-border text-text-secondary"
              >
                {(
                  Object.keys(PRIORITY_LABEL) as Array<
                    RegulationPriority | "all"
                  >
                ).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  type="search"
                  placeholder="Başlık veya özet içinde ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-workspace-surface border border-workspace-border text-text-primary placeholder:text-text-tertiary"
                />
              </div>
            </div>
          </div>
        </section>

        {scanNotice && (
          <div className="rounded-lg border border-accent-success/30 bg-accent-success/[0.06] px-4 py-3 mb-4 text-sm text-accent-success">
            {scanNotice}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/[0.06] px-4 py-3 mb-4 text-sm text-accent-danger">
            {error}
          </div>
        )}

        <div className="text-sm text-text-tertiary mb-3">
          {loading
            ? "Yükleniyor…"
            : `${total} kayıt — ${items.length} gösteriliyor`}
        </div>

        <div className="space-y-3">
          {items.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated p-8 text-center">
              <p className="font-display text-lg font-semibold text-text-primary mb-1">
                Henüz mevzuat kaydı yok
              </p>
              <p className="text-sm text-text-secondary">
                &quot;Şimdi Tara&quot; butonuyla canlı kaynaklardan
                ilgili mevzuat kayıtlarını çekin.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <RegulationCard
                key={item.id}
                item={item}
                onTogglePinned={handleTogglePin}
              />
            ))
          )}
        </div>
      </div>
    </RegulationsLayout>
  );
}
