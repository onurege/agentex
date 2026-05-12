"use client";

// Kayıtlı prompt taslakları paneli — landing sayfasında ve panel
// ekranlarında ortak kullanılır. Kullanıcının kendisi + aynı grup
// kayıtları gelir; sahibi olmayan satırlar "Grup" rozetiyle gösterilir,
// silme butonu sadece sahibinde aktif olur.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Loader2, Sparkles, Trash2, Users } from "lucide-react";
import type { PromptDraftListItem } from "@/lib/draft-prompt/types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SavedPromptDraftList() {
  const [items, setItems] = useState<PromptDraftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/draft/prompt/saved", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PromptDraftListItem[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Bu kayıtlı taslak silinsin mi?")) return;
      try {
        const res = await fetch(`/api/draft/prompt/saved/${id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setItems((prev) => prev.filter((it) => it.id !== id));
      } catch (err) {
        alert(err instanceof Error ? err.message : "Silinemedi.");
      }
    },
    [],
  );

  return (
    <section className="mb-12">
      <header className="flex items-baseline justify-between mb-5">
        <h2 className="font-display text-xl font-semibold text-text-primary inline-flex items-center gap-2">
          <Sparkles size={16} className="text-accent-primary" />
          Kayıtlı Prompt Taslakları
        </h2>
        {items.length > 0 && (
          <span className="text-sm text-text-tertiary font-mono">
            {items.length} kayıt
          </span>
        )}
      </header>

      {loading && (
        <div className="inline-flex items-center gap-2 text-sm text-text-tertiary">
          <Loader2 size={14} className="animate-spin" /> Yükleniyor…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/[0.06] px-4 py-3 text-sm text-accent-danger">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-workspace-border bg-workspace-elevated/40 p-8 text-center">
          <p className="text-sm text-text-secondary">
            Henüz kayıtlı bir prompt taslağı yok. Sağ üstteki &ldquo;Prompt ile
            Başlat&rdquo; ile başlatın, sonra &ldquo;Kaydet ve Dön&rdquo; diyerek
            buraya bırakın.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <div className="group relative rounded-xl border border-workspace-border bg-workspace-surface p-5 hover:border-accent-primary/30 hover:shadow-medium transition-all">
                <Link
                  href={`/app/draft/prompt/saved/${item.id}`}
                  className="absolute inset-0 z-0 rounded-xl"
                  aria-label={`${item.title} taslağını aç`}
                />
                <header className="relative z-10 flex items-start justify-between mb-3 gap-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-text-tertiary">
                    <Clock size={12} />
                    {formatDate(item.updatedAt)}
                  </div>
                  {item.isOwner ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDelete(item.id);
                      }}
                      className="relative z-10 p-1.5 rounded-md text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
                      aria-label="Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-workspace-border bg-workspace-elevated text-text-secondary"
                      title={`Sahibi: ${item.ownerName}`}
                    >
                      <Users size={11} />
                      Grup
                    </span>
                  )}
                </header>

                <p className="font-display text-base font-semibold text-text-primary leading-snug mb-2 line-clamp-2">
                  {item.title}
                </p>
                <p className="text-xs text-text-tertiary mb-3">
                  {item.isOwner ? "Sen" : item.ownerName}
                </p>

                <footer className="relative z-10 inline-flex items-center gap-1 text-xs text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Aç <ArrowRight size={12} />
                </footer>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
