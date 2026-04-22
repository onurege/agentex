"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { SITE, brandString } from "@/lib/config/site";
import { useFastMode } from "@/lib/motion/fast-mode";
import { DURATION, EASE } from "@/lib/motion/tokens";
import { ThemeToggle } from "@/components/app/ThemeToggle";

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Ajan Seç",
    desc: "Hukuk, finans, ticari ve stratejik perspektifler için uzman AI ajanlarını kurulunuza davet edin.",
    icon: Users,
    tone: "chief" as const,
  },
  {
    num: "02",
    title: "Belge Yükle",
    desc: "Sözleşme, teklif veya iç dökümanınızı yükleyin. Bağlam notlarınızı ekleyin.",
    icon: FileText,
    tone: "legal" as const,
  },
  {
    num: "03",
    title: "Kurul Tartışır",
    desc: "Ajanlar belgeyi çok turlu tartışır, görüş ayrılıklarını açıkça ortaya koyar.",
    icon: MessageSquare,
    tone: "tax" as const,
  },
  {
    num: "04",
    title: "Kararı Al",
    desc: "Yapılandırılmış bulgular, net aksiyonlar ve kurul kararı — paylaşıma hazır.",
    icon: CheckCircle2,
    tone: "finance" as const,
  },
];

const TONE_CLASS: Record<
  "chief" | "legal" | "tax" | "finance",
  { bg: string; border: string; text: string; ring: string }
> = {
  chief: {
    bg: "bg-agent-chief/10",
    border: "border-agent-chief/25",
    text: "text-agent-chief",
    ring: "group-hover:ring-agent-chief/30",
  },
  legal: {
    bg: "bg-agent-legal/10",
    border: "border-agent-legal/25",
    text: "text-agent-legal",
    ring: "group-hover:ring-agent-legal/30",
  },
  tax: {
    bg: "bg-agent-tax/12",
    border: "border-agent-tax/25",
    text: "text-agent-tax",
    ring: "group-hover:ring-agent-tax/30",
  },
  finance: {
    bg: "bg-agent-finance/10",
    border: "border-agent-finance/25",
    text: "text-agent-finance",
    ring: "group-hover:ring-agent-finance/30",
  },
};

const VALUE_POINTS = [
  {
    title: "Tek Perspektif Değil, Kurul",
    desc: "Genel amaçlı chatbot değil; her biri farklı uzmanlık alanı için eğitilmiş ajan kurulu.",
  },
  {
    title: "Gerçek Tartışma",
    desc: "Ajanlar birbirine itiraz eder, görüş ayrılıklarını açığa çıkarır. Sonuç: körleme özet değil gerçek değerlendirme.",
  },
  {
    title: "Yapılandırılmış Çıktı",
    desc: "Ham metin değil; kararlar, aksiyonlar, riskler ve revizyon önerileri — doğrudan işlenebilir.",
  },
  {
    title: "Kurumsal Hazır",
    desc: "Kimlik doğrulama, rol bazlı erişim ve denetim kaydı — dağıtıma uygun profesyonel platform.",
  },
];

const SEAT_POSITIONS = [
  { angle: -110, label: "H" },
  { angle: -70, label: "F" },
  { angle: -20, label: "T" },
  { angle: 20, label: "S" },
  { angle: 70, label: "R" },
  { angle: 110, label: "O" },
];

export function LandingPage() {
  const [callbackUrl, setCallbackUrl] = useState<string>(SITE.paths.app);

  // Middleware parks the original URL in ?callbackUrl=… — honor it on sign-in.
  useEffect(() => {
    const cb = new URLSearchParams(window.location.search).get("callbackUrl");
    if (cb) setCallbackUrl(cb);
  }, []);

  const handleSignIn = useCallback(() => {
    signIn("google", { callbackUrl });
  }, [callbackUrl]);

  return (
    <div className="min-h-screen bg-workspace-bg text-text-primary">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-workspace-border bg-workspace-surface/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-primary text-workspace-surface flex items-center justify-center shadow-soft">
              <span className="text-sm font-bold">{SITE.logo}</span>
            </div>
            <span className="text-lg font-display font-semibold tracking-tight">
              {SITE.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href={SITE.paths.app}
              className="hidden sm:inline text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Platform
            </Link>
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-workspace-surface bg-accent-primary hover:bg-accent-secondary rounded-lg transition-colors shadow-soft"
            >
              <GoogleIcon />
              Giriş Yap
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Editorial watermark — a brass corner rule, near-invisible but signals the serious-paper feel */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-accent-primary/[0.04] via-transparent to-transparent" />
        <div className="pointer-events-none absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full bg-accent-warning/[0.05] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 w-[560px] h-[560px] rounded-full bg-accent-success/[0.05] blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 text-xs font-medium tracking-wide uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
            {SITE.marketing.badge}
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6">
            {SITE.marketing.headline
              .split("Uzman AI Kuruluna")
              .map((part, i, arr) =>
                i < arr.length - 1 ? (
                  <span key={i}>
                    {part}
                    <span className="relative inline-block">
                      <span className="relative z-10 text-accent-primary">
                        Uzman AI Kuruluna
                      </span>
                      {/* Editorial underline — like a manuscript flourish */}
                      <span className="absolute left-0 right-0 bottom-1 h-[6px] bg-accent-warning/30 -z-0 rounded-sm" />
                    </span>
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-text-secondary leading-relaxed mb-10">
            {SITE.marketing.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={handleSignIn}
              className="group flex items-center gap-2.5 px-6 py-3 text-base font-semibold text-workspace-surface bg-accent-primary hover:bg-accent-secondary rounded-xl transition-all shadow-medium hover:shadow-glow-blue"
            >
              <GoogleIcon />
              {SITE.marketing.ctaPrimary}
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
            <a
              href="#how-it-works"
              className="px-6 py-3 text-base font-medium text-text-secondary hover:text-text-primary border border-workspace-border hover:border-accent-primary/40 rounded-xl transition-all bg-workspace-surface"
            >
              {SITE.marketing.ctaSecondary}
            </a>
          </div>

          {/* Animated Scene Preview */}
          <ScenePreview />
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="py-24 bg-workspace-surface border-y border-workspace-border"
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block text-[10px] font-mono font-semibold tracking-[0.2em] uppercase text-accent-primary mb-3">
              — İşleyiş —
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              {SITE.marketing.howItWorks}
            </h2>
            <p className="text-text-secondary text-base">
              {SITE.marketing.howItWorksSubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              const t = TONE_CLASS[step.tone];
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.4,
                    delay: i * 0.08,
                    ease: "easeOut",
                  }}
                  className={`group relative p-6 rounded-xl border ${t.border} bg-workspace-elevated hover:shadow-medium transition-all ring-1 ring-transparent ${t.ring}`}
                >
                  <div
                    className={`w-11 h-11 rounded-lg ${t.bg} ${t.border} border flex items-center justify-center mb-4`}
                  >
                    <Icon size={20} className={t.text} />
                  </div>
                  <span
                    className={`text-[11px] font-mono font-semibold tracking-widest ${t.text}`}
                  >
                    {step.num}
                  </span>
                  <h3 className="text-base font-display font-semibold mt-1 mb-2 group-hover:text-accent-primary transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block text-[10px] font-mono font-semibold tracking-[0.2em] uppercase text-accent-warning mb-3">
              — Değer Vaadi —
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              {brandString(SITE.marketing.whyTitle)}
            </h2>
            <p className="text-text-secondary text-base">
              {SITE.marketing.whySubtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VALUE_POINTS.map((vp, i) => (
              <motion.div
                key={vp.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                className="relative p-7 rounded-xl border border-workspace-border bg-workspace-surface hover:border-accent-primary/30 hover:shadow-medium transition-all"
              >
                {/* Left accent bar — editorial page-rule */}
                <span className="absolute left-0 top-6 bottom-6 w-0.5 bg-accent-primary rounded-full" />
                <h3 className="text-lg font-display font-semibold mb-2 pl-2">
                  {vp.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed pl-2">
                  {vp.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 bg-workspace-surface border-t border-workspace-border overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-primary/[0.04] via-transparent to-accent-warning/[0.04]" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            {SITE.marketing.finalCtaTitle}
          </h2>
          <p className="text-text-secondary mb-10 text-lg leading-relaxed">
            {SITE.marketing.finalCtaSubtitle}
          </p>
          <button
            onClick={handleSignIn}
            className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-workspace-surface bg-accent-primary hover:bg-accent-secondary rounded-xl transition-all shadow-medium hover:shadow-glow-blue"
          >
            <GoogleIcon />
            {SITE.marketing.ctaPrimary}
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-workspace-border bg-workspace-bg">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-accent-primary text-workspace-surface flex items-center justify-center">
              <span className="text-xs font-bold">{SITE.logo}</span>
            </div>
            <span className="text-sm font-medium text-text-tertiary">
              {SITE.name}
            </span>
          </div>
          <p className="text-xs text-text-tertiary">{SITE.tagline}</p>
        </div>
      </footer>
    </div>
  );
}

// --- Animated Scene Preview ---
//
// The scene itself is a graphic element — always renders in a
// "night boardroom" treatment regardless of theme, because it
// is decorative content, not a UI surface. Hues retuned from
// generic blue to navy + champagne to match the editorial brand.

function ScenePreview() {
  const { enabled: reduceMotion } = useFastMode();
  const radius = 140;

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.sceneEnter, ease: EASE.entrance }}
        className="relative overflow-hidden rounded-2xl border border-[#1F2D47] bg-gradient-to-b from-[#0A1220] to-[#111A2E] shadow-2xl"
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* Ambient glow — champagne */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(222,54,72,0.22),transparent_60%)]" />

        {/* Table disk */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#243354] bg-gradient-to-br from-[#162137] to-[#0B1322]"
          style={{ width: radius * 2.2, height: radius * 2.2 }}
        />

        {/* Central document */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-20 w-16 flex-col items-center justify-center rounded-md border border-[#DE3648]/60 bg-gradient-to-b from-[#1E2A4A] to-[#151F38] shadow-lg"
          >
            <FileText size={22} className="text-[#FCA80F]" />
            <div className="mt-2 flex w-8 flex-col gap-0.5">
              <div className="h-0.5 w-full rounded bg-[#FCA80F]/55" />
              <div className="h-0.5 w-3/4 rounded bg-[#FCA80F]/38" />
              <div className="h-0.5 w-5/6 rounded bg-[#FCA80F]/38" />
            </div>
          </motion.div>
        </motion.div>

        {/* Seats */}
        {SEAT_POSITIONS.map((seat, i) => {
          const rad = (seat.angle * Math.PI) / 180;
          const x = Math.sin(rad) * radius;
          const y = -Math.cos(rad) * radius * 0.55;
          return (
            <motion.div
              key={seat.label}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: 0.6 + i * 0.08,
                ease: "easeOut",
              }}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
            >
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        boxShadow: [
                          "0 0 0 0 rgba(222,54,72,0.0)",
                          "0 0 0 6px rgba(222,54,72,0.22)",
                          "0 0 0 0 rgba(222,54,72,0.0)",
                        ],
                      }
                }
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5,
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#DE3648]/55 bg-gradient-to-b from-[#1E2A4A] to-[#131D35] text-sm font-semibold text-[#F9FAFA]"
              >
                {seat.label}
              </motion.div>
            </motion.div>
          );
        })}

        {/* Caption */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#243354] bg-[#0A1220]/85 px-3 py-1 font-mono text-xs font-medium text-[#F9FAFA] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DE3648] animate-pulse" />
            Kurul oturumu — 6 uzman ajan
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// --- Google Icon SVG ---

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
