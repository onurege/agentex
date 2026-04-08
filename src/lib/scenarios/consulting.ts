import type { DemoScenario } from "../types";

/** Senaryo 3 — Danışmanlık Hizmet Sözleşmesi */
export const CONSULTING_SCENARIO: DemoScenario = {
  id: "consulting",
  name: "Danışmanlık Hizmet Sözleşmesi",
  shortName: "Danışmanlık",
  description: "Yönetim danışmanlığı hizmet sözleşmesi — proje kapsamı, fikri mülkiyet, gizlilik, ödeme koşulları",
  emoji: "💼",
  document: {
    id: "doc-003",
    name: "Danismanlik_Hizmet_Sozlesmesi_v1.8.pdf",
    type: "pdf",
    size: 1_240_000,
    uploadedAt: new Date().toISOString(),
    pageCount: 14,
    summary:
      "Dijital dönüşüm projesi kapsamında yönetim danışmanlığı hizmet sözleşmesi — proje teslimatları, zaman çizelgesi, fikri mülkiyet hakları, gizlilik ve ödeme koşullarını düzenlemektedir.",
  },
  businessContext: {
    notes: [
      "6 aylık dijital dönüşüm danışmanlığı projesi",
      "3 kıdemli danışman + 2 analist tam zamanlı atanacak",
      "Toplam bütçe: 450.000 € (aylık eşit taksitler)",
      "Proje çıktıları şirket mülkiyetinde olmalı",
      "Rakip firmalarla çalışma yasağı gerekli",
    ],
    industry: "Yönetim Danışmanlığı",
    dealType: "Danışmanlık Hizmet Sözleşmesi",
  },
  chiefRecommendation: {
    documentType: "Danışmanlık Hizmet Sözleşmesi",
    riskCategories: [
      { name: "Fikri Mülkiyet Riskleri", severity: "high", description: "Proje çıktıları, metodoloji ve araçlar üzerindeki fikri mülkiyet hakları net tanımlanmamıştır. Müşteri ile danışman arasında sahiplik çatışması riski bulunmaktadır." },
      { name: "Hukuki Sorumluluk", severity: "high", description: "Danışmanlık hizmetlerinden kaynaklanan zarar ve kayıplar için sorumluluk sınırları ve tazminat koşulları incelenmelidir." },
      { name: "Finansal Koşullar", severity: "medium", description: "Ödeme koşulları, fazla çalışma ücretleri ve kapsam değişikliği maliyet etkileri netleştirilmelidir." },
      { name: "Vergi Uyumu", severity: "medium", description: "Danışmanlık hizmetleri üzerindeki KDV uygulaması ve stopaj vergisi yükümlülükleri doğrulanmalıdır." },
      { name: "Gizlilik ve Rekabet", severity: "low", description: "Gizlilik taahhütleri ve rekabet yasağı maddeleri mevcut ancak süresi ve kapsamı daraltılabilir." },
    ],
    recommendedAgents: ["legal-counsel", "finance-director", "tax-advisor"],
    rationale:
      "Bu danışmanlık sözleşmesi fikri mülkiyet hakları ve sorumluluk sınırları açısından önemli hukuki riskler barındırmaktadır. Ödeme yapısı ve kapsam değişikliği maliyetleri Finans incelemesi, hizmet bedeli üzerindeki vergi yükümlülükleri Vergi incelemesi gerektirmektedir. Proje kapsamı net tanımlandığından Ürün ve Satış incelemesi gerekmemektedir.",
  },
  findings: [
    // Hukuk Danışmanı bulguları
    { id: "s3-f-001", agentId: "legal-counsel", category: "critical-issue", severity: "critical", title: "Fikri mülkiyet devir maddesi belirsiz", description: "Madde 7.1, proje çıktılarının müşteriye ait olacağını belirtmekle birlikte danışmanın önceden var olan araçları, şablonları ve metodolojisini istisna tutmaktadır. 'Önceden var olan' tanımı yapılmamış olup proje sırasında geliştirilen araçlar için sahiplik çatışması yaratabilir.", clause: "Madde 7.1", section: "Fikri Mülkiyet" },
    { id: "s3-f-002", agentId: "legal-counsel", category: "critical-issue", severity: "critical", title: "Gizlilik süresi yetersiz", description: "Madde 10.2, gizlilik yükümlülüğünü sözleşme bitiminden sonra yalnızca 1 yıl ile sınırlamaktadır. Dijital dönüşüm projesinde elde edilen stratejik bilgiler için en az 3 yıl öngörülmelidir.", clause: "Madde 10.2", section: "Gizlilik" },
    { id: "s3-f-003", agentId: "legal-counsel", category: "missing-risky", severity: "warning", title: "Personel değişikliği koruma maddesi yok", description: "Danışman firmanın atanan kıdemli personeli proje süresince değiştirebileceğine dair bir sınırlama bulunmamaktadır. Anahtar personelin çekilmesi proje başarısını tehlikeye atabilir.", section: "Personel" },
    { id: "s3-f-004", agentId: "legal-counsel", category: "sufficient-positive", severity: "positive", title: "Rekabet yasağı maddesi dengeli", description: "Madde 11, proje süresince ve bitiminden sonra 6 ay boyunca doğrudan rakip firmalarla aynı kapsamda çalışma yasağı öngörmektedir. Süre ve kapsam makuldür.", clause: "Madde 11", section: "Rekabet Yasağı" },
    // Finans Direktörü bulguları
    { id: "s3-f-005", agentId: "finance-director", category: "critical-issue", severity: "critical", title: "Kapsam değişikliği maliyet kontrolü eksik", description: "Madde 4.3, kapsam değişikliklerinde ek ücretlendirmeyi 'karşılıklı mutabakat' ile öngörmekte ancak onay mekanizması, üst sınır veya değişiklik emri prosedürü tanımlamamaktadır. Kontrolsüz bütçe aşımı riski bulunmaktadır.", clause: "Madde 4.3", section: "Kapsam ve Değişiklikler" },
    { id: "s3-f-006", agentId: "finance-director", category: "missing-risky", severity: "warning", title: "Fazla çalışma ücretlendirme oranı belirsiz", description: "Normal çalışma saatleri dışındaki çalışmalar için ücretlendirme oranı veya onay mekanizması belirtilmemiştir.", section: "Ücretlendirme" },
    { id: "s3-f-007", agentId: "finance-director", category: "sufficient-positive", severity: "positive", title: "Net ödeme takvimi tanımlı", description: "Aylık eşit taksitler ile fatura tarihinden itibaren 15 iş günü ödeme süresi açıkça belirtilmiştir. Nakit akışı planlaması için uygundur.", clause: "Madde 6.1", section: "Ödeme Koşulları" },
    { id: "s3-f-008", agentId: "finance-director", category: "missing-risky", severity: "warning", title: "Performans bazlı ödeme mekanizması yok", description: "Ödeme tamamen zaman bazlı yapılmakta olup teslimat kalitesi veya proje hedeflerine bağlı herhangi bir performans kriteri öngörülmemiştir.", section: "Ücretlendirme" },
    // Vergi Danışmanı bulguları
    { id: "s3-f-009", agentId: "tax-advisor", category: "missing-risky", severity: "warning", title: "Stopaj vergisi uygulaması belirsiz", description: "Danışmanlık hizmet bedelleri üzerinde stopaj vergisi kesintisi yapılıp yapılmayacağı belirtilmemiştir. Kurumlar vergisi stopajı (%15) veya serbest meslek stopajı (%20) uygulanabilir.", section: "Vergi Hükümleri" },
    { id: "s3-f-010", agentId: "tax-advisor", category: "sufficient-positive", severity: "positive", title: "KDV uygulaması açık", description: "Danışmanlık hizmetleri için %20 KDV uygulaması ve fatura düzeni açıkça belirtilmiştir.", clause: "Madde 6.4", section: "Vergi Hükümleri" },
    // Satış Direktörü bulguları
    { id: "s3-f-011", agentId: "sales-director", category: "missing-risky", severity: "warning", title: "Başarı kriterleri belirsiz", description: "Dijital dönüşüm projesinin başarı kriterleri ve KPI'lar sözleşmede tanımlanmamıştır. Müşteri memnuniyetsizliğinde ödeme anlaşmazlığı riski bulunmaktadır.", section: "Proje Kapsamı" },
    { id: "s3-f-012", agentId: "sales-director", category: "sufficient-positive", severity: "positive", title: "Aşamalı teslimat planı uygun", description: "Proje 3 aşamaya bölünmüş ve her aşama sonunda teslimat onayı mekanizması öngörülmüştür.", clause: "Madde 3.2", section: "Proje Kapsamı" },
    // Ürün Direktörü bulguları
    { id: "s3-f-013", agentId: "product-director", category: "missing-risky", severity: "warning", title: "Teknoloji seçimi kısıtlaması yok", description: "Danışmanın önerebileceği teknoloji çözümleri için bağımsızlık veya çıkar çatışması kontrolü öngörülmemiştir. Danışman kendi ortaklık anlaşması olan ürünleri önerebilir.", section: "Bağımsızlık" },
  ],
  correctionRequests: [
    { id: "s3-cr-001", fromAgentId: "finance-director", toAgentId: "legal-counsel", finding: "Kapsam değişikliği maliyet kontrolü", correction: "Hukuk, yazılı değişiklik emri prosedürü, bütçe eşik değeri (%10 üstü yönetim onayı) ve aylık bütçe raporlama yükümlülüğü içeren bir madde eklemelidir.", priority: "high" },
    { id: "s3-cr-002", fromAgentId: "legal-counsel", toAgentId: "finance-director", finding: "Performans bazlı ödeme", correction: "Finans, toplam bedelin %20'sini aşama tamamlama onayına bağlayan bir milestone ödeme yapısı tasarlamalıdır.", priority: "high" },
    { id: "s3-cr-003", fromAgentId: "tax-advisor", toAgentId: "finance-director", finding: "Stopaj vergisi etkisi", correction: "Finans, olası %15-20 stopaj kesintisinin nakit akışına etkisini hesaplamalı ve brüt/net ödeme tercihini netleştirmelidir.", priority: "medium" },
  ],
  disagreements: [
    { id: "s3-d-001", agentAId: "legal-counsel", agentBId: "finance-director", topic: "Fikri mülkiyet devir kapsamı", positionA: "Proje kapsamında üretilen tüm çıktılar — araçlar, şablonlar ve metodoloji dahil — müşteriye devredilmelidir. Danışman yalnızca genel bilgi birikimini koruyabilir.", positionB: "Tam devir danışman maliyetini artırır. Danışmanın standart araç ve şablonları lisans modeliyle kullanıma sunulmalı, yalnızca projeye özgü çıktılar devredilmelidir.", resolution: "Projeye özgü çıktılar tam devir, danışmanın önceden var olan araçları kalıcı, devredilemeyen lisansla müşteriye sunulur. 'Önceden var olan' envanteri sözleşme ekinde tanımlanır.", resolvedBy: "chief-agent" },
  ],
  revisionSuggestions: [
    { id: "s3-rs-001", agentId: "legal-counsel", section: "Madde 7.1 — Fikri Mülkiyet", currentText: "Proje çıktıları müşteriye aittir. Danışmanın önceden var olan araçları ve metodolojisi bu devrin dışındadır.", suggestedText: "Projeye özgü tüm çıktılar (raporlar, analizler, özelleştirilmiş araçlar) teslim anında müşteriye devredilir. Danışmanın önceden var olan araçları EK-B'de listelenir ve müşteriye kalıcı, münhasır olmayan, devredilemez lisans kapsamında sunulur. Proje sırasında geliştirilen ancak danışman metodolojisi üzerine inşa edilen araçlar için ortak sahiplik ve karşılıklı kullanım hakkı tanınır.", rationale: "Mevcut 'önceden var olan' istisnası tanımsız olup proje sırasında geliştirilen tüm araçların danışmanda kalmasına yol açabilir. Envanter listesi ve hibrit model her iki tarafın çıkarlarını korur.", priority: "high" },
    { id: "s3-rs-002", agentId: "finance-director", section: "Madde 4.3 — Kapsam Değişikliği", currentText: "Kapsam değişiklikleri karşılıklı mutabakat ile gerçekleştirilir ve ek ücretlendirme uygulanabilir.", suggestedText: "Kapsam değişiklikleri yazılı Değişiklik Emri ile talep edilir. Her Değişiklik Emri kapsamı, ek süreyi, ek maliyeti ve etkiyi belirtir. Toplam proje bedelinin %10'unu aşan değişiklikler üst yönetim onayı gerektirir. Aylık bütçe kullanım raporu müşteriye sunulur.", rationale: "Resmi değişiklik yönetimi prosedürü olmadan kapsam kayması ve kontrolsüz bütçe aşımı kaçınılmazdır.", priority: "high" },
    { id: "s3-rs-003", agentId: "legal-counsel", section: "Madde 10.2 — Gizlilik Süresi", currentText: "Gizlilik yükümlülüğü, bu Sözleşme'nin sona ermesinden itibaren 1 (bir) yıl süreyle geçerlidir.", suggestedText: "Gizlilik yükümlülüğü, bu Sözleşme'nin sona ermesinden itibaren 3 (üç) yıl süreyle geçerlidir. Ticari sırlar ve kişisel veriler için gizlilik yükümlülüğü süresizdir.", rationale: "Dijital dönüşüm projesinde elde edilen stratejik ve operasyonel bilgiler 1 yıldan fazla rekabet değeri taşır. 3 yıl sektör standardıdır.", priority: "high" },
  ],
};
