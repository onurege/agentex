import type { DemoScenario } from "../types";

export const SAAS_MASTER_SCENARIO: DemoScenario = {
  id: "saas-master",
  name: "SaaS Platform Ana Sözleşmesi",
  shortName: "SaaS Platform",
  description:
    "Kurumsal SaaS platform sözleşmesi — veri işleme, SLA taahhütleri, otomatik yenileme, entegrasyon",
  emoji: "☁️",
  document: {
    id: "doc-002",
    name: "SaaS_Platform_Master_Agreement_v2.1.pdf",
    type: "pdf",
    size: 1_890_000,
    uploadedAt: new Date().toISOString(),
    pageCount: 18,
    summary:
      "Kurumsal SaaS platform hizmet sözleşmesi — veri işleme koşulları, SLA taahhütleri, otomatik yenileme mekanizması, API entegrasyon kapsamı ve lisans yönetimini düzenlemektedir.",
  },
  businessContext: {
    notes: [
      "500+ kullanıcı için kurumsal lisans gerekli",
      "Kişisel veri işleme AB sunucularında yapılmalı (KVKK/GDPR)",
      "Mevcut ERP sistemiyle API entegrasyonu kritik",
      "Yıllık sözleşme, 3 yıllık taahhüt bekleniyor",
      "Bütçe: yıllık 180.000 € - 250.000 € aralığı",
    ],
    industry: "Kurumsal Yazılım",
    dealType: "SaaS Platform Sözleşmesi",
  },
  chiefRecommendation: {
    documentType: "SaaS Platform Ana Sözleşmesi",
    riskCategories: [
      {
        name: "Veri Güvenliği ve Gizlilik",
        severity: "high",
        description:
          "Kişisel veri işleme koşulları ve veri lokalizasyonu gereksinimleri KVKK/GDPR uyumu açısından kritik önem taşımaktadır.",
      },
      {
        name: "Hukuki Sorumluluk",
        severity: "high",
        description:
          "Sorumluluk sınırları, tazminat ve fikri mülkiyet hakları açık biçimde düzenlenmemiş görünmektedir.",
      },
      {
        name: "Platform Bağımlılığı",
        severity: "medium",
        description:
          "Otomatik yenileme, veri taşınabilirliği ve çıkış stratejisi hükümleri yetersiz. Vendor lock-in riski bulunmaktadır.",
      },
      {
        name: "Finansal Koşullar",
        severity: "medium",
        description:
          "Fiyat artış mekanizması, lisans esnekliği ve erken fesih cezaları netleştirilmelidir.",
      },
      {
        name: "SLA ve Performans",
        severity: "medium",
        description:
          "Uptime garantisi ve hizmet kredisi mekanizması tanımlı ancak yaptırımlar yetersiz görünmektedir.",
      },
    ],
    recommendedAgents: [
      "legal-counsel",
      "product-director",
      "finance-director",
    ],
    rationale:
      "Bu SaaS platform sözleşmesi veri güvenliği, fikri mülkiyet ve platform bağımlılığı açısından önemli riskler barındırmaktadır. KVKK/GDPR uyumu, sorumluluk sınırları ve otomatik yenileme koşulları Hukuk incelemesi gerektirmektedir. SLA taahhütleri ve API entegrasyon kapsamı Ürün Direktörü değerlendirmesi, finansal koşullar ve lisans maliyeti Finans incelemesi gerektirmektedir.",
  },
  findings: [
    // Hukuk Danışmanı bulguları
    {
      id: "s2-f-001",
      agentId: "legal-counsel",
      category: "critical-issue",
      severity: "critical",
      title: "Veri işleme sözleşmesi (DPA) eksik",
      description:
        "Sözleşme kişisel veri işleme referansı içermekle birlikte bağımsız bir Veri İşleme Sözleşmesi (DPA) eki bulunmamaktadır. KVKK md.12 ve GDPR md.28 kapsamında veri sorumlusu-işleyen ilişkisi açıkça tanımlanmalıdır.",
      section: "Veri Koruma",
    },
    {
      id: "s2-f-002",
      agentId: "legal-counsel",
      category: "critical-issue",
      severity: "critical",
      title: "Sınırsız sorumluluk sınırlama maddesi",
      description:
        "Madde 11.1, sağlayıcının toplam sorumluluğunu son 12 aylık ücret toplamıyla sınırlamakta ancak veri ihlali, fikri mülkiyet ihlali ve kasıtlı zararlara istisna getirmemektedir. Bu durum alıcı için yetersiz koruma sağlamaktadır.",
      clause: "Madde 11.1",
      section: "Sorumluluk",
    },
    {
      id: "s2-f-003",
      agentId: "legal-counsel",
      category: "missing-risky",
      severity: "warning",
      title: "Otomatik yenileme iptal süresi çok kısa",
      description:
        "Madde 3.2, otomatik yenileme için 30 günlük iptal süresi öngörmektedir. 3 yıllık taahhütte bu süre yetersizdir; en az 90 gün olmalıdır.",
      clause: "Madde 3.2",
      section: "Süre ve Yenileme",
    },
    {
      id: "s2-f-004",
      agentId: "legal-counsel",
      category: "sufficient-positive",
      severity: "positive",
      title: "Fikri mülkiyet hakları korunmuş",
      description:
        "Madde 9, müşteri verisi ve özelleştirmeler üzerindeki fikri mülkiyet haklarını müşteriye ait olarak açıkça tanımlamaktadır.",
      clause: "Madde 9",
      section: "Fikri Mülkiyet",
    },
    // Ürün Direktörü bulguları
    {
      id: "s2-f-005",
      agentId: "product-director",
      category: "critical-issue",
      severity: "critical",
      title: "SLA yaptırım mekanizması yetersiz",
      description:
        "Platform %99.5 uptime garantisi sunmakla birlikte ihlal durumunda yalnızca %5 hizmet kredisi öngörmektedir. Kritik iş süreçleri için bu yaptırım caydırıcı değildir; kademeli kredi sistemi gereklidir.",
      clause: "Madde 7.2",
      section: "SLA",
    },
    {
      id: "s2-f-006",
      agentId: "product-director",
      category: "missing-risky",
      severity: "warning",
      title: "Veri taşınabilirliği garantisi yok",
      description:
        "Sözleşme sona erdiğinde veri dışa aktarım formatı, süresi ve maliyeti belirlenmemiştir. Vendor lock-in riski bulunmaktadır.",
      section: "Veri Yönetimi",
    },
    {
      id: "s2-f-007",
      agentId: "product-director",
      category: "missing-risky",
      severity: "warning",
      title: "API değişiklik bildirimi süresi tanımsız",
      description:
        "API endpoint değişiklikleri veya kaldırılmaları için önceden bildirim süresi tanımlanmamıştır. Mevcut ERP entegrasyonu risk altındadır.",
      clause: "Madde 8.3",
      section: "Entegrasyon",
    },
    {
      id: "s2-f-008",
      agentId: "product-director",
      category: "sufficient-positive",
      severity: "positive",
      title: "Kapsamlı API dokümantasyonu taahhüdü",
      description:
        "Sağlayıcı, güncel API dokümantasyonu ve sandbox ortamı sağlama taahhüdünde bulunmaktadır. Entegrasyon geliştirme süreci için olumludur.",
      clause: "Madde 8.1",
      section: "Entegrasyon",
    },
    // Finans Direktörü bulguları
    {
      id: "s2-f-009",
      agentId: "finance-director",
      category: "critical-issue",
      severity: "critical",
      title: "Sınırsız fiyat artışı mekanizması",
      description:
        "Madde 5.4, sağlayıcıya yenileme dönemlerinde herhangi bir üst sınır olmaksızın fiyat artışı hakkı tanımaktadır. 3 yıllık taahhütte bu durum bütçe planlamasını imkansız kılmaktadır.",
      clause: "Madde 5.4",
      section: "Ücretlendirme",
    },
    {
      id: "s2-f-010",
      agentId: "finance-director",
      category: "missing-risky",
      severity: "warning",
      title: "Erken fesih cezası orantısız",
      description:
        "Madde 15.3, erken fesih halinde kalan sürenin tamamının ödenmesini gerektirmektedir. Kademeli azalan bir ceza yapısı daha adil olacaktır.",
      clause: "Madde 15.3",
      section: "Fesih",
    },
    {
      id: "s2-f-011",
      agentId: "finance-director",
      category: "sufficient-positive",
      severity: "positive",
      title: "Esnek lisans ölçeklendirme",
      description:
        "Kullanıcı sayısı %20'ye kadar esnek artırılabilmekte ve çeyrek bazında ayarlanabilmektedir. Büyüme dönemleri için uygundur.",
      clause: "Madde 5.2",
      section: "Lisanslama",
    },
    // Vergi Danışmanı bulguları
    {
      id: "s2-f-012",
      agentId: "tax-advisor",
      category: "missing-risky",
      severity: "warning",
      title: "Dijital hizmet vergisi sorumluluğu belirsiz",
      description:
        "AB ülkelerinde uygulanan dijital hizmet vergisinin hangi tarafça karşılanacağı açıkça belirtilmemiştir.",
      section: "Vergi Hükümleri",
    },
    {
      id: "s2-f-013",
      agentId: "tax-advisor",
      category: "sufficient-positive",
      severity: "positive",
      title: "KDV fatura düzeni uyumlu",
      description:
        "B2B SaaS hizmetleri için KDV uygulaması ve fatura düzeni AB mevzuatına uygundur.",
      section: "Vergi Hükümleri",
    },
    // Satış Direktörü bulguları
    {
      id: "s2-f-014",
      agentId: "sales-director",
      category: "missing-risky",
      severity: "warning",
      title: "Hacim indirimi mekanizması yok",
      description:
        "500+ kullanıcılık kurumsal lisans için herhangi bir hacim indirimi veya kademeli fiyatlandırma öngörülmemiştir.",
      section: "Ücretlendirme",
    },
    {
      id: "s2-f-015",
      agentId: "sales-director",
      category: "sufficient-positive",
      severity: "positive",
      title: "Çoklu lokasyon desteği dahil",
      description:
        "Lisans, sınırsız lokasyon ve alt kuruluş kullanımını kapsamaktadır. Uluslararası operasyonlar için avantajlıdır.",
      section: "Lisanslama",
    },
  ],
  correctionRequests: [
    {
      id: "s2-cr-001",
      fromAgentId: "product-director",
      toAgentId: "legal-counsel",
      finding: "SLA yaptırım mekanizması",
      correction:
        "Hukuk, SLA ihlallerinde kademeli hizmet kredisi ve tekrarlayan ihlallerde fesih hakkı içeren bir madde hazırlamalıdır.",
      priority: "high",
    },
    {
      id: "s2-cr-002",
      fromAgentId: "finance-director",
      toAgentId: "legal-counsel",
      finding: "Fiyat artışı sınırlaması",
      correction:
        "Hukuk, yıllık fiyat artışını TÜFE+%3 ile sınırlayan ve 90 gün önceden bildirim gerektiren bir madde müzakere etmelidir.",
      priority: "high",
    },
    {
      id: "s2-cr-003",
      fromAgentId: "legal-counsel",
      toAgentId: "product-director",
      finding: "Veri taşınabilirliği gereksinimleri",
      correction:
        "Ürün, sözleşme sona erdiğinde kabul edilebilir veri dışa aktarım formatlarını ve minimum geçiş süresini tanımlamalıdır.",
      priority: "high",
    },
    {
      id: "s2-cr-004",
      fromAgentId: "product-director",
      toAgentId: "finance-director",
      finding: "API entegrasyon maliyeti",
      correction:
        "Finans, ERP entegrasyon geliştirme ve bakım maliyetini toplam sahip olma maliyetine dahil etmelidir.",
      priority: "medium",
    },
  ],
  disagreements: [
    {
      id: "s2-d-001",
      agentAId: "product-director",
      agentBId: "legal-counsel",
      topic: "SLA ihlalinde fesih hakkı kapsamı",
      positionA:
        "Ardışık 3 ay %99.5 altında performans gösterilmesi halinde derhal fesih hakkı tanınmalıdır — platform kritik iş altyapısıdır.",
      positionB:
        "Otomatik fesih yerine iyileştirme süresi tanınmalıdır. Ani geçiş iş sürekliliğini tehlikeye atar.",
      resolution:
        "3 ardışık ay SLA ihlali halinde 60 günlük iyileştirme süresi, ardından cezasız fesih hakkı. Kritik veri ihlalinde derhal fesih.",
      resolvedBy: "chief-agent",
    },
    {
      id: "s2-d-002",
      agentAId: "finance-director",
      agentBId: "product-director",
      topic: "Erken fesih cezası yapısı",
      positionA:
        "Erken fesih cezası kalan sürenin %50'sini aşmamalıdır — tam ödeme orantısızdır.",
      positionB:
        "Sağlayıcının yatırım geri dönüşü korunmalıdır, ancak veri migrasyonu ve geçiş desteği cezaya dahil edilmelidir.",
      resolution:
        "İlk yıl %75, ikinci yıl %50, üçüncü yıl %25 azalan ceza yapısı. Tüm durumlarda 90 günlük veri migrasyonu desteği dahil.",
      resolvedBy: "chief-agent",
    },
  ],
  revisionSuggestions: [
    {
      id: "s2-rs-001",
      agentId: "legal-counsel",
      section: "Yeni Ek — Veri İşleme Sözleşmesi",
      currentText: "[DPA eki bulunmuyor]",
      suggestedText:
        "Bu Sözleşme'nin ayrılmaz parçası olarak EK-A Veri İşleme Sözleşmesi (DPA) eklenecektir. DPA, KVKK md.12 ve GDPR md.28 uyarınca veri sorumlusu-işleyen yükümlülüklerini, veri lokalizasyonu gereksinimlerini, ihlal bildirim prosedürlerini ve alt işleyen onay mekanizmasını düzenleyecektir.",
      rationale:
        "KVKK ve GDPR uyumu için bağımsız DPA zorunludur. Veri ihlali durumunda yasal sorumluluk ve idari yaptırım riski bulunmaktadır.",
      priority: "high",
    },
    {
      id: "s2-rs-002",
      agentId: "product-director",
      section: "Madde 7.2 — SLA Hizmet Kredisi",
      currentText:
        "Platform kullanılabilirliğinin aylık %99.5 altında kalması halinde, ilgili aya ait hizmet bedelinin %5'i oranında hizmet kredisi uygulanacaktır.",
      suggestedText:
        "Hizmet kredisi kademeli olarak uygulanacaktır: %99.5-99.0 arası %10, %99.0-98.0 arası %25, %98.0 altı %50 hizmet kredisi. Ardışık 3 ay %99.0 altında performans halinde müşteriye cezasız fesih hakkı doğar. Planlı bakım süreleri uptime hesabına dahil edilmez.",
      rationale:
        "Mevcut %5 kredi caydırıcı değildir. Kademeli sistem sağlayıcıyı performans tutmaya teşvik eder ve müşteriye anlamlı koruma sağlar.",
      priority: "high",
    },
    {
      id: "s2-rs-003",
      agentId: "finance-director",
      section: "Madde 5.4 — Fiyat Ayarlaması",
      currentText:
        "Sağlayıcı, yenileme döneminde hizmet ücretlerini güncel piyasa koşullarına göre ayarlama hakkını saklı tutar.",
      suggestedText:
        "Yenileme döneminde fiyat ayarlaması, bir önceki yılın TÜFE artışı + %3 ile sınırlıdır. Fiyat artışı en az 90 gün önceden yazılı olarak bildirilir. Müşteri, artışı kabul etmemesi halinde mevcut fiyat üzerinden 6 ay daha hizmet alma hakkına sahiptir.",
      rationale:
        "Sınırsız fiyat artışı hakkı, 3 yıllık taahhütte bütçe öngörülemezliği yaratır. TÜFE+%3 formülü piyasa standardıdır.",
      priority: "high",
    },
  ],
};
