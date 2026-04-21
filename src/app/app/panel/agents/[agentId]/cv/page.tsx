"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBoardroomAgent, CHIEF_AGENT } from "@/lib/boardroom-agents";
import { useControlRoomStore, type AgentCVData } from "@/lib/control-room-store";

export default function CVBuilderPage() {
  const params = useParams();
  const agentId = params.agentId as string;

  // Include customAgents in the lookup so user-created agents resolve
  // the same way built-in ones do. Subscribing here also re-renders
  // if the agent is archived/restored while the page is open.
  const customAgents = useControlRoomStore((s) => s.customAgents);
  const agent =
    agentId === "chief-agent"
      ? CHIEF_AGENT
      : (getBoardroomAgent(agentId) ?? customAgents[agentId] ?? null);

  const getCVDraft = useControlRoomStore((s) => s.getCVDraft);
  const getCVPublished = useControlRoomStore((s) => s.getCVPublished);
  const saveCVDraft = useControlRoomStore((s) => s.saveCVDraft);
  const publishCV = useControlRoomStore((s) => s.publishCV);
  const getProfile = useControlRoomStore((s) => s.getProfile);

  const [form, setForm] = useState<AgentCVData>(() => getCVDraft(agentId));
  const [isDirty, setIsDirty] = useState(false);
  const [saveFlash, setSaveFlash] = useState<"saved" | "published" | null>(null);

  // Sync form when navigating between agents
  useEffect(() => {
    setForm(getCVDraft(agentId));
    setIsDirty(false);
  }, [agentId, getCVDraft]);

  const updateField = useCallback((field: keyof AgentCVData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setSaveFlash(null);
  }, []);

  const handleSaveDraft = useCallback(() => {
    saveCVDraft(agentId, form);
    setIsDirty(false);
    setSaveFlash("saved");
    setTimeout(() => setSaveFlash(null), 2500);
  }, [agentId, form, saveCVDraft]);

  const handlePublish = useCallback(() => {
    saveCVDraft(agentId, form);
    publishCV(agentId);
    setIsDirty(false);
    setSaveFlash("published");
    setTimeout(() => setSaveFlash(null), 2500);
  }, [agentId, form, saveCVDraft, publishCV]);

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-2xl font-semibold text-text-primary mb-3">Ajan Bulunamadı</p>
        <Link href="/app/panel/agents" className="px-6 py-3 rounded-xl text-base font-semibold bg-accent-primary text-white hover:bg-accent-secondary transition-colors">
          Agent Library&apos;ye Dön
        </Link>
      </div>
    );
  }

  const profile = getProfile(agentId);
  const hasPublished = profile.cvPublished !== null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/app/panel/agents" className="text-text-muted hover:text-text-secondary transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
          <span className="text-xl">{agent.avatar}</span>
          <h1 className="font-display text-3xl font-bold text-text-primary">CV Builder</h1>
        </div>
        <p className="text-lg text-text-secondary">
          {agent.name} — profil ve değerlendirme yaklaşımını düzenleyin.
        </p>
        {/* Status badges */}
        <div className="flex items-center gap-3 mt-3">
          {hasPublished && (
            <span className="text-[13px] font-semibold text-accent-success bg-accent-success/10 px-3 py-1 rounded-full">
              Yayında
            </span>
          )}
          {isDirty && (
            <span className="text-[13px] font-semibold text-accent-warning bg-accent-warning/10 px-3 py-1 rounded-full">
              Kaydedilmemiş Değişiklik
            </span>
          )}
          {profile.cvLastSaved && (
            <span className="text-[13px] text-text-muted">
              Son kayıt: {new Date(profile.cvLastSaved).toLocaleString("tr-TR")}
            </span>
          )}
        </div>
      </div>

      {/* Two-column */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6">
          <FormField label="İsim" value={form.name} onChange={(v) => updateField("name", v)} />
          <FormField label="Unvan" value={form.title} onChange={(v) => updateField("title", v)} />
          <FormField label="Kıdem" value={form.seniority} onChange={(v) => updateField("seniority", v)} />
          <FormField label="Uzmanlık Alanları" value={form.expertise} onChange={(v) => updateField("expertise", v)} multiline placeholder="Virgülle ayrılmış uzmanlık başlıkları" />
          <FormField label="Sektör Deneyimi" value={form.industryExperience} onChange={(v) => updateField("industryExperience", v)} multiline placeholder="Hangi belge türlerinde güçlü?" />
          <FormField label="Risk Odağı" value={form.riskFocus} onChange={(v) => updateField("riskFocus", v)} multiline placeholder="Hangi risklere odaklanır?" />
          <FormField label="Değerlendirme Prensipleri" value={form.principles} onChange={(v) => updateField("principles", v)} multiline placeholder="Nasıl düşünür, neye dikkat eder?" />
          <FormField label="Ton" value={form.tone} onChange={(v) => updateField("tone", v)} placeholder="Örn: Profesyonel ve net, Diplomatik, Doğrudan" />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-workspace-border/30">
            <button
              onClick={handleSaveDraft}
              disabled={!isDirty}
              className={`px-6 py-3 rounded-xl text-base font-semibold min-h-[48px] transition-colors ${isDirty ? "bg-accent-primary text-white hover:bg-accent-secondary" : "bg-workspace-elevated text-text-muted border border-workspace-border cursor-not-allowed"}`}
            >
              {saveFlash === "saved" ? "✓ Taslak Kaydedildi" : "Taslak Kaydet"}
            </button>
            <button
              onClick={handlePublish}
              className="px-6 py-3 rounded-xl text-base font-semibold min-h-[48px] transition-colors bg-accent-success/15 text-accent-success border border-accent-success/30 hover:bg-accent-success/25"
            >
              {saveFlash === "published" ? "✓ Yayınlandı" : "Yayınla"}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="xl:sticky xl:top-6 self-start">
          <div className="rounded-xl bg-workspace-surface border border-workspace-border p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-6">Canlı Önizleme</h3>
            <div className="rounded-xl bg-workspace-bg border border-workspace-border p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-3xl">{agent.avatar}</div>
                <div>
                  <p className="text-xl font-bold text-text-primary">{form.name || "—"}</p>
                  <p className="text-base text-text-secondary">{form.title || "—"}</p>
                  <p className="text-[14px] text-text-muted">{form.seniority || "—"}</p>
                </div>
              </div>
              {form.expertise && (
                <div className="mb-4">
                  <p className="text-[13px] font-mono text-text-muted uppercase tracking-wide mb-2">Uzmanlık</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.expertise.split(",").map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md text-[13px] font-medium bg-workspace-elevated text-text-secondary border border-workspace-border">{tag.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
              {form.riskFocus && (
                <div className="mb-4">
                  <p className="text-[13px] font-mono text-text-muted uppercase tracking-wide mb-1">Risk Odağı</p>
                  <p className="text-[15px] text-text-secondary leading-relaxed">{form.riskFocus}</p>
                </div>
              )}
              {form.principles && (
                <div className="mb-4">
                  <p className="text-[13px] font-mono text-text-muted uppercase tracking-wide mb-1">Prensipler</p>
                  <p className="text-[15px] text-text-secondary leading-relaxed">{form.principles}</p>
                </div>
              )}
              {form.tone && (
                <div>
                  <p className="text-[13px] font-mono text-text-muted uppercase tracking-wide mb-1">Ton</p>
                  <p className="text-[15px] text-text-secondary">{form.tone}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const cls = "w-full rounded-xl bg-workspace-bg border border-workspace-border text-text-primary placeholder:text-text-muted text-base p-4 focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20 transition-colors duration-150";
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold text-text-primary mb-2">{label}</label>
      {multiline ? (
        <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${cls} resize-none leading-relaxed`} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} min-h-[48px]`} />
      )}
    </div>
  );
}
