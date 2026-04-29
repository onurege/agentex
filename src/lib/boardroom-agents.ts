// ============================================================
// Boardroom Agent Definitions
// ============================================================
//
// Extended agent profiles for the AI Boardroom gallery & detail drawer.
// Broadened beyond contract-only scope to cover general document review.
// Chief agent is excluded from gallery selection — always present.
// ============================================================

export interface BoardroomAgent {
  id: string;
  name: string;
  shortName: string;
  title: string;
  avatar: string;
  color: string;
  characterLine: string;
  description: string;
  expertise: string[];
  bio: string;
  documentTypes: string[];
  thinkingStyle: string;
  /**
   * Marks user-created custom agents (vs hard-coded system ones).
   * Undefined on BOARDROOM_AGENTS entries — the merge helper stamps
   * it true on custom agents pulled from the store.
   */
  isCustom?: boolean;
}

export const BOARDROOM_AGENTS: BoardroomAgent[] = [
  {
    id: "legal-counsel",
    name: "Kıdemli Hukuk Danışmanı",
    shortName: "Hukuk",
    title: "Hukuk Danışmanı",
    avatar: "⚖️",
    color: "agent-legal",
    characterLine: "Her maddeyi tarafınıza en güvenli hale getirmeyi hedefler.",
    description:
      "Belge dilini, sorumluluk maddelerini, tazminat koşullarını ve hukuki uyumu inceler. Riskli hükümleri ve eksik koruma maddelerini tespit eder.",
    expertise: [
      "Sorumluluk analizi",
      "Tazminat ve cezai şartlar",
      "Uyumluluk ve mevzuat",
    ],
    bio: "Hukuki riskleri erken tespit etme konusunda uzmanlaşmış bir danışmandır. Sorumluluk dağılımı, fesih koşulları ve düzenleyici uyum alanlarında derin bilgi sahibidir. Belgenin her maddesini tarafların hakları ve yükümlülükleri açısından titizlikle değerlendirir.",
    documentTypes: [
      "Sözleşmeler",
      "Politika belgeleri",
      "Yasal düzenlemeler",
      "Ortaklık anlaşmaları",
    ],
    thinkingStyle:
      "Korumacı ve detay odaklı düşünür. Her maddeyi en kötü senaryo perspektifinden değerlendirir ve gizli riskleri ortaya çıkarır.",
  },
  {
    id: "finance-director",
    name: "Finans Direktörü",
    shortName: "Finans",
    title: "Finans Direktörü",
    avatar: "📊",
    color: "agent-finance",
    characterLine: "Mali etkiyi rakamlarla ortaya koyar, riski fiyatlar.",
    description:
      "Ödeme koşullarını, maliyet yapılarını, finansal riskleri ve ekonomik etkileri değerlendirir.",
    expertise: [
      "Finansal risk analizi",
      "Ödeme ve maliyet yapısı",
      "Gelir etkisi modelleme",
    ],
    bio: "Belgelerin mali boyutunu analiz eder. Ödeme koşulları, maliyet yükleri, cezai şartların finansal etkisi ve gelir tanıma konularında değerlendirme yapar. Rakamların arkasındaki riskleri görünür kılar.",
    documentTypes: [
      "Sözleşmeler",
      "Teklifler",
      "Bütçe belgeleri",
      "Yatırım anlaşmaları",
    ],
    thinkingStyle:
      "Sayısal ve analitik yaklaşır. Her yükümlülüğü mali etki perspektifinden değerlendirir ve gizli maliyetleri ortaya çıkarır.",
  },
  {
    id: "tax-advisor",
    name: "Vergi Danışmanı",
    shortName: "Vergi",
    title: "YMM & Vergi Danışmanı",
    avatar: "🏛️",
    color: "agent-tax",
    characterLine: "Vergisel yükümlülükleri ve uyum risklerini tespit eder.",
    description:
      "Vergi yükümlülüklerini, stopaj gereksinimlerini ve muhasebe etkilerini değerlendirir.",
    expertise: [
      "Vergi uyumu",
      "Stopaj ve kesintiler",
      "Muhasebe standartları",
    ],
    bio: "Belgelerdeki vergisel sonuçları analiz eder. Stopaj gereksinimleri, KDV etkileri, transfer fiyatlandırması kaygıları ve muhasebe standartlarıyla uyumu değerlendirir. Vergi otoritelerinin bakış açısını masaya getirir.",
    documentTypes: [
      "Sözleşmeler",
      "Ortaklık anlaşmaları",
      "Uluslararası anlaşmalar",
      "Hizmet anlaşmaları",
    ],
    thinkingStyle:
      "Mevzuat odaklı ve sistematik. Vergisel yükümlülükleri otorite perspektifinden değerlendirir ve uyum risklerini erken tespit eder.",
  },
  {
    id: "sales-director",
    name: "Satış Direktörü",
    shortName: "Satış",
    title: "Satış Direktörü",
    avatar: "🎯",
    color: "agent-sales",
    characterLine: "Ticari uygulanabilirliği ve anlaşma değerini sorgular.",
    description:
      "Ticari uygulanabilirliği, anlaşma yapısını ve rekabetçi konumlamayı değerlendirir.",
    expertise: [
      "Anlaşma yapısı",
      "Ticari uygulanabilirlik",
      "Rekabet ve pazar analizi",
    ],
    bio: "Belgeleri ticari başarı perspektifinden değerlendirir. Anlaşmanın kapanmasını engelleyebilecek koşulları, komisyon yapılarını, münhasırlık kısıtlamalarını ve pazar fırsatlarını analiz eder.",
    documentTypes: [
      "Satış sözleşmeleri",
      "Distribütörlük anlaşmaları",
      "Teklifler",
      "Ortaklık anlaşmaları",
    ],
    thinkingStyle:
      "Pragmatik ve sonuç odaklı. Her maddeyi 'bu anlaşmayı nasıl etkiler?' sorusuyla değerlendirir ve ticari fırsatları korur.",
  },
  {
    id: "product-director",
    name: "Ürün Direktörü",
    shortName: "Ürün",
    title: "Ürün Yönetimi Direktörü",
    avatar: "🔧",
    color: "agent-product",
    characterLine:
      "Operasyonel yükleri ve teknik taahhütleri gerçekçilikle değerlendirir.",
    description:
      "Platform gereksinimlerini, SLA taahhütlerini ve operasyonel yükleri inceler.",
    expertise: [
      "SLA ve performans",
      "Operasyonel yük analizi",
      "Teknik uygulanabilirlik",
    ],
    bio: "Belgelerdeki teknik ve operasyonel taahhütleri değerlendirir. SLA hedeflerinin gerçekçiliğini, platform gereksinimlerinin karşılanabilirliğini ve entegrasyon kapsamını inceler. Taahhüt edilen ile uygulanabilir olan arasındaki boşluğu ortaya koyar.",
    documentTypes: [
      "Hizmet anlaşmaları",
      "SLA belgeleri",
      "Teknik şartnameler",
      "Proje sözleşmeleri",
    ],
    thinkingStyle:
      "Gerçekçi ve operasyon odaklı. Her taahhüdü 'bunu gerçekten yapabilir miyiz?' sorusuyla test eder ve sürdürülemez yükümlülükleri işaretler.",
  },
  {
    id: "case-law-researcher",
    name: "Yargı Araştırma Uzmanı",
    shortName: "Yargı",
    title: "İçtihat ve Mevzuat Araştırmacısı",
    avatar: "📚",
    color: "agent-research",
    characterLine:
      "Yorum yapmaz; ilgili emsal karar ve madde referanslarını masaya getirir.",
    description:
      "Yargıtay, Danıştay, Anayasa Mahkemesi, KVKK, Rekabet Kurumu, KİK, BDDK, GİB özelgeleri ve benzeri hukuki kaynaklarda belgeyle ilişkili emsal karar, kurul kararı ve madde referansı bulur. Hukuki yorum veya risk değerlendirmesi yapmaz.",
    expertise: [
      "İçtihat araştırması",
      "Mevzuat ve kurul kararları",
      "Madde referansı çıkarımı",
    ],
    bio: "Kurulun araştırma memuru gibi çalışır. Belgedeki konu başlıklarından canlı kaynak sorguları üretir, dönen emsal kararları ve olası madde referanslarını listeler. Sonuç çıkarmaz, taraf tutmaz ve hukuki kanaat belirtmez.",
    documentTypes: [
      "Sözleşmeler",
      "Uyuşmazlık dosyaları",
      "Uyum raporları",
      "Regülasyon analizleri",
      "Dilekçe ve savunma taslakları",
    ],
    thinkingStyle:
      "Kaynak odaklı ve nötr çalışır. Her önemli başlık için 'hangi emsal karar veya madde bulunabildi?' sorusunu yanıtlar; yorum yerine kaynak listesi üretir.",
  },
];

export const MIN_BOARD_SIZE = 2;
export const MAX_BOARD_SIZE = 5;

export function getBoardroomAgent(id: string): BoardroomAgent | undefined {
  return BOARDROOM_AGENTS.find((a) => a.id === id);
}

// Chief agent — always seated at the boardroom, never listed in the
// selectable gallery. Lives here (and not in boardroom-flow-store)
// so any module can import the definition without pulling in the
// zustand store graph. Legacy imports from boardroom-flow-store
// continue to work via a re-export.
export const CHIEF_AGENT: BoardroomAgent = {
  id: "chief-agent",
  name: "Baş Ajan",
  shortName: "Baş",
  title: "Kurul Koordinatörü",
  avatar: "👤",
  color: "agent-chief",
  characterLine: "Kurulu koordine eder ve son sentezi oluşturur.",
  description:
    "Tüm kurul sürecini yönetir, risk alanlarını belirler ve bulguları eyleme dönüştürülebilir bir kararda sentezler.",
  expertise: ["Risk değerlendirmesi", "Kurul koordinasyonu", "Sentez"],
  bio: "",
  documentTypes: [],
  thinkingStyle: "Bütüncül ve sentez odaklı.",
};
