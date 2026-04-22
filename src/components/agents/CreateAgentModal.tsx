"use client";

// ============================================================
// Create Custom Agent Modal
// ============================================================
//
// Minimum-viable form to spawn a user-owned agent. Detail editing
// (CV fields, system prompt, guardrails) continues on the existing
// /app/panel/agents/{id}/cv + /prompt pages; this modal just lands
// the agent in the store so those pages have something to edit.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useControlRoomStore } from "@/lib/control-room-store";

interface CreateAgentModalProps {
  open: boolean;
  onClose: () => void;
}

const MAX_EXPERTISE = 8;

function slugify(raw: string): string {
  const folded = raw
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
  return folded
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateAgentModal({ open, onClose }: CreateAgentModalProps) {
  const router = useRouter();
  const createCustomAgent = useControlRoomStore((s) => s.createCustomAgent);

  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [tone, setTone] = useState("");
  const [expertiseInput, setExpertiseInput] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Auto-derive slug from name until the user takes control
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  // Focus first field + ESC-to-close
  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setTitle("");
    setAvatar("🤖");
    setTone("");
    setExpertiseInput("");
    setExpertise([]);
    setError(null);
    setSubmitting(false);
  }, [open]);

  const addExpertise = useCallback(() => {
    const v = expertiseInput.trim();
    if (!v) return;
    if (expertise.includes(v)) {
      setExpertiseInput("");
      return;
    }
    if (expertise.length >= MAX_EXPERTISE) return;
    setExpertise((xs) => [...xs, v]);
    setExpertiseInput("");
  }, [expertiseInput, expertise]);

  const removeExpertise = useCallback((tag: string) => {
    setExpertise((xs) => xs.filter((x) => x !== tag));
  }, []);

  const onSubmit = useCallback(async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await createCustomAgent({
      id: slug,
      name,
      title,
      avatar,
      expertise,
      tone: tone || undefined,
    });
    if (!result.ok) {
      const msg =
        result.error === "invalid_id"
          ? "Kimlik yalnızca küçük harf, rakam ve tire içerebilir (ör. 'ik-uzmani')."
          : result.error === "id_taken"
            ? "Bu kimlik zaten kullanılıyor. Başka bir değer seçin."
            : "İsim, unvan, avatar ve en az bir uzmanlık alanı gerekli.";
      setError(msg);
      setSubmitting(false);
      return;
    }
    router.push(`/app/panel/agents/${result.agent.id}/cv`);
    onClose();
  }, [
    submitting,
    createCustomAgent,
    slug,
    name,
    title,
    avatar,
    expertise,
    tone,
    router,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-workspace-surface border border-workspace-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-workspace-border">
          <h2 className="font-display text-2xl font-bold text-text-primary mb-1">
            Yeni Ajan Oluştur
          </h2>
          <p className="text-sm text-text-secondary">
            Temel bilgileri girin; detaylı CV ve prompt ayarlarını oluşturduktan
            sonra düzenleyeceksiniz.
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Tam İsim
            </label>
            <input
              ref={firstFieldRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. İnsan Kaynakları Uzmanı"
              className="w-full px-3.5 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Kimlik (slug)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="ik-uzmani"
              className="w-full px-3.5 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary font-mono text-sm"
            />
            <p className="text-xs text-text-tertiary mt-1.5">
              URL&apos;de ve veri kayıtlarında bu kimlik kullanılır. Küçük
              harf, rakam ve tire.
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Unvan
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. İK Direktörü"
              className="w-full px-3.5 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Avatar (Emoji)
            </label>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              maxLength={4}
              className="w-20 px-3 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-2xl text-center focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Expertise */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Uzmanlık Alanları
              <span className="text-xs font-normal text-text-tertiary ml-2">
                (3-5 öneririz)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExpertise();
                  }
                }}
                placeholder="Örn. Çalışan ilişkileri"
                className="flex-1 px-3.5 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary"
              />
              <button
                type="button"
                onClick={addExpertise}
                disabled={
                  !expertiseInput.trim() || expertise.length >= MAX_EXPERTISE
                }
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50 hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Ekle
              </button>
            </div>
            {expertise.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {expertise.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm bg-accent-primary/10 text-accent-primary border border-accent-primary/20"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeExpertise(tag)}
                      className="text-accent-primary/60 hover:text-accent-primary"
                      aria-label={`${tag} sil`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Tone (optional) */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Ton
              <span className="text-xs font-normal text-text-tertiary ml-2">
                (opsiyonel)
              </span>
            </label>
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Örn. Profesyonel ve empatik"
              className="w-full px-3.5 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-primary"
            />
          </div>

          {error ? (
            <div className="px-3.5 py-2.5 rounded-lg bg-accent-danger/10 border border-accent-danger/20 text-sm text-accent-danger">
              {error}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-workspace-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50 hover:text-text-primary transition-colors"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-workspace-surface border border-accent-primary hover:bg-accent-secondary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Oluşturuluyor…" : "Oluştur ve Detayları Düzenle"}
          </button>
        </div>
      </div>
    </div>
  );
}
