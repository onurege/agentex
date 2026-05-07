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

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Newspaper, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { TopicChips } from "@/components/regulations/TopicChips";
import { RegulationCard } from "@/components/regulations/RegulationCard";
import { DEFAULT_TOPIC_FILTER } from "@/lib/regulations/topics";
import { PARAM_GROUP_COMPANIES } from "@/lib/regulations/companies";
import type {
  RegulationFeedResponse,
  RegulationItemDTO,
  RegulationPriority,
  RegulationSourceTool,
} from "@/lib/regulations/types";
import { SOURCE_TOOL_LABEL } from "@/lib/regulations/types";

type FeedView = "mevzuat" | "haberler";

const SOURCE_TOOL_ORDER: RegulationSourceTool[] = [
  "bedesten",
  "anayasa-norm",
  "anayasa-bireysel",
  "kvkk",
  "bddk",
  "gib",
  "rekabet",
  "resmi-gazete",
];

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
  const [sourceTools, setSourceTools] = useState<Set<RegulationSourceTool>>(
    () => new Set(),
  );
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "pinned">("all");
  const [feedView, setFeedView] = useState<FeedView>("mevzuat");
  // Boş set = "Hepsi" — UI'da Hepsi butonu basıldığında temizlenir.
  const [companyFilter, setCompanyFilter] = useState<Set<string>>(
    () => new Set(),
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("view", feedView);
    if (feedView === "mevzuat") {
      if (topicFilter.size > 0) {
        params.set("topics", Array.from(topicFilter).join(","));
      }
      if (priorityFloor !== "all") {
        params.set("priority", priorityFloor);
      }
      if (sourceTools.size > 0) {
        params.set("sourceTool", Array.from(sourceTools).join(","));
      }
    } else if (companyFilter.size > 0) {
      params.set("companies", Array.from(companyFilter).join(","));
    }
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (viewMode === "pinned") {
      params.set("pinned", "1");
    }
    params.set("limit", "100");
    return params.toString();
  }, [
    feedView,
    topicFilter,
    priorityFloor,
    sourceTools,
    search,
    viewMode,
    companyFilter,
  ]);

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
      const pruned = r?.pruned ?? 0;
      const prunedLine =
        pruned > 0 ? ` · ${pruned} eski kayıt temizlendi` : "";
      setScanNotice(
        `Tarama tamam: ${added} yeni, ${updated} güncellendi${prunedLine}.`,
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

  const toggleSourceTool = (id: RegulationSourceTool) => {
    setSourceTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCompany = (id: string) => {
    setCompanyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const lastScannedLabel = lastScannedAt
    ? new Date(lastScannedAt).toLocaleString("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "henüz tarama yapılmadı";

  const activeFilterCount =
    feedView === "mevzuat"
      ? (priorityFloor !== "all" ? 1 : 0) +
        sourceTools.size +
        (search.trim() ? 1 : 0)
      : companyFilter.size + (search.trim() ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    if (feedView === "mevzuat") {
      setPriorityFloor("all");
      setSourceTools(new Set());
      setTopicFilter(new Set(DEFAULT_TOPIC_FILTER));
    } else {
      setCompanyFilter(new Set());
    }
  };

  return (
    <AppShell activePath="/app/regulations">
      <div className="px-12 py-8">
        {/* 12-kolon grid: solda sticky filtre raylı (üstten başlar),
            sağda başlık + banner'lar + kart akışı */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3 lg:sticky lg:top-6 self-start space-y-5">
            {/* Arama */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              />
              <input
                type="search"
                placeholder="Başlık veya özet…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-workspace-surface border border-workspace-border text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              />
            </div>

            {feedView === "mevzuat" ? (
              <>
                <FilterSection title="Öncelik">
                  <select
                    value={priorityFloor}
                    onChange={(e) =>
                      setPriorityFloor(
                        e.target.value as RegulationPriority | "all",
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg text-sm bg-workspace-surface border border-workspace-border text-text-secondary"
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
                </FilterSection>

                <FilterSection title="Kaynak">
                  <div className="flex flex-wrap gap-1.5">
                    {SOURCE_TOOL_ORDER.map((id) => {
                      const active = sourceTools.has(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleSourceTool(id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            active
                              ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                              : "bg-workspace-surface border-workspace-border text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {SOURCE_TOOL_LABEL[id]}
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>

                <FilterSection title="Konu">
                  <TopicChips selected={topicFilter} onToggle={toggleTopic} />
                </FilterSection>
              </>
            ) : (
              <FilterSection title="Şirket">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCompanyFilter(new Set())}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      companyFilter.size === 0
                        ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                        : "bg-workspace-surface border-workspace-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Hepsi
                  </button>
                  {PARAM_GROUP_COMPANIES.map((c) => {
                    const active = companyFilter.has(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCompany(c.id)}
                        title={c.description}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                          active
                            ? "bg-accent-primary/10 border-accent-primary/40 text-accent-primary"
                            : "bg-workspace-surface border-workspace-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {c.displayName}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>
            )}

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-text-tertiary hover:text-text-secondary border border-dashed border-workspace-border hover:bg-workspace-elevated/50 transition-colors"
              >
                Filtreleri sıfırla ({activeFilterCount})
              </button>
            )}
          </aside>

          <main className="lg:col-span-9 min-w-0">
            <div className="flex items-center gap-1 p-1 mb-5 rounded-lg bg-workspace-elevated/60 border border-workspace-border w-fit">
              {(
                [
                  { id: "mevzuat", label: "Mevzuat", icon: ShieldAlert },
                  { id: "haberler", label: "Haberler", icon: Newspaper },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = feedView === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFeedView(id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "bg-workspace-surface text-text-primary shadow-sm"
                        : "text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>

            <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 mb-3 text-[11px] font-mono font-semibold tracking-wider uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
                  {feedView === "mevzuat" ? (
                    <>
                      <ShieldAlert size={12} />
                      Mevzuat Takibi
                    </>
                  ) : (
                    <>
                      <Newspaper size={12} />
                      Grup Haberleri
                    </>
                  )}
                </div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
                  {feedView === "mevzuat"
                    ? "Param Grubu'nu ilgilendiren düzenlemeler"
                    : "Param Grubu şirketlerinin haberleri"}
                </h1>
                <p className="text-sm text-text-tertiary mt-1">
                  <span className="font-mono uppercase tracking-wide text-[11px] mr-2">
                    Son tarama
                  </span>
                  {lastScannedLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-workspace-elevated/60 border border-workspace-border">
                  {(["all", "pinned"] as const).map((v) => {
                    const active = viewMode === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setViewMode(v)}
                        className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          active
                            ? "bg-workspace-surface text-text-primary shadow-sm"
                            : "text-text-tertiary hover:text-text-secondary"
                        }`}
                      >
                        {v === "all" ? "Hepsi" : "Sabitlediklerim"}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => void triggerScan()}
                  disabled={scanning}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {scanning ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {scanning ? "Taranıyor…" : "Şimdi Tara"}
                </button>
              </div>
            </header>

            {(scanNotice || error) && (
              <div className="space-y-2 mb-4">
                {scanNotice && (
                  <div className="rounded-lg border border-accent-success/30 bg-accent-success/[0.06] px-4 py-3 text-sm text-accent-success">
                    {scanNotice}
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/[0.06] px-4 py-3 text-sm text-accent-danger">
                    {error}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-text-tertiary">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Yükleniyor…
                  </span>
                ) : (
                  <>
                    <span className="text-text-primary font-medium">
                      {total}
                    </span>{" "}
                    kayıt
                    {total !== items.length && (
                      <span className="text-text-tertiary">
                        {" "}
                        · {items.length} gösteriliyor
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {items.length === 0 && !loading ? (
              <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated/40 p-12 text-center">
                <p className="font-display text-lg font-semibold text-text-primary mb-1">
                  {viewMode === "pinned"
                    ? "Henüz sabitlenmiş kayıt yok"
                    : feedView === "mevzuat"
                    ? "Henüz mevzuat kaydı yok"
                    : "Henüz haber kaydı yok"}
                </p>
                <p className="text-sm text-text-secondary max-w-md mx-auto">
                  {viewMode === "pinned"
                    ? "Listede karşılaştığın önemli kayıtları kart üzerindeki pin ikonuyla işaretle; burada toplanır."
                    : feedView === "mevzuat"
                    ? '"Şimdi Tara" butonuyla canlı kaynaklardan ilgili mevzuat kayıtlarını çek.'
                    : '"Şimdi Tara" butonu Google Haberler\'den grup şirketleriyle ilgili son haberleri çeker.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 auto-rows-fr">
                {items.map((item) => (
                  <RegulationCard
                    key={item.id}
                    item={item}
                    onTogglePinned={handleTogglePin}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </AppShell>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
