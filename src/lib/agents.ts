import { AgentDefinition, AgentId } from "./types";

export const AGENTS: Record<AgentId, AgentDefinition> = {
  "chief-agent": {
    id: "chief-agent",
    name: "Baş Ajan",
    shortName: "Baş",
    role: "chief",
    title: "Baş İnceleme Koordinatörü",
    avatar: "BA",
    color: "agent-chief",
    description:
      "Tüm sözleşme inceleme sürecini koordine eder. Temel risk alanlarını belirler, uzman ajanlar önerir ve bulguları eyleme geçirilebilir bir özette sentezler.",
    expertise: [
      "Risk değerlendirmesi",
      "Ajan koordinasyonu",
      "Çapraz alan sentezi",
      "Yönetici özeti",
    ],
  },
  "legal-counsel": {
    id: "legal-counsel",
    name: "Kıdemli Hukuk Danışmanı",
    shortName: "Hukuk",
    role: "legal",
    title: "Kıdemli Hukuk Danışmanı",
    avatar: "HK",
    color: "agent-legal",
    description:
      "Sözleşme dilini, sorumluluk maddelerini, tazminat koşullarını ve hukuki uyumu inceler. Yasal açıdan riskli hükümleri ve eksik koruma maddelerini tespit eder.",
    expertise: [
      "Sorumluluk analizi",
      "Tazminat",
      "Uyumluluk",
      "Fesih hükümleri",
    ],
  },
  "finance-director": {
    id: "finance-director",
    name: "Finans Direktörü",
    shortName: "Finans",
    role: "finance",
    title: "Finans Direktörü",
    avatar: "FN",
    color: "agent-finance",
    description:
      "Ödeme koşullarını, gelir tanıma yöntemlerini, finansal riskleri ve maliyet yapılarını değerlendirir. Sözleşme şartlarının ekonomik etkisini analiz eder.",
    expertise: [
      "Ödeme koşulları",
      "Gelir etkisi",
      "Finansal risk",
      "Maliyet modellemesi",
    ],
  },
  "tax-advisor": {
    id: "tax-advisor",
    name: "YMM / Vergi Danışmanı",
    shortName: "Vergi",
    role: "tax",
    title: "Yeminli Mali Müşavir & Vergi Danışmanı",
    avatar: "VR",
    color: "agent-tax",
    description:
      "Vergi yükümlülüklerini, stopaj gereksinimlerini, transfer fiyatlandırması kaygılarını ve sözleşme hükümlerinin muhasebe işlemini değerlendirir.",
    expertise: [
      "Vergi uyumu",
      "Stopaj",
      "Transfer fiyatlandırması",
      "Muhasebe standartları",
    ],
  },
  "sales-director": {
    id: "sales-director",
    name: "Satış Direktörü",
    shortName: "Satış",
    role: "sales",
    title: "Satış Direktörü",
    avatar: "ST",
    color: "agent-sales",
    description:
      "Ticari uygulanabilirliği, anlaşma yapısını, kâr marjı etkilerini ve rekabetçi konumlamayı değerlendirir. Anlaşma kapanışını engelleyebilecek koşulları işaretler.",
    expertise: [
      "Anlaşma yapısı",
      "Komisyon koşulları",
      "Münhasırlık",
      "Ticari risk",
    ],
  },
  "product-director": {
    id: "product-director",
    name: "Ürün Yönetimi Direktörü",
    shortName: "Ürün",
    role: "product",
    title: "Ürün Yönetimi Direktörü",
    avatar: "ÜR",
    color: "agent-product",
    description:
      "Platform gereksinimlerini, SLA taahhütlerini, özellik yükümlülüklerini ve entegrasyon gereksinimlerini inceler. Sözleşmenin ürün yol haritasıyla uyumunu sağlar.",
    expertise: [
      "SLA incelemesi",
      "Platform yükümlülükleri",
      "Entegrasyon kapsamı",
      "Teslimat zaman çizelgesi",
    ],
  },
};

export const AGENT_LIST = Object.values(AGENTS);

export const EXPERT_AGENTS = AGENT_LIST.filter((a) => a.id !== "chief-agent");

export function getAgent(id: AgentId): AgentDefinition {
  return AGENTS[id];
}
