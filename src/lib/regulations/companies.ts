// Param Holding ve grup şirketleri — Google Haberler kaynağında her
// şirket için ayrı RSS query çekilir. Birden fazla query gönderilirse
// (örn. ticari ad + tüzel kişi adı), `OR` ile birleştirilir.
//
// `id` — sabit slug; DB'de `RegulationItem.companies String[]` içinde
//        bu değer tutulur, UI chip key'i.
// `displayName` — UI etiketleri ve audit log için.
// `queries` — Google News RSS'e gidecek tırnaklı query'ler. Tırnak
//             zorunlu; "Param" gibi yaygın kelimelerin parametrik /
//             finansal param eşleşmelerini elemek için.
// `aliases` — classifier ve sonuç içeriğindeki şirket eşleşmesi için
//             küçük harf substring'ler. Türkçe normalize edildikten
//             sonra eşleşir.

export interface CompanyConfig {
  id: string;
  displayName: string;
  description: string;
  queries: readonly string[];
  aliases: readonly string[];
}

export const PARAM_GROUP_COMPANIES: readonly CompanyConfig[] = [
  {
    id: "param",
    displayName: "Param",
    description:
      "TURK Elektronik Para A.Ş. — elektronik para kuruluşu, kartlı ödeme " +
      "sistemleri ve cüzdan hizmetleri.",
    queries: [
      '"Param" "elektronik para"',
      '"TURK Elektronik Para"',
      '"Param Ödeme"',
    ],
    aliases: ["turk elektronik para", "param ödeme", "param elektronik para"],
  },
  {
    id: "kredim",
    displayName: "Kredim",
    description:
      "Alışveriş kredisi ve şimdi al sonra öde (BNPL) finansman çözümleri.",
    queries: ['"Kredim"', '"Kredim BNPL"', '"Kredim şimdi al sonra öde"'],
    aliases: ["kredim"],
  },
  {
    id: "finrota",
    displayName: "Finrota",
    description:
      "Açık bankacılık, online tahsilat ve nakit yönetimi sistemleri.",
    queries: ['"Finrota"', '"Finrota açık bankacılık"'],
    aliases: ["finrota"],
  },
  {
    id: "paramtech",
    displayName: "ParamTech",
    description: "Fintech altyapı ve teknoloji çözümleri sağlayıcısı.",
    queries: ['"ParamTech"', '"Param Tech"'],
    aliases: ["paramtech", "param tech"],
  },
  {
    id: "univera",
    displayName: "Univera",
    description:
      "Satış, servis ve lojistik alanlarında dijital dönüşüm ve saha " +
      "yönetimi çözümleri.",
    queries: ['"Univera"', '"Univera saha yönetimi"'],
    aliases: ["univera"],
  },
  {
    id: "twisto",
    displayName: "Twisto",
    description: "Avrupa pazarına yönelik finansal teknoloji ve BNPL platformu.",
    queries: ['"Twisto"', '"Twisto BNPL"'],
    aliases: ["twisto"],
  },
  {
    id: "paramuk",
    displayName: "ParamUK",
    description:
      "Birleşik Krallık'ta faaliyet gösteren uluslararası para transferi ve " +
      "ödeme kuruluşu.",
    queries: ['"ParamUK"', '"Param UK"', '"Param United Kingdom"'],
    aliases: ["paramuk", "param uk"],
  },
  {
    id: "nebim",
    displayName: "Nebim",
    description: "ERP ve mağazacılık çözümleri sunan şirket (2024'ten itibaren grup bünyesinde).",
    queries: ['"Nebim"', '"Nebim ERP"', '"Nebim V3"'],
    aliases: ["nebim"],
  },
];

export const COMPANY_BY_ID: Readonly<Record<string, CompanyConfig>> =
  Object.freeze(
    PARAM_GROUP_COMPANIES.reduce<Record<string, CompanyConfig>>((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {}),
  );

/** Bir metnin hangi grup şirket(ler)i ile eşleştiğini döner. Türkçe
 *  case-fold uygulandıktan sonra alias substring eşleşmesi. */
export function detectCompanies(rawText: string): string[] {
  if (!rawText) return [];
  const haystack = rawText.toLocaleLowerCase("tr-TR");
  const matched: string[] = [];
  for (const c of PARAM_GROUP_COMPANIES) {
    if (c.aliases.some((a) => haystack.includes(a))) {
      matched.push(c.id);
    }
  }
  return matched;
}
