// ============================================================
// Compare Module — Mock Diff Engine (Faz 1)
// ============================================================
//
// Synchronous generator that produces a realistic-looking
// CompareRun for any pair of uploaded documents. Used to drive
// the UI end-to-end before the real diff engine + agent land in
// Faz 2 / Faz 3. Replace with the real pipeline later; the
// CompareRun shape stays the same.
// ============================================================

import {
  deriveStats,
  type CompareFinding,
  type CompareRun,
  type CompareDocumentMeta,
} from "./types";

const SAMPLE_FINDINGS: Omit<CompareFinding, "id">[] = [
  {
    clauseRef: "Madde 3.1",
    clauseTitle: "Ödeme Koşulları",
    type: "numeric_change",
    riskLevel: "high",
    v1Text:
      "Ödemeler fatura tarihinden itibaren 30 (otuz) gün içinde yapılır.",
    v2Text:
      "Ödemeler fatura tarihinden itibaren 60 (altmış) gün içinde yapılır.",
    summary: "Ödeme vadesi 30 günden 60 güne çıkarıldı.",
    impact:
      "Alıcı lehine nakit akışı esnekliği sağlanırken satıcının işletme sermayesi yükü iki katına çıkıyor. Finansman maliyeti hesaba katılmalı.",
    partyImpact: "favors_buyer",
  },
  {
    clauseRef: "Madde 7.2",
    clauseTitle: "Tazminat Üst Sınırı",
    type: "numeric_change",
    riskLevel: "high",
    v1Text:
      "Tarafların toplam sorumluluğu sözleşme bedelinin %100'ü ile sınırlıdır.",
    v2Text:
      "Tarafların toplam sorumluluğu sözleşme bedelinin %50'si ile sınırlıdır.",
    summary:
      "Tazminat sorumluluk üst sınırı %100'den %50'ye düşürüldü.",
    impact:
      "Büyük bir zarar durumunda alıcının tahsil edebileceği maksimum tutar yarıya indi. Yüksek riskli senaryolar için kapsam dışı kalma ihtimali doğuyor.",
    partyImpact: "favors_seller",
  },
  {
    clauseRef: "Madde 12",
    clauseTitle: "Fesih Bildirim Süresi",
    type: "reworded",
    riskLevel: "medium",
    v1Text:
      "Taraflar, diğer tarafa 30 gün önceden yazılı bildirimde bulunmak kaydıyla sözleşmeyi haklı neden olmaksızın feshedebilir.",
    v2Text:
      "Taraflar, diğer tarafa 90 gün önceden yazılı bildirimde bulunmak kaydıyla sözleşmeyi haklı neden olmaksızın feshedebilir.",
    summary: "Fesih bildirim süresi 30 günden 90 güne çıkarıldı.",
    impact:
      "Her iki taraf için de fesih süreci uzadı; ani çıkış senaryoları zorlaştı. Operasyonel bağımlılık yaratan yapılarda değerlendirilmeli.",
    partyImpact: "mutual_risk",
  },
  {
    clauseRef: "Ek-2",
    clauseTitle: "KVKK & Veri Sorumluluğu",
    type: "added",
    riskLevel: "medium",
    v1Text: null,
    v2Text:
      "Taraflar, işlenen kişisel veriler bakımından KVKK ve GDPR gerekliliklerini yerine getirmeyi, veri ihlali durumunda 72 saat içinde karşı tarafı bilgilendirmeyi taahhüt eder.",
    summary: "Yeni eklenen KVKK/GDPR uyum maddesi.",
    impact:
      "Veri sorumluluğu ve ihlal bildirim yükümlülüğü artık açıkça tanımlanıyor. İç süreçlerin bu bildirim süresini karşılaması için hazır olduğu teyit edilmeli.",
    partyImpact: "mutual_risk",
  },
  {
    clauseRef: "Madde 5.4",
    clauseTitle: "Garanti Süresi",
    type: "numeric_change",
    riskLevel: "medium",
    v1Text:
      "Teslim edilen ürün/hizmet için garanti süresi teslim tarihinden itibaren 24 aydır.",
    v2Text:
      "Teslim edilen ürün/hizmet için garanti süresi teslim tarihinden itibaren 12 aydır.",
    summary: "Garanti süresi 24 aydan 12 aya indirildi.",
    impact:
      "Alıcının garanti kapsamı yarı yarıya daraldı. Uzatılmış garanti satın alma seçeneği değerlendirilebilir.",
    partyImpact: "favors_seller",
  },
  {
    clauseRef: "Madde 9",
    clauseTitle: "Gizlilik",
    type: "reworded",
    riskLevel: "low",
    v1Text:
      "Taraflar sözleşme kapsamında edindikleri bilgileri gizli tutmayı kabul eder.",
    v2Text:
      "Taraflar, sözleşme kapsamında edindikleri her türlü bilgiyi, sözleşmenin sona ermesinden itibaren 5 yıl süreyle gizli tutmayı taahhüt eder.",
    summary:
      "Gizlilik yükümlülüğüne 5 yıllık post-contract süre eklendi.",
    impact:
      "Gizlilik artık sözleşme bitiminden sonra da 5 yıl devam ediyor. Olumlu gelişme; standart endüstri uygulamasıyla uyumlu.",
    partyImpact: "mutual_risk",
  },
  {
    clauseRef: "Madde 4.1",
    clauseTitle: "Fiyatlandırma",
    type: "reworded",
    riskLevel: "low",
    v1Text:
      "Fiyatlar EUR cinsindendir. Ödemeler ödeme tarihindeki TCMB döviz satış kuru üzerinden TL olarak yapılır.",
    v2Text:
      "Fiyatlar EUR cinsindendir. Ödemeler, fatura tarihindeki TCMB döviz satış kuru üzerinden TL olarak yapılır.",
    summary:
      "Kur referansı 'ödeme tarihi' yerine 'fatura tarihi' olarak değişti.",
    impact:
      "Kur riski küçük ölçüde satıcıdan alıcıya kaydı. TL düşüşlerinde alıcı için maliyet daha öngörülebilir hale geldi.",
    partyImpact: "favors_buyer",
  },
  {
    clauseRef: "Madde 2.3",
    clauseTitle: "Tanımlar — 'Yetkili Temsilci'",
    type: "removed",
    riskLevel: "low",
    v1Text:
      '"Yetkili Temsilci": Tarafların bu sözleşme kapsamında kendilerini temsil etmek üzere atadığı kişiyi ifade eder.',
    v2Text: null,
    summary: "Eski versiyondaki 'Yetkili Temsilci' tanımı kaldırıldı.",
    impact:
      "Tanım kaldırıldı fakat terim sözleşmenin diğer bölümlerinde hâlâ geçiyor olabilir. Sözleşme genelinde referans taraması yapılmalı.",
    partyImpact: "mutual_risk",
  },
  {
    clauseRef: "Madde 15",
    clauseTitle: "Uyuşmazlık Çözümü",
    type: "material",
    riskLevel: "high",
    v1Text:
      "Bu sözleşmeden doğan uyuşmazlıklarda İstanbul Mahkemeleri yetkilidir.",
    v2Text:
      "Bu sözleşmeden doğan uyuşmazlıklar ICC Tahkim Kuralları uyarınca Londra'da tahkim yoluyla çözülür.",
    summary:
      "Uyuşmazlık çözüm yeri İstanbul mahkemelerinden Londra ICC tahkimine taşındı.",
    impact:
      "Uyuşmazlık süreci maliyeti ve süresi ciddi şekilde artar. Türk hukuku yerine ICC prosedürü uygulanır — yerel avantaj kaybı.",
    partyImpact: "favors_seller",
  },
  {
    clauseRef: "Madde 1",
    clauseTitle: "Taraflar",
    type: "cosmetic",
    riskLevel: "low",
    v1Text: "iş bu Sözleşme",
    v2Text: "İşbu Sözleşme",
    summary: "Yazım düzeltmesi ('iş bu' → 'İşbu').",
    impact: "Kozmetik düzeltme; hukuki içerik değişmedi.",
    partyImpact: "neutral",
  },
];

function randomId(): string {
  return `cmp_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a mock run from two document metas. Deterministic-ish: every
 * call produces the same set of findings so the UI is stable during
 * development, but run id + timestamps are fresh.
 */
export function buildMockRun(
  v1: CompareDocumentMeta,
  v2: CompareDocumentMeta,
): CompareRun {
  const findings: CompareFinding[] = SAMPLE_FINDINGS.map((f) => ({
    ...f,
    id: randomId(),
  }));
  return {
    id: randomId(),
    createdAt: new Date().toISOString(),
    status: "complete",
    v1,
    v2,
    findings,
    stats: deriveStats(findings),
  };
}
