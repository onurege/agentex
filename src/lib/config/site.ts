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
  name: "Consulera",
  tagline: "İş süreç otomasyonu ve AI karar desteği",
  logo: "⬡", // hexagon — boardroom table symbol

  // --- Paths ---
  paths: {
    landing: "/",
    app: "/app",
    boardroomAgents: "/app/boardroom/agents",
    setup: "/app/setup",
    boardroom: "/app/boardroom",
    verdict: "/app/verdict",
    panel: "/app/panel",
  },

  // --- Metadata ---
  meta: {
    title: "Consulera — İş Süreçleri İçin AI Karar Desteği",
    description:
      "Hukuki süreçlerinizi otomatikleştirin; sözleşme inceleme, belge karşılaştırma, imza kontrolü ve karar destek akışlarını tek platformda yönetin.",
  },

  // --- Landing Page Marketing Copy ---
  marketing: {
    badge: "İş Süreç Otomasyonu",
    headline: "İş süreçleriniz için AI karar destek platformu",
    subheadline:
      "Sözleşme inceleme, belge karşılaştırma, imza kontrolü, redline ve uzman ajan değerlendirmelerini tek izlenebilir süreçte birleştirin.",
    ctaPrimary: "Giriş Yap",
    ctaSecondary: "Akışı Gör",
    howItWorks: "Hukuki karar süreci nasıl işler?",
    howItWorksSubtitle: "Süreci başlatın, belgeyi analiz edin, karar desteğini kayıt altına alın",
    automationsTitle: "Uzman Ajanlar",
    automationsSubtitle:
      "Her biri farklı hukuki ve ticari perspektife sahip AI uzmanları",
    whyTitle: "Neden {name}?",
    whySubtitle: "Tek seferlik chatbot yanıtı değil, hukuki süreçler için izlenebilir karar destek altyapısı",
    finalCtaTitle: "Hukuki operasyonlarınızı karar destek akışına dönüştürün",
    finalCtaSubtitle:
      "Kurumsal hesabınızla giriş yapın; sözleşme, imza ve belge versiyon süreçlerini AI destekli olarak yönetin.",
  },

  // --- Stage Flow Steps ---
  stageSteps: [
    { key: "agent-gallery", label: "Ajan Seçimi", index: 1 },
    { key: "board-setup", label: "Analiz Hazırlığı", index: 2 },
    { key: "boardroom", label: "Tartışma", index: 3 },
    { key: "verdict", label: "Karar", index: 4 },
  ] as const,

  // --- Export Branding ---
  export: {
    footer: "{name} Hukuki Süreç Karar Destek Sistemi",
  },
} as const;

/**
 * Replace {name} placeholders in a string with the product name.
 */
export function brandString(template: string): string {
  return template.replace(/\{name\}/g, SITE.name);
}
