// ============================================================
// Draft Template — Gizlilik Sözleşmesi (NDA)
// ============================================================
//
// Türk hukuk ekseninde NDA şablonu. TBK m.1 (sözleşmenin
// kurulması), TBK m.27 (belirlilik), TBK m.179-182 (cezai şart),
// TBK m.444-447 (rekabet yasağı), TTK m.55 (haksız rekabet),
// KVKK m.10-12 referansları ile hazırlandı. Avukat onayı yerini
// tutmaz; piyasa pratiğinde tipik olanı şablonlaştırır.
//
// Akdin türüne göre iki varyant: one_way (tek taraflı ifşa) ve
// mutual (karşılıklı). Placeholder sözdizimi renderer tarafından
// çözülür (src/lib/draft/renderer.ts):
//   {{path}}              — string yerleştirme
//   {{#if path}}...{{/if}} — truthy kontrol
//   {{#if path=val}}...{{/if}} — eşitlik kontrolü
// ============================================================

import type { DraftTemplate } from "../types";

export const NDA_TEMPLATE: DraftTemplate = {
  id: "nda",
  label: "Gizlilik Sözleşmesi (NDA)",
  description:
    "İki taraf arasında paylaşılacak bilgilerin korunması için tek taraflı veya karşılıklı gizlilik sözleşmesi.",
  category: "Gizlilik",
  iconKey: "lock",
  estimatedMinutes: 5,
  documentTitle: "GİZLİLİK SÖZLEŞMESİ",

  questions: [
    // ── Step 1 — Taraflar ──
    {
      id: "partyA.name",
      step: 1,
      group: "Taraflar",
      label: "Taraf A — Unvan / Ad Soyad",
      helpText: "Tüzel kişi ise ticaret sicildeki tam unvanı yazın.",
      type: "text",
      required: true,
    },
    {
      id: "partyA.type",
      step: 1,
      group: "Taraflar",
      label: "Taraf A — Tür",
      type: "radioGroup",
      required: true,
      defaultValue: "company",
      options: [
        { value: "company", label: "Şirket / Tüzel Kişi" },
        { value: "individual", label: "Gerçek Kişi" },
      ],
    },
    {
      id: "partyA.taxNo",
      step: 1,
      group: "Taraflar",
      label: "Taraf A — Vergi No / TC No",
      type: "text",
      required: true,
    },
    {
      id: "partyA.address",
      step: 1,
      group: "Taraflar",
      label: "Taraf A — Adres",
      type: "longText",
      required: true,
    },
    {
      id: "partyA.representative",
      step: 1,
      group: "Taraflar",
      label: "Taraf A — Yetkili Temsilci",
      helpText: "İmzaya yetkili kişinin ad soyad ve unvanı.",
      type: "text",
      required: true,
    },
    {
      id: "partyB.name",
      step: 1,
      group: "Taraflar",
      label: "Taraf B — Unvan / Ad Soyad",
      type: "text",
      required: true,
    },
    {
      id: "partyB.type",
      step: 1,
      group: "Taraflar",
      label: "Taraf B — Tür",
      type: "radioGroup",
      required: true,
      defaultValue: "company",
      options: [
        { value: "company", label: "Şirket / Tüzel Kişi" },
        { value: "individual", label: "Gerçek Kişi" },
      ],
    },
    {
      id: "partyB.taxNo",
      step: 1,
      group: "Taraflar",
      label: "Taraf B — Vergi No / TC No",
      type: "text",
      required: true,
    },
    {
      id: "partyB.address",
      step: 1,
      group: "Taraflar",
      label: "Taraf B — Adres",
      type: "longText",
      required: true,
    },
    {
      id: "partyB.representative",
      step: 1,
      group: "Taraflar",
      label: "Taraf B — Yetkili Temsilci",
      type: "text",
      required: true,
    },

    // ── Step 2 — Akdin Türü ──
    {
      id: "ndaType",
      step: 2,
      group: "Akdin Türü",
      label: "Akdin türü",
      helpText:
        "Tek taraflıda yalnızca bir taraf bilgi ifşa eder; karşılıklıda her iki taraf da ifşa eder.",
      type: "radioGroup",
      required: true,
      aiSuggestable: true,
      defaultValue: "mutual",
      options: [
        {
          value: "mutual",
          label: "Karşılıklı (mutual)",
          description: "Her iki taraf da gizli bilgi paylaşır.",
        },
        {
          value: "one_way",
          label: "Tek taraflı (one-way)",
          description: "Yalnızca bir taraf (ifşa eden) bilgi paylaşır.",
        },
      ],
    },
    {
      id: "disclosingParty",
      step: 2,
      group: "Akdin Türü",
      label: "İfşa eden taraf",
      helpText: "Tek taraflı akitte gizli bilgiyi paylaşan taraf.",
      type: "radioGroup",
      required: true,
      defaultValue: "partyA",
      dependsOn: { questionId: "ndaType", equals: "one_way" },
      options: [
        { value: "partyA", label: "Taraf A" },
        { value: "partyB", label: "Taraf B" },
      ],
    },

    // ── Step 3 — Gizli Bilgi ──
    {
      id: "confidentialScope",
      step: 3,
      group: "Gizli Bilgi",
      label: "Gizli bilginin kapsamı",
      aiSuggestable: true,
      helpText:
        "Paylaşılacak bilgi türlerini seçin; sözleşmede tanım maddesinde tek tek sayılacak.",
      type: "multiCheckbox",
      required: true,
      defaultValue: ["technical", "commercial"],
      options: [
        { value: "technical", label: "Teknik bilgi (süreçler, yazılım, know-how)" },
        { value: "commercial", label: "Ticari bilgi (fiyat, strateji, müşteri)" },
        { value: "financial", label: "Finansal bilgi (bilanço, ciro)" },
        { value: "customer_list", label: "Müşteri / tedarikçi listesi" },
        { value: "personal_data", label: "Kişisel veri (KVKK kapsamı)" },
      ],
    },
    {
      id: "purposeDescription",
      step: 3,
      group: "Gizli Bilgi",
      label: "Amaç / proje tanımı",
      helpText:
        "Bu bilginin hangi amaç için paylaşıldığını 1-3 cümleyle anlatın. Ör: 'X projesinin değerlendirilmesi'.",
      type: "longText",
      required: true,
    },

    // ── Step 4 — Süre ──
    {
      id: "effectiveDate",
      step: 4,
      group: "Süre",
      label: "Yürürlük tarihi",
      type: "date",
      required: true,
      defaultValue: new Date().toISOString().slice(0, 10),
    },
    {
      id: "durationYears",
      step: 4,
      group: "Süre",
      label: "Gizlilik süresi (yıl)",
      helpText:
        "Sözleşme sona erse de bu süre boyunca gizlilik yükümlülüğü devam eder. Piyasa pratiği 2-5 yıl.",
      type: "number",
      required: true,
      defaultValue: 3,
      validation: { min: 1, max: 10 },
    },

    // ── Step 5 — Mali Koşullar (Opsiyonel) ──
    {
      id: "hasPenalty",
      step: 5,
      group: "Mali Koşullar",
      label: "Cezai şart eklensin mi?",
      aiSuggestable: true,
      helpText:
        "TBK m.179-182: ihlal halinde götürü tazminat. Fahiş ise hakim tarafından indirilebilir (m.182/3).",
      type: "checkbox",
      required: false,
      defaultValue: false,
    },
    {
      id: "penaltyAmount",
      step: 5,
      group: "Mali Koşullar",
      label: "Cezai şart tutarı (TL)",
      type: "currency",
      required: true,
      defaultValue: 100000,
      dependsOn: { questionId: "hasPenalty", equals: true },
      validation: { min: 0 },
    },

    // ── Step 6 — Opsiyonel Maddeler ──
    {
      id: "hasNonCompete",
      step: 6,
      group: "Opsiyonel Maddeler",
      label: "Rekabet yasağı eklensin mi?",
      aiSuggestable: true,
      helpText:
        "TBK m.444-447 sınırları: makul süre, coğrafi sınır ve iş konusu kısıtı. Çalışan NDA'sında kritik.",
      type: "checkbox",
      required: false,
      defaultValue: false,
    },
    {
      id: "nonCompeteDuration",
      step: 6,
      group: "Opsiyonel Maddeler",
      label: "Rekabet yasağı süresi (yıl)",
      type: "number",
      required: true,
      defaultValue: 1,
      dependsOn: { questionId: "hasNonCompete", equals: true },
      validation: { min: 0, max: 3 },
    },
    {
      id: "includeReverseEngineering",
      step: 6,
      group: "Opsiyonel Maddeler",
      label: "Tersine mühendislik yasağı eklensin mi?",
      type: "checkbox",
      required: false,
      defaultValue: true,
    },

    // ── Step 7 — Hukuki Altyapı ──
    {
      id: "jurisdictionCity",
      step: 7,
      group: "Hukuki Altyapı",
      label: "Yetkili mahkeme (il)",
      helpText: "HMK m.17 uyarınca tacirler arası yetki anlaşması yapılabilir.",
      type: "text",
      required: true,
      defaultValue: "İstanbul",
    },
  ],

  clauses: [
    {
      id: "parties",
      order: 1,
      number: "Madde 1",
      title: "Taraflar",
      required: true,
      defaultEnabled: true,
      aiEditable: false,
      requires: [
        "partyA.name",
        "partyA.address",
        "partyA.representative",
        "partyB.name",
        "partyB.address",
        "partyB.representative",
        "effectiveDate",
      ],
      template: `İşbu Gizlilik Sözleşmesi ("Sözleşme"), bir tarafta adresi {{partyA.address}} olan {{partyA.name}} ("Taraf A") ile diğer tarafta adresi {{partyB.address}} olan {{partyB.name}} ("Taraf B") arasında {{effectiveDate}} tarihinde akdedilmiştir. Taraflar ayrı ayrı "Taraf", birlikte "Taraflar" olarak anılacaktır. Taraf A adına {{partyA.representative}}, Taraf B adına {{partyB.representative}} imzaya yetkilidir.`,
    },
    {
      id: "subject",
      order: 2,
      number: "Madde 2",
      title: "Konu ve Amaç",
      required: true,
      defaultEnabled: true,
      aiEditable: true,
      requires: ["purposeDescription", "ndaType"],
      template: `Bu Sözleşmenin konusu, {{#if ndaType=mutual}}Tarafların karşılıklı olarak birbirlerine{{/if}}{{#if ndaType=one_way}}İfşa eden Taraf'ın Alıcı Taraf'a{{/if}} aşağıda tanımlanan amaç çerçevesinde açıklayacağı Gizli Bilgilerin korunması, kullanım koşulları ve Tarafların bu bilgilere ilişkin hak ve yükümlülüklerinin düzenlenmesidir. Amaç: {{purposeDescription}}.`,
    },
    {
      id: "confidential_info",
      order: 3,
      number: "Madde 3",
      title: "Gizli Bilginin Tanımı ve Kapsamı",
      required: true,
      defaultEnabled: true,
      aiEditable: true,
      requires: ["confidentialScope"],
      template: `"Gizli Bilgi" ifadesi; Taraflarca bu Sözleşme kapsamında yazılı, sözlü, elektronik veya herhangi bir ortamda paylaşılan ve/veya Sözleşmenin ifası sırasında erişilen her türlü bilgi, belge ve veri anlamına gelir. Gizli Bilgi özellikle aşağıdaki kategorileri kapsar: {{confidentialScope}}. Açıkça "gizli" olarak işaretlenmemiş olsa dahi makul bir kişinin gizli sayacağı bilgiler de Gizli Bilgi kapsamındadır.`,
    },
    {
      id: "obligations",
      order: 4,
      number: "Madde 4",
      title: "Gizlilik Yükümlülükleri",
      required: true,
      defaultEnabled: true,
      aiEditable: true,
      requires: ["ndaType"],
      template: `{{#if ndaType=mutual}}Taraflar{{/if}}{{#if ndaType=one_way}}Alıcı Taraf{{/if}}; (a) Gizli Bilgileri yalnızca Sözleşmenin Amacı için kullanmayı, (b) üçüncü kişilere ifşa etmemeyi, (c) Gizli Bilgilere erişen çalışan, danışman ve alt yüklenicilerini aynı gizlilik yükümlülüğüne tabi tutmayı, (d) Gizli Bilgileri en az kendi gizli bilgileri için uyguladığı özen derecesinde (her halükarda makul özenden az olmamak üzere) korumayı taahhüt eder.`,
    },
    {
      id: "exceptions",
      order: 5,
      number: "Madde 5",
      title: "Gizlilik Yükümlülüğünün İstisnaları",
      required: true,
      defaultEnabled: true,
      aiEditable: false,
      requires: [],
      template: `Aşağıdaki bilgiler Gizli Bilgi kapsamı dışındadır: (a) Alıcı Taraf'ın bu Sözleşmeyi ihlal etmeksizin kamuya mal olan bilgiler, (b) İfşa tarihinden önce Alıcı Taraf tarafından hukuka uygun olarak bilinen ve bu durumu yazılı olarak ispat edilebilen bilgiler, (c) Alıcı Taraf tarafından Gizli Bilgilerden bağımsız olarak geliştirilen bilgiler, (d) Üçüncü bir kişiden hukuka uygun olarak ve gizlilik kısıtı olmaksızın edinilen bilgiler, (e) Yasal zorunluluk veya mahkeme/idari merci kararı gereği açıklanması zorunlu bilgiler (bu durumda açıklama yapmadan önce makul süre içinde İfşa Eden Taraf'a yazılı bildirim yapılır).`,
    },
    {
      id: "duration",
      order: 6,
      number: "Madde 6",
      title: "Süre",
      required: true,
      defaultEnabled: true,
      aiEditable: false,
      requires: ["durationYears", "effectiveDate"],
      template: `Bu Sözleşme {{effectiveDate}} tarihinde yürürlüğe girer. Gizlilik yükümlülüğü, bu tarihten itibaren {{durationYears}} yıl süreyle devam eder. Bu süre Sözleşmenin herhangi bir sebeple sona ermesinden sonra da işlemeye devam eder. Ticari sır niteliğindeki bilgiler bakımından süre kısıtı uygulanmaz; TTK m.55 çerçevesinde koruma süresiz sürer.`,
    },
    {
      id: "return_destroy",
      order: 7,
      number: "Madde 7",
      title: "İade ve İmha",
      required: true,
      defaultEnabled: true,
      aiEditable: true,
      requires: [],
      template: `Sözleşmenin sona ermesi veya İfşa Eden Taraf'ın yazılı talebi üzerine Alıcı Taraf; elindeki tüm Gizli Bilgileri (fiziksel belgeler, elektronik dosyalar, kopyalar ve türev çalışmalar dahil) 10 iş günü içinde iade eder veya tamamen imha ederek imha işlemini yazılı olarak teyit eder. Yasal saklama yükümlülükleri saklıdır.`,
    },
    {
      id: "penalty",
      order: 8,
      number: "Madde 8",
      title: "Cezai Şart",
      required: false,
      defaultEnabled: false,
      aiEditable: true,
      requires: ["hasPenalty", "penaltyAmount"],
      template: `Bu Sözleşmenin herhangi bir hükmünün ihlali halinde, ihlal eden Taraf karşı Tarafa götürü tazminat olarak {{penaltyAmount}} TL cezai şart ödemeyi peşinen kabul eder. Cezai şartın ödenmesi, karşı Tarafın daha yüksek bedelli zararını TBK m.180/2 uyarınca talep etmesine engel değildir.`,
    },
    {
      id: "kvkk",
      order: 9,
      number: "Madde 9",
      title: "Kişisel Verilerin Korunması",
      required: false,
      defaultEnabled: true,
      aiEditable: true,
      requires: [],
      template: `Taraflar, bu Sözleşme kapsamında birbirlerine aktardıkları veya erişim sağladıkları kişisel verileri 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve ilgili ikincil mevzuata uygun şekilde işlemeyi, veri güvenliğini KVKK m.12 çerçevesinde sağlamayı ve veri ihlali halinde karşı Tarafa 72 saat içinde yazılı bildirimde bulunmayı taahhüt eder. Veri işleyen sıfatıyla hareket edildiği hallerde Taraflar ayrı bir veri işleyen sözleşmesi akdetmeyi kabul eder.`,
    },
    {
      id: "non_compete",
      order: 10,
      number: "Madde 10",
      title: "Rekabet Yasağı",
      required: false,
      defaultEnabled: false,
      aiEditable: true,
      requires: ["hasNonCompete", "nonCompeteDuration"],
      template: `Alıcı Taraf, Sözleşme süresince ve Sözleşmenin sona ermesinden itibaren {{nonCompeteDuration}} yıl süreyle, İfşa Eden Taraf'ın faaliyet alanında doğrudan veya dolaylı olarak rekabet eden herhangi bir iş yapmamayı, bu amaçla bir işletme kurmamayı ve rakiplerde çalışmamayı taahhüt eder. Bu yasak TBK m.444-447 sınırları içinde geçerlidir; coğrafi ve konu bakımından makul olmayan kısıtlamalar hâkim tarafından daraltılabilir.`,
    },
    {
      id: "reverse_engineering",
      order: 11,
      number: "Madde 11",
      title: "Tersine Mühendislik Yasağı",
      required: false,
      defaultEnabled: true,
      aiEditable: true,
      requires: [],
      template: `Alıcı Taraf, Gizli Bilgi kapsamındaki yazılım, donanım, ürün ve süreçler üzerinde kaynak koda, iç yapıya, algoritmalara veya ticari sırlara ulaşmak amacıyla tersine mühendislik yapmamayı, bu yönde üçüncü kişilere yaptırmamayı taahhüt eder.`,
    },
    {
      id: "notice",
      order: 12,
      number: "Madde 12",
      title: "Tebligat",
      required: true,
      defaultEnabled: true,
      aiEditable: false,
      requires: ["partyA.address", "partyB.address"],
      template: `Tarafların tebligat adresleri bu Sözleşmenin 1. maddesinde belirtilen adreslerdir. Adres değişiklikleri yazılı olarak karşı Tarafa bildirilmediği sürece, bu adreslere yapılan tebligatlar geçerli sayılır. Tacirler arası ihtar ve ihbarlar TTK m.18/3 uyarınca noter, KEP veya iadeli taahhütlü posta yoluyla yapılır.`,
    },
    {
      id: "jurisdiction",
      order: 13,
      number: "Madde 13",
      title: "Uyuşmazlık Çözümü ve Uygulanacak Hukuk",
      required: true,
      defaultEnabled: true,
      aiEditable: false,
      requires: ["jurisdictionCity"],
      template: `Bu Sözleşmeden doğan veya Sözleşmeyle ilgili her türlü uyuşmazlıkta Türk hukuku uygulanır ve {{jurisdictionCity}} Mahkemeleri ile İcra Daireleri yetkilidir.`,
    },
    {
      id: "final",
      order: 14,
      number: "Madde 14",
      title: "Son Hükümler",
      required: true,
      defaultEnabled: true,
      aiEditable: false,
      requires: [],
      template: `Bu Sözleşme, Tarafların bu konudaki tüm önceki anlaşma ve yazışmalarının yerine geçer. Sözleşmenin herhangi bir hükmünün geçersiz sayılması diğer hükümlerin geçerliliğini etkilemez. Sözleşmede yapılacak değişiklikler yazılı ve Tarafların imzasıyla geçerlidir. İşbu Sözleşme iki nüsha olarak düzenlenmiş ve Taraflarca imzalanmıştır.`,
    },
  ],

  warnings: [
    {
      id: "personal_data_kvkk",
      message:
        "Gizli bilgi kapsamında kişisel veri var; KVKK maddesi açık tutulmalı ve gerekirse ayrıca Veri İşleyen Sözleşmesi akdedilmeli.",
      shownWhen: { questionId: "confidentialScope", anyOf: ["personal_data"] },
      severity: "warn",
    },
    {
      id: "one_way_two_way_data",
      message:
        "Tek taraflı seçildi. İki Taraf da bilgi ifşa ediyorsa karşılıklı (mutual) seçeneğine geçin; aksi halde ifşa eden tarafın bilgisi korunmaz.",
      shownWhen: { questionId: "ndaType", equals: "one_way" },
      severity: "info",
    },
    {
      id: "penalty_high",
      message:
        "Cezai şart fahiş kalırsa TBK m.182/3 uyarınca hakim tarafından indirilebilir. Tutarı makul tutun.",
      shownWhen: { questionId: "hasPenalty", equals: true },
      severity: "info",
    },
    {
      id: "non_compete_scope",
      message:
        "Rekabet yasağı coğrafi sınır ve iş konusu bakımından makul olmalı (TBK m.445); aksi halde kısmen veya tamamen geçersiz sayılabilir.",
      shownWhen: { questionId: "hasNonCompete", equals: true },
      severity: "warn",
    },
  ],
};
