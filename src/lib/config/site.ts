// ============================================================
// Site & Brand Configuration
// ============================================================
//
// Central config for all brand strings, paths, and marketing copy.
// Change product name or domain here — all UI surfaces update.
//
// To rename the product:
//   1. Change SITE.name, SITE.tagline, SITE.meta.*
//   2. Optionally update SITE.marketing.* for new copy
//   3. No other files need changes
// ============================================================

export const SITE = {
  // --- Brand Identity ---
  name: "AI Boardroom",
  tagline: "Uzman AI kurulu ile belge değerlendirme",
  logo: "⬡", // hexagon — boardroom table symbol

  // --- Paths ---
  paths: {
    landing: "/",
    app: "/app",
    setup: "/app/setup",
    boardroom: "/app/boardroom",
    verdict: "/app/verdict",
    panel: "/app/panel",
  },

  // --- Metadata ---
  meta: {
    title: "AI Boardroom — Uzman Yapay Zeka Kurulu",
    description:
      "Belgelerinizi uzman AI kuruluna sunun. Ajanlar tartışsın, siz net karar ve aksiyonları alın.",
  },

  // --- Landing Page Marketing Copy ---
  marketing: {
    badge: "AI Boardroom",
    headline: "Belgenizi Uzman AI Kuruluna Sunun",
    subheadline:
      "Ajanlar belgeyi tartışsın, siz net karar ve aksiyonları alın.",
    ctaPrimary: "Google ile Giriş Yap",
    ctaSecondary: "Nasıl Çalışır?",
    howItWorks: "Nasıl Çalışır?",
    howItWorksSubtitle: "Dört adımda uzman kurul değerlendirmesi",
    automationsTitle: "Uzman Ajanlar",
    automationsSubtitle:
      "Her biri farklı uzmanlık alanına sahip AI kurul üyeleri",
    whyTitle: "Neden {name}?",
    whySubtitle: "Genel amaçlı chatbot değil, uzman kurul deneyimi",
    finalCtaTitle: "Hemen Başlayın",
    finalCtaSubtitle:
      "Google hesabınızla giriş yapın ve belgelerinizi uzman AI kuruluna sunun.",
  },

  // --- Stage Flow Steps ---
  stageSteps: [
    { key: "agent-gallery", label: "Ajan Seçimi", index: 1 },
    { key: "board-setup", label: "Kurul Hazırlığı", index: 2 },
    { key: "boardroom", label: "Tartışma", index: 3 },
    { key: "verdict", label: "Karar", index: 4 },
  ] as const,

  // --- Export Branding ---
  export: {
    footer: "{name} Kurul Değerlendirme Sistemi",
  },
} as const;

/**
 * Replace {name} placeholders in a string with the product name.
 */
export function brandString(template: string): string {
  return template.replace(/\{name\}/g, SITE.name);
}
