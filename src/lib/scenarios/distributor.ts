import type { DemoScenario } from "../types";

/** Senaryo 1 — Bayi Dağıtım Sözleşmesi */
export const DISTRIBUTOR_SCENARIO: DemoScenario = {
  id: "distributor",
  name: "Bayi Dağıtım Sözleşmesi",
  shortName: "Bayi Dağıtım",
  description: "Çok yıllı bayi dağıtım sözleşmesi — bölge hakları, komisyon yapıları, performans yükümlülükleri",
  emoji: "🏭",
  document: {
    id: "doc-001",
    name: "Bayi_Dagitim_Sozlesmesi_v3.2.pdf",
    type: "pdf",
    size: 2_456_000,
    uploadedAt: new Date().toISOString(),
    pageCount: 24,
    summary:
      "Bölge hakları, komisyon yapıları, platform kullanım gereksinimleri ve SaaS destekli dağıtım kanalı için performans yükümlülüklerini kapsayan çok yıllı bayi dağıtım sözleşmesi.",
  },
  businessContext: {
    notes: [
      "Ekipman dağıtımı için kiralama modeli kullanılacak",
      "Faturalar merkezi olarak genel merkezden kesilecek",
      "Bayi komisyon bazlı çalışmaktadır (%12-18 aralığı)",
      "Tüm işlemler için tam platform kullanımı zorunludur",
      "Bayiden 250.000 € banka teminatı gereklidir",
      "Bölge: Orta Avrupa (DACH bölgesi)",
    ],
    industry: "Endüstriyel Ekipman",
    dealType: "Bayi Dağıtım Sözleşmesi",
  },
  chiefRecommendation: {
    documentType: "Bayi Dağıtım Sözleşmesi",
    riskCategories: [
      {
        name: "Finansal Maruz Kalma",
        severity: "high",
        description: "Çok kademeli hesaplama içeren karmaşık komisyon yapısı. Banka teminatı gereksinimleri ve ödeme koşulları dikkatli inceleme gerektiriyor.",
      },
      {
        name: "Hukuki Sorumluluk",
        severity: "high",
        description: "Tazminat maddeleri tek taraflı görünüyor. Bölge münhasırlığı koşulları düzenleyici maruziyet yaratabilir.",
      },
      {
        name: "Vergi ve Uyumluluk",
        severity: "medium",
        description: "DACH bölgesi operasyonları için sınır ötesi faturalandırma ve stopaj gereksinimleri doğrulanmalıdır.",
      },
      {
        name: "Ticari Koşullar",
        severity: "medium",
        description: "Minimum performans hedefleri ve münhasırlık yükümlülükleri bayi esnekliğini kısıtlayabilir.",
      },
      {
        name: "Platform Yükümlülükleri",
        severity: "low",
        description: "Sağlayıcı tarafından SLA taahhütleriyle birlikte zorunlu platform kullanım maddesi.",
      },
    ],
    recommendedAgents: ["legal-counsel", "finance-director", "tax-advisor", "sales-director"],
    rationale: "Bu bayi dağıtım sözleşmesi önemli finansal ve hukuki karmaşıklık içermektedir. Çok kademeli komisyon yapısı, banka teminatı gereksinimleri ve sınır ötesi vergi etkileri Hukuk, Finans ve Vergi alanında uzman incelemesi gerektirmektedir. Münhasırlık ve minimum performans hedeflerine ilişkin ticari koşullar Satış Direktörü katılımını gerektirmektedir.",
  },
  findings: [
    { id: "f-001", agentId: "legal-counsel", category: "critical-issue", severity: "critical", title: "Tek taraflı tazminat maddesi", description: "Madde 14.2, bayinin karşılıklı yükümlülük olmaksızın şirketi tüm üçüncü taraf taleplere karşı tazmin etmesini gerektirmektedir. Bu durum bayi için sınırsız sorumluluk riski yaratmakta ve Alman mahkemelerinde uygulanamaz bulunabilir.", clause: "Madde 14.2", section: "Tazminat" },
    { id: "f-002", agentId: "legal-counsel", category: "missing-risky", severity: "warning", title: "Mücbir sebep maddesi eksik", description: "Mücbir sebep hükmü bulunmamaktadır. Çok yıllı süre ve performans yükümlülükleri göz önünde bulundurulduğunda, bu eksiklik tedarik zinciri aksaklıkları veya mevzuat değişikliklerinde her iki taraf için de risk oluşturmaktadır.", section: "Genel Hükümler" },
    { id: "f-003", agentId: "legal-counsel", category: "sufficient-positive", severity: "positive", title: "Açık fesih hükümleri", description: "Madde 18'deki fesih maddesi, net tasfiye prosedürleriyle birlikte 90 günlük ihbar süresini öngörmektedir. Her iki taraf da makul çıkış haklarına sahiptir.", clause: "Madde 18", section: "Fesih" },
    { id: "f-004", agentId: "finance-director", category: "critical-issue", severity: "critical", title: "Belirsiz komisyon hesaplama tabanı", description: "Madde 8.3, komisyon tabanı olarak 'net geliri' referans almakta ancak iade, indirim veya nakliyenin hariç tutulup tutulmadığını tanımlamamaktadır. Bu durum yıllık komisyon ödemelerinde %3-5 oranında farklılığa yol açabilir.", clause: "Madde 8.3", section: "Komisyon Yapısı" },
    { id: "f-005", agentId: "finance-director", category: "missing-risky", severity: "warning", title: "Kur riskine karşı koruma hükmü yok", description: "Sözleşme EUR ödemelerini öngörmekle birlikte İsviçre bölgesi için CHF cinsinden performans hedefleri içermektedir. Döviz kuru dalgalanmaları için herhangi bir kur düzeltme mekanizması bulunmamaktadır.", section: "Ödeme Koşulları" },
    { id: "f-006", agentId: "finance-director", category: "sufficient-positive", severity: "positive", title: "Makul ödeme koşulları", description: "Net 30 ödeme koşulları ile %2 erken ödeme indirimi. Nakit akışı yönetimi açısından sektör standardı ve avantajlıdır.", clause: "Madde 9.1", section: "Ödeme Koşulları" },
    { id: "f-007", agentId: "tax-advisor", category: "critical-issue", severity: "critical", title: "Stopaj vergisi düzenlenmemiş", description: "DACH bölgesine yapılan sınır ötesi komisyon ödemeleri stopaj vergisi yükümlülüğü doğurabilir. Stopaj vergisi brüt artırım maddesi bulunmamakta olup bayi için potansiyel çifte vergilendirme riski yaratmaktadır.", section: "Vergi Hükümleri" },
    { id: "f-008", agentId: "tax-advisor", category: "missing-risky", severity: "warning", title: "Transfer fiyatlandırması belgeleme eksikliği", description: "Komisyon oranlarının Almanya ve Avusturya'daki vergi otoritelerinin itirazlarından korunması için transfer fiyatlandırması belgeleriyle desteklenmesi gerekmektedir.", section: "Uyumluluk" },
    { id: "f-009", agentId: "tax-advisor", category: "sufficient-positive", severity: "positive", title: "KDV uygulaması doğru yapılandırılmış", description: "AB içi B2B sınır ötesi işlemler için KDV ters mekanizması doğru şekilde belirtilmiştir.", clause: "Madde 10.4", section: "Vergi Hükümleri" },
    { id: "f-010", agentId: "sales-director", category: "critical-issue", severity: "critical", title: "Gerçekçi olmayan minimum performans hedefleri", description: "Madde 6.2, 2. yılda %40 ve 3. yılda %30 yıllık büyüme gerektirmektedir. Bu hedefler sektör karşılaştırma ölçütlerinin 2 katını aşmakta ve erken feshe yol açabilir.", clause: "Madde 6.2", section: "Performans Yükümlülükleri" },
    { id: "f-011", agentId: "sales-director", category: "missing-risky", severity: "warning", title: "Bölge koruma güvencesi olmayan münhasırlık", description: "Bayiye münhasırlık tanınmakla birlikte şirket, dijital kanallar aracılığıyla bölge içinde doğrudan satış hakkını saklı tutmakta; bu durum münhasırlık hükmünü fiilen geçersiz kılmaktadır.", clause: "Madde 4.1", section: "Bölge Hakları" },
    { id: "f-012", agentId: "sales-director", category: "sufficient-positive", severity: "positive", title: "İyi komisyon oranı yapısı", description: "Kademeli bonuslarla %18'e kadar çıkan %15 taban komisyon oranı, endüstriyel ekipman sektörü için rekabetçidir.", clause: "Madde 8.1", section: "Komisyon Yapısı" },
    { id: "f-013", agentId: "product-director", category: "missing-risky", severity: "warning", title: "SLA yaptırımları tanımsız", description: "Platform kullanımı zorunlu olmasına rağmen kesinti durumunda yaptırım mekanizması veya hizmet kredisi tanımlanmamıştır. Bayinin platform bağımlılığı risk oluşturmaktadır.", clause: "Madde 12.1", section: "Platform Yükümlülükleri" },
    { id: "f-014", agentId: "product-director", category: "sufficient-positive", severity: "positive", title: "API entegrasyon kapsamı uygun", description: "Platform API dokümantasyonu ve entegrasyon desteği sözleşme kapsamında açıkça tanımlanmış.", clause: "Madde 12.4", section: "Platform Yükümlülükleri" },
  ],
  correctionRequests: [
    { id: "cr-001", fromAgentId: "finance-director", toAgentId: "legal-counsel", finding: "Komisyon hesaplama tabanı tanımı", correction: "Hukuk, iade, nakliye ve promosyon indirimlerini kapsayan dışlamaları içerecek şekilde tanımlar bölümüne 'net gelir' için açık bir tanım eklemelidir.", priority: "high" },
    { id: "cr-002", fromAgentId: "tax-advisor", toAgentId: "finance-director", finding: "Stopaj vergisinin komisyon ödemelerine etkisi", correction: "Finans, komisyon ödemeleri üzerindeki potansiyel %15-25 stopaj vergisinin nakit akışı etkisini modellemeli ve finansal projeksiyonlara brüt artırım mekanizması dahil edilmelidir.", priority: "high" },
    { id: "cr-003", fromAgentId: "sales-director", toAgentId: "legal-counsel", finding: "Performans hedeflerinin makullüğü", correction: "Hukuk, performans hedeflerini sektör ölçütleriyle uyumlu hale getirmek üzere müzakere etmelidir: 2. yıl için %20 YoY, 3. yıl için %15 YoY ve üç aylık inceleme mekanizması.", priority: "medium" },
    { id: "cr-004", fromAgentId: "legal-counsel", toAgentId: "sales-director", finding: "Münhasırlık maddesi çatışması", correction: "Satış, ticari niyeti netleştirmelidir: ya münhasırlık iddiasından vazgeçilmeli ya da dijital kanal kısıtlamaları dahil gerçek bölge koruması müzakere edilmelidir.", priority: "medium" },
    { id: "cr-005", fromAgentId: "product-director", toAgentId: "legal-counsel", finding: "Platform SLA yaptırımları", correction: "Hukuk, platform kesintileri için hizmet kredisi ve yaptırım mekanizması tanımlayan bir madde eklemelidir.", priority: "medium" },
  ],
  disagreements: [
    { id: "d-001", agentAId: "sales-director", agentBId: "legal-counsel", topic: "Minimum performans hedeflerinin uygulanması", positionA: "Minimum performans hedefleri tamamen kaldırılmalıdır — bu hedefler çatışmacı bir dinamik yaratmakta ve yeni bir bölgeye giriş için gerçekçi değildir.", positionB: "Minimum performans hedefleri şirketin bölge münhasırlığına yaptığı yatırımı korumak için zorunludur. Hedefler kaldırılmak yerine revize edilmelidir.", resolution: "Hedefleri sektör standardı seviyelere düşürün (%20 2. yıl, %15 3. yıl), 6 aylık muafiyet süresi ve karşılıklı inceleme maddesiyle destekleyin.", resolvedBy: "chief-agent" },
    { id: "d-002", agentAId: "finance-director", agentBId: "tax-advisor", topic: "Komisyon stopaj vergisi paylaşımı", positionA: "Stopaj vergisi, bölgede iş yapmanın bir maliyeti olarak bayi tarafından karşılanmalıdır.", positionB: "Vergi brüt artırım maddesi, sınır ötesi dağıtım sözleşmelerinde standart bir uygulamadır ve her iki taraf için de uyumluluk riskini azaltır.", resolution: "Alınan fiili vergi kredilerine karşı yıllık mutabakat ile %15 üst sınırlı stopaj vergisi brüt artırım maddesi eklenmelidir.", resolvedBy: "chief-agent" },
  ],
  revisionSuggestions: [
    { id: "rs-001", agentId: "legal-counsel", section: "Madde 14.2 — Tazminat", currentText: "Bayi, bu Sözleşme kapsamındaki Bayi performansından kaynaklanan veya bununla ilgili her türlü talep, zarar, kayıp, maliyet ve gidere karşı Şirketi tazmin edecek ve zarardan koruyacaktır.", suggestedText: "Her taraf, (a) tazmin eden tarafın bu Sözleşme'yi ihlalinden, (b) tazmin eden tarafın ihmalinden veya kasıtlı eyleminden ya da (c) tazmin eden tarafın yürürlükteki mevzuatı ihlal etmesinden kaynaklanan talep, zarar, kayıp, maliyet ve giderlere karşı diğer tarafı tazmin edecek ve zarardan koruyacaktır. Tazmin eden tarafın bu madde kapsamındaki toplam sorumluluğu, önceki 12 aylık dönemde ödenen veya ödenecek toplam komisyon tutarını aşmayacaktır.", rationale: "Sorumluluk sınırlı karşılıklı tazminat, dağıtım sözleşmeleri için piyasa standardıdır. Tek taraflı sınırsız tazminat, Alman hukuku kapsamında uygulanamaz bulunabilir (§307 BGB).", priority: "high" },
    { id: "rs-002", agentId: "finance-director", section: "Madde 8.3 — Komisyon Hesaplama", currentText: "Komisyonlar, Bölge içindeki satışlardan elde edilen net gelirin yüzdesi olarak hesaplanacaktır.", suggestedText: "Komisyonlar, Net Gelirin yüzdesi olarak hesaplanacaktır. 'Net Gelir', brüt fatura değerinden (a) ürün iadeleri ve tahakkuklar, (b) ticari indirimler ve geri ödemeler, (c) nakliye ve sigorta masrafları ile (d) geçerli vergiler düşüldükten sonra kalan tutarı ifade eder. Şirket tarafından çeyrek sonu itibarıyla 15 iş günü içinde üç aylık mutabakat raporu sunulacaktır.", rationale: "'Net gelir' için açık tanım, komisyon hesaplamalarındaki tahmini %3-5 farklılığı ortadan kaldırır ve bayiye denetim şeffaflığı sağlar.", priority: "high" },
    { id: "rs-003", agentId: "sales-director", section: "Madde 6.2 — Performans Hedefleri", currentText: "Bayi, bir önceki yıl baz alınarak ölçülen yıllık minimum satış büyümesini 2. Yılda %40 ve 3. Yılda %30 oranında gerçekleştirecektir.", suggestedText: "Bayi, aşağıdaki büyüme hedeflerini gerçekleştirmek için ticari açıdan makul çaba gösterecektir: bir önceki yıl baz alınarak 2. Yılda %20 ve 3. Yılda %15. Hedefler, piyasa koşulları ve bölgeye özgü faktörler gözetilerek her yıllık iş değerlendirmesinde karşılıklı incelemeye tabi tutulacaktır.", rationale: "Mevcut hedefler sektör ölçütlerinin 2 katıdır ve fesih riski yaratmaktadır. Revize edilmiş hedefler piyasa normlarıyla uyumlu olmakla birlikte şirketin bölge geliştirme çıkarlarını da korumaktadır.", priority: "high" },
    { id: "rs-004", agentId: "tax-advisor", section: "Yeni Madde — Stopaj Vergisi", currentText: "[Mevcut hüküm yok]", suggestedText: "Yürürlükteki mevzuat uyarınca komisyon ödemelerinden stopaj vergisi kesilmesi gerektiğinde, Şirket ödemeyi brüt olarak yapacak ve böylece Bayi'nin net olarak aldığı tutar, söz konusu stopaj yapılmamış olsaydı alınacak komisyon tutarına eşit olacaktır. Brüt artırım yükümlülüğü, taban komisyon tutarının %15'ini aşmayacaktır.", rationale: "AB ve DACH yetki alanları arasındaki sınır ötesi komisyon ödemeleri stopaj vergisi yükümlülüğü doğurabilir. Üst sınırlı brüt artırım maddesi standart bir uygulamadır ve çifte vergilendirme anlaşmazlıklarını önler.", priority: "medium" },
  ],
};
