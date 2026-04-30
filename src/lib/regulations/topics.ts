// Hardcoded topic taxonomy for the Param Group regulations feed.
//
// One item can belong to multiple topics. Priority is the highest
// priority among matched topics — UI rendering decides badge colour
// from this value.
//
// Keywords are matched case-insensitively against Turkish text after
// `toLocaleLowerCase("tr-TR")`. Keep entries lowercase. Multi-word
// keywords match as substring; single keywords also match as substring
// to catch declensions ("ödeme hizmeti" / "ödemeler"). False-positive
// risk is acceptable — better to surface and let the user dismiss
// than to silently drop relevant mevzuat.

import type { RegulationTopic } from "./types";

export const REGULATION_TOPICS: readonly RegulationTopic[] = [
  {
    id: "e-para-odeme",
    label: "E-Para & Ödeme Hizmetleri",
    priority: "critical",
    keywords: [
      "6493",
      "elektronik para",
      "ödeme hizmeti",
      "ödeme hizmetleri",
      "ödeme kuruluşu",
      "ödeme sistemi",
      "psp",
      "e-para",
      "açık bankacılık",
      "ödeme hizmetleri yönetmeliği",
      "tcmb ödeme",
      "tcmb",
    ],
    sources: ["yargi-mcp", "tcmb", "resmi-gazete"],
    description:
      "6493 sayılı Kanun, TCMB Ödeme Hizmetleri ve Elektronik Para Kuruluşları " +
      "düzenlemeleri, ödeme sistemi izinleri.",
  },
  {
    id: "masak-aml",
    label: "MASAK & Suç Gelirleri",
    priority: "critical",
    keywords: [
      "masak",
      "5549",
      "suç gelirleri",
      "aklama",
      "şüpheli işlem",
      "müşteri tanı",
      "kyc",
      "fatf",
      "yaptırım listesi",
      "kara para",
    ],
    sources: ["masak", "yargi-mcp", "resmi-gazete"],
    description:
      "5549 sayılı Suç Gelirlerinin Aklanmasının Önlenmesi Kanunu, MASAK " +
      "rehberleri, FATF / AB yaptırım listeleri.",
  },
  {
    id: "kvkk",
    label: "KVKK & Veri Koruma",
    priority: "high",
    keywords: [
      "kvkk",
      "6698",
      "kişisel veri",
      "verbis",
      "aydınlatma yükümlülüğü",
      "veri ihlali",
      "kvkk kurul",
      "data protection",
    ],
    sources: ["kvkk", "yargi-mcp", "resmi-gazete"],
    description:
      "6698 sayılı Kişisel Verilerin Korunması Kanunu, Kurul kararları, " +
      "VERBİS ve aydınlatma yükümlülüğü güncellemeleri.",
  },
  {
    id: "vergi",
    label: "Vergi & Mali Mevzuat",
    priority: "high",
    keywords: [
      "vuk",
      "kdv",
      "gvk",
      "kvk",
      "damga vergisi",
      "stopaj",
      "e-fatura",
      "e-defter",
      "gib",
      "özelge",
      "tebliğ",
      "vergi usul",
    ],
    sources: ["gib", "resmi-gazete", "yargi-mcp"],
    description:
      "GİB sirküler ve özelgeleri, VUK / KDV / GVK / KVK / Damga Vergisi " +
      "tebliğleri, e-belge düzenlemeleri.",
  },
  {
    id: "bddk-bankacilik",
    label: "BDDK & Bankacılık",
    priority: "medium",
    keywords: [
      "bddk",
      "5411",
      "kredi kartı",
      "banka",
      "tüketici kredisi",
      "ücret tarifesi",
      "bankacılık kanunu",
    ],
    sources: ["bddk", "resmi-gazete"],
    description:
      "BDDK düzenlemeleri ve kart hizmetleriyle ilişkili mevzuat — Param'ın " +
      "iş ortaklığı sınırlarında ortaya çıkan etkiler.",
  },
  {
    id: "ticari-tuketici",
    label: "Ticari & Tüketici Hukuku",
    priority: "medium",
    keywords: [
      "ttk",
      "tbk",
      "tkhk",
      "6502",
      "tüketici hakemi",
      "haksız şart",
      "mesafeli sözleşme",
      "türk borçlar",
      "türk ticaret",
    ],
    sources: ["yargi-mcp", "resmi-gazete"],
    description:
      "TTK / TBK / 6502 sayılı TKHK ve tüketici hakemi düzenlemeleri; " +
      "sözleşme ve tüketici uygulamaları.",
  },
  {
    id: "kurumsal-istihdam",
    label: "Kurumsal & İstihdam",
    priority: "low",
    keywords: [
      "iş kanunu",
      "4857",
      "sgk",
      "5510",
      "isg",
      "6331",
      "şirketler hukuku",
      "genel kurul",
    ],
    sources: ["resmi-gazete", "yargi-mcp"],
    description:
      "İş Kanunu, SGK, İSG düzenlemeleri ve şirket genel kurul / sermaye " +
      "tescil duyuruları.",
  },
];

export const TOPIC_BY_ID: Readonly<Record<string, RegulationTopic>> =
  Object.freeze(
    REGULATION_TOPICS.reduce<Record<string, RegulationTopic>>((acc, topic) => {
      acc[topic.id] = topic;
      return acc;
    }, {}),
  );

export const DEFAULT_TOPIC_FILTER = REGULATION_TOPICS.filter(
  (t) => t.priority === "critical" || t.priority === "high",
).map((t) => t.id);
