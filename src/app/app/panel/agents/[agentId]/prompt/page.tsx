"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBoardroomAgent, CHIEF_AGENT } from "@/lib/boardroom-agents";
import { useControlRoomStore, type AgentPromptData } from "@/lib/control-room-store";

const PROMPT_FIELDS: { key: keyof AgentPromptData; label: string; rows: number }[] = [
  { key: "systemPrompt", label: "System Prompt", rows: 5 },
  { key: "rolePrompt", label: "Role Prompt", rows: 4 },
  { key: "outputRules", label: "Output Rules", rows: 3 },
  { key: "guardrails", label: "Guardrails", rows: 3 },
];

export default function PromptStudioPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  // Include customAgents in the lookup so user-created agents resolve
  // the same way built-in ones do.
  const customAgents = useControlRoomStore((s) => s.customAgents);
  const agent =
    agentId === "chief-agent"
      ? CHIEF_AGENT
      : (getBoardroomAgent(agentId) ?? customAgents[agentId] ?? null);

  const getPromptDraft = useControlRoomStore((s) => s.getPromptDraft);
  const getPromptPublished = useControlRoomStore((s) => s.getPromptPublished);
  const savePromptDraft = useControlRoomStore((s) => s.savePromptDraft);
  const publishPrompt = useControlRoomStore((s) => s.publishPrompt);
  const rollbackPrompt = useControlRoomStore((s) => s.rollbackPrompt);
  const getProfile = useControlRoomStore((s) => s.getProfile);

  const [form, setForm] = useState<AgentPromptData>(() => getPromptDraft(agentId));
  const [isDirty, setIsDirty] = useState(false);
  const [flash, setFlash] = useState<"saved" | "published" | "rolledback" | null>(null);

  useEffect(() => {
    setForm(getPromptDraft(agentId));
    setIsDirty(false);
  }, [agentId, getPromptDraft]);

  const updateField = useCallback((field: keyof AgentPromptData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setFlash(null);
  }, []);

  const handleSave = useCallback(() => {
    savePromptDraft(agentId, form);
    setIsDirty(false);
    setFlash("saved");
    setTimeout(() => setFlash(null), 2500);
  }, [agentId, form, savePromptDraft]);

  const handlePublish = useCallback(() => {
    savePromptDraft(agentId, form);
    publishPrompt(agentId);
    setIsDirty(false);
    setFlash("published");
    setTimeout(() => setFlash(null), 2500);
  }, [agentId, form, savePromptDraft, publishPrompt]);

  const handleRollback = useCallback(() => {
    rollbackPrompt(agentId);
    setForm(getPromptDraft(agentId));
    setIsDirty(false);
    setFlash("rolledback");
    setTimeout(() => setFlash(null), 2500);
  }, [agentId, rollbackPrompt, getPromptDraft]);

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-2xl font-semibold text-text-primary mb-3">Ajan Bulunamadı</p>
        <Link href="/app/panel/agents" className="px-6 py-3 rounded-xl text-base font-semibold bg-accent-primary text-workspace-surface hover:bg-accent-secondary transition-colors">
          Agent Library&apos;ye Dön
        </Link>
      </div>
    );
  }

  const profile = getProfile(agentId);
  const hasPublished = profile.promptPublished !== null;
  const canRollback = hasPublished;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/app/panel/agents" className="text-text-muted hover:text-text-secondary transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
          <span className="text-xl">{agent.avatar}</span>
          <h1 className="font-display text-3xl font-bold text-text-primary">Prompt Studio</h1>
        </div>
        <p className="text-lg text-text-secondary">
          {agent.name} — prompt yapılandırması
        </p>
        <div className="flex items-center gap-3 mt-3">
          {hasPublished && (
            <span className="text-[13px] font-semibold text-accent-success bg-accent-success/10 px-3 py-1 rounded-full">
              Yayında · v{profile.promptVersion}
            </span>
          )}
          {!hasPublished && (
            <span className="text-[13px] font-semibold text-text-muted bg-workspace-elevated px-3 py-1 rounded-full">
              Taslak
            </span>
          )}
          {isDirty && (
            <span className="text-[13px] font-semibold text-accent-warning bg-accent-warning/10 px-3 py-1 rounded-full">
              Kaydedilmemiş Değişiklik
            </span>
          )}
        </div>
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left — Editor */}
        <div className="space-y-6">
          {PROMPT_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-base font-semibold text-text-primary mb-2">
                {field.label}
              </label>
              <textarea
                value={form[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
                rows={field.rows}
                className="w-full rounded-xl bg-workspace-bg border border-workspace-border
                           text-text-primary placeholder:text-text-muted
                           text-base p-4 resize-none font-mono leading-relaxed
                           focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20
                           transition-colors duration-150"
              />
            </div>
          ))}
        </div>

        {/* Right — Version Info + Actions */}
        <div className="xl:sticky xl:top-6 self-start">
          <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-5">
              Sürüm Bilgisi
            </h3>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-base text-text-secondary">Durum</span>
                {hasPublished ? (
                  <span className="text-[14px] font-semibold text-accent-success bg-accent-success/10 px-3 py-1 rounded-full">Yayında</span>
                ) : (
                  <span className="text-[14px] font-semibold text-text-muted bg-workspace-elevated px-3 py-1 rounded-full">Taslak</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base text-text-secondary">Versiyon</span>
                <span className="text-base font-mono text-text-primary">
                  v{profile.promptVersion || "0"}{isDirty ? " (düzenlendi)" : ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base text-text-secondary">Son Kayıt</span>
                <span className="text-[14px] text-text-muted">
                  {profile.promptLastSaved ? new Date(profile.promptLastSaved).toLocaleString("tr-TR") : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base text-text-secondary">Yayın Tarihi</span>
                <span className="text-[14px] text-text-muted">
                  {profile.promptPublishedAt ? new Date(profile.promptPublishedAt).toLocaleString("tr-TR") : "—"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4 border-t border-workspace-border/30">
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className={`w-full px-4 py-3 rounded-xl text-base font-semibold min-h-[48px] transition-colors ${isDirty ? "bg-accent-primary text-workspace-surface hover:bg-accent-secondary" : "bg-workspace-elevated text-text-muted border border-workspace-border cursor-not-allowed"}`}
              >
                {flash === "saved" ? "✓ Taslak Kaydedildi" : "Taslak Kaydet"}
              </button>
              <button
                onClick={handlePublish}
                className="w-full px-4 py-3 rounded-xl text-base font-semibold min-h-[48px] transition-colors bg-accent-success/15 text-accent-success border border-accent-success/30 hover:bg-accent-success/25"
              >
                {flash === "published" ? "✓ Yayınlandı" : "Yayınla"}
              </button>
              <button
                onClick={handleRollback}
                disabled={!canRollback}
                className={`w-full px-4 py-3 rounded-xl text-base font-semibold min-h-[48px] transition-colors ${canRollback ? "bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50" : "bg-workspace-elevated text-text-muted border border-workspace-border cursor-not-allowed"}`}
              >
                {flash === "rolledback" ? "✓ Geri Alındı" : "Geri Al"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
