"use client";

// /app/support — Destek formu. Kullanıcı başlık + içerik yazar,
// /api/support'a gönderir; super_admin /app/panel/support inbox'ında
// görür.

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";

const TITLE_MAX = 140;
const CONTENT_MAX = 4000;

export default function SupportPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    title.trim().length > 0 && content.trim().length > 0 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            `Gönderim başarısız (HTTP ${res.status}).`,
        );
      }
      setSuccess(true);
      setTitle("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fef7ff] text-[#1d1a21]">
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-sm text-[#494552] hover:text-[#280064] mb-6"
        >
          <ArrowLeft size={14} /> Ana Sayfaya Dön
        </Link>

        <header className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-[#280064] tracking-tight mb-2">
            Destek
          </h1>
          <p className="text-base text-[#494552] leading-relaxed">
            Sorun, öneri veya talebini bize ilet — ekibimiz inceleyip
            geri dönüş yapacaktır.
          </p>
        </header>

        {success ? (
          <div className="rounded-[24px] border border-green-200 bg-green-50 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="shrink-0 mt-0.5 text-green-600"
                size={24}
              />
              <div className="flex-1">
                <p className="font-semibold text-green-900 mb-1">
                  Talebin alındı
                </p>
                <p className="text-sm text-green-800">
                  Ekibimiz en kısa sürede inceleyip geri dönüş yapacaktır.
                </p>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="mt-4 text-sm font-medium text-green-700 hover:text-green-900 underline-offset-2 hover:underline"
                >
                  Yeni talep gönder
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-[0_8px_32px_0_rgba(64,22,137,0.04)] backdrop-blur-xl space-y-5"
          >
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#494552] mb-2">
                Başlık
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder="Sorunu kısaca özetle"
                className="w-full px-4 py-3 rounded-xl border border-[#e7e0ea] bg-white text-sm text-[#1d1a21] placeholder:text-[#9b94a3] focus:outline-none focus:ring-2 focus:ring-[#401689]/30"
              />
              <div className="mt-1.5 text-right text-xs text-[#9b94a3]">
                {title.length} / {TITLE_MAX}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#494552] mb-2">
                İçerik
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={CONTENT_MAX}
                rows={10}
                placeholder="Yaşadığın sorunu, beklediğin davranışı ve mümkünse adımları detaylıca yaz."
                className="w-full px-4 py-3 rounded-xl border border-[#e7e0ea] bg-white text-sm text-[#1d1a21] placeholder:text-[#9b94a3] focus:outline-none focus:ring-2 focus:ring-[#401689]/30 resize-y min-h-[200px]"
              />
              <div className="mt-1.5 text-right text-xs text-[#9b94a3]">
                {content.length} / {CONTENT_MAX}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#401689] text-white hover:bg-[#280064] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-[#401689]/20"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {submitting ? "Gönderiliyor…" : "Talebi Gönder"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
