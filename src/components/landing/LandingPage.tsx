"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { Users, FileText, MessageSquare, CheckCircle2 } from "lucide-react";
import { SITE, brandString } from "@/lib/config/site";

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Ajan Seç",
    desc: "Hukuk, finans, ticari ve stratejik perspektifler için uzman AI ajanlarını kurulunuza davet edin.",
    icon: Users,
  },
  {
    num: "02",
    title: "Belge Yükle",
    desc: "Sözleşme, teklif veya iç dökümanınızı yükleyin. Bağlam notlarınızı ekleyin.",
    icon: FileText,
  },
  {
    num: "03",
    title: "Kurul Tartışır",
    desc: "Ajanlar belgeyi çok turlu tartışır, görüş ayrılıklarını açıkça ortaya koyar.",
    icon: MessageSquare,
  },
  {
    num: "04",
    title: "Kararı Al",
    desc: "Yapılandırılmış bulgular, net aksiyonlar ve kurul kararı — paylaşıma hazır.",
    icon: CheckCircle2,
  },
];

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
    <div className="min-h-screen bg-[#fafbfc] text-[#1a1a2e]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-white">{SITE.logo}</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">{SITE.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={SITE.paths.app}
              className="text-sm text-[#64748b] hover:text-[#1a1a2e] transition-colors"
            >
              Platform
            </Link>
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors shadow-sm"
            >
              <GoogleIcon />
              Giriş Yap
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EFF6FF] to-[#fafbfc]" />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-[#3B82F6] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
            {SITE.marketing.badge}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            {SITE.marketing.headline.split("Uzman AI Kuruluna").map((part, i, arr) =>
              i < arr.length - 1 ? (
                <span key={i}>
                  {part}
                  <span className="text-[#3B82F6]">Uzman AI Kuruluna</span>
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-[#64748b] leading-relaxed mb-10">
            {SITE.marketing.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2.5 px-6 py-3 text-base font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
            >
              <GoogleIcon />
              {SITE.marketing.ctaPrimary}
            </button>
            <a
              href="#how-it-works"
              className="px-6 py-3 text-base font-medium text-[#64748b] hover:text-[#1a1a2e] border border-[#e5e7eb] hover:border-[#d1d5db] rounded-xl transition-all bg-white"
            >
              {SITE.marketing.ctaSecondary}
            </a>
          </div>

          {/* Animated Scene Preview */}
          <ScenePreview />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-white border-y border-[#e5e7eb]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">{SITE.marketing.howItWorks}</h2>
            <p className="text-[#64748b]">{SITE.marketing.howItWorksSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                  className="relative p-6 rounded-xl border border-[#e5e7eb] bg-[#fafbfc] hover:border-[#BFDBFE] hover:shadow-sm transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-4">
                    <Icon size={20} className="text-[#3B82F6]" />
                  </div>
                  <span className="text-xs font-mono text-[#3B82F6] font-semibold">{step.num}</span>
                  <h3 className="text-base font-semibold mt-1 mb-2 group-hover:text-[#3B82F6] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#64748b] leading-relaxed">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">{brandString(SITE.marketing.whyTitle)}</h2>
            <p className="text-[#64748b]">{SITE.marketing.whySubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VALUE_POINTS.map((vp, i) => (
              <motion.div
                key={vp.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                className="p-6 rounded-xl border border-[#e5e7eb] bg-white hover:border-[#BFDBFE] hover:shadow-sm transition-all"
              >
                <h3 className="text-base font-semibold mb-2">{vp.title}</h3>
                <p className="text-sm text-[#64748b] leading-relaxed">{vp.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-white border-t border-[#e5e7eb]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {SITE.marketing.finalCtaTitle}
          </h2>
          <p className="text-[#64748b] mb-8 text-lg">
            {SITE.marketing.finalCtaSubtitle}
          </p>
          <button
            onClick={handleSignIn}
            className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
          >
            <GoogleIcon />
            {SITE.marketing.ctaPrimary}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#e5e7eb]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#3B82F6] rounded flex items-center justify-center">
              <span className="text-xs font-bold text-white">{SITE.logo}</span>
            </div>
            <span className="text-sm font-medium text-[#94a3b8]">{SITE.name}</span>
          </div>
          <p className="text-xs text-[#94a3b8]">
            {SITE.tagline}
          </p>
        </div>
      </footer>
    </div>
  );
}

// --- Animated Scene Preview ---

function ScenePreview() {
  const reduceMotion = useReducedMotion();
  const radius = 140;

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-[#1a2740] bg-gradient-to-b from-[#0B1220] to-[#111C36] shadow-2xl shadow-blue-900/20"
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.15),transparent_60%)]" />

        {/* Table disk */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1f2d4d] bg-gradient-to-br from-[#141f3a] to-[#0d1628]"
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
            animate={
              reduceMotion
                ? undefined
                : { y: [0, -4, 0] }
            }
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-20 w-16 flex-col items-center justify-center rounded-md border border-[#3B82F6]/60 bg-gradient-to-b from-[#1e3a5f] to-[#162644] shadow-lg shadow-blue-500/20"
          >
            <FileText size={22} className="text-[#60a5fa]" />
            <div className="mt-2 flex w-8 flex-col gap-0.5">
              <div className="h-0.5 w-full rounded bg-[#3B82F6]/40" />
              <div className="h-0.5 w-3/4 rounded bg-[#3B82F6]/30" />
              <div className="h-0.5 w-5/6 rounded bg-[#3B82F6]/30" />
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
              transition={{ duration: 0.4, delay: 0.6 + i * 0.08, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
            >
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : {
                        boxShadow: [
                          "0 0 0 0 rgba(59,130,246,0.0)",
                          "0 0 0 6px rgba(59,130,246,0.15)",
                          "0 0 0 0 rgba(59,130,246,0.0)",
                        ],
                      }
                }
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5,
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#3B82F6]/50 bg-gradient-to-b from-[#1e3a5f] to-[#142242] text-sm font-semibold text-[#93c5fd]"
              >
                {seat.label}
              </motion.div>
            </motion.div>
          );
        })}

        {/* Caption */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1f2d4d] bg-[#0B1220]/80 px-3 py-1 text-xs font-medium text-[#93c5fd] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
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
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
