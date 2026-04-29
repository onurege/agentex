// Turkish-aware text normalization for company-name comparison and id field
// cleanup. Used by both extraction (to canonicalize captured strings) and
// the comparison engine (to score similarity).

const TURKISH_UPPER_MAP: Record<string, string> = {
  i: "İ",
  ı: "I",
  ş: "Ş",
  ğ: "Ğ",
  ü: "Ü",
  ö: "Ö",
  ç: "Ç",
};

export function turkishUpper(input: string): string {
  return input
    .replace(/[iışğüöç]/g, (ch) => TURKISH_UPPER_MAP[ch] ?? ch)
    .toUpperCase();
}

// Token-based expansion sidesteps the JS regex \b mis-handling Turkish
// letters: splitting on whitespace gives us natural word boundaries that
// work with Ş, İ, Ç, Ğ, Ü, Ö without needing Unicode flags or lookarounds.

const TWO_TOKEN_EXPANSIONS: Record<string, [string, string]> = {
  "LTD ŞTİ": ["LİMİTED", "ŞİRKETİ"],
  "LİMİTED ŞİRKETİ": ["LİMİTED", "ŞİRKETİ"],
  "A Ş": ["ANONİM", "ŞİRKETİ"],
  "ANONİM ŞİRKETİ": ["ANONİM", "ŞİRKETİ"],
};

const SINGLE_TOKEN_EXPANSIONS: Record<string, string[]> = {
  AŞ: ["ANONİM", "ŞİRKETİ"],
  İTH: ["İTHALAT"],
  İHR: ["İHRACAT"],
  SAN: ["SANAYİ"],
  TİC: ["TİCARET"],
  İNŞ: ["İNŞAAT"],
  GID: ["GIDA"],
  TUR: ["TURİZM"],
  MÜH: ["MÜHENDİSLİK"],
  OTO: ["OTOMOTİV"],
  TEKS: ["TEKSTİL"],
};

export function expandCompanyName(raw: string): string {
  const cleaned = turkishUpper(raw)
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter(Boolean);
  const expanded: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const two =
      i + 1 < tokens.length ? `${tokens[i]} ${tokens[i + 1]}` : null;
    if (two && TWO_TOKEN_EXPANSIONS[two]) {
      expanded.push(...TWO_TOKEN_EXPANSIONS[two]);
      i++;
      continue;
    }
    const single = SINGLE_TOKEN_EXPANSIONS[tokens[i]];
    if (single) {
      expanded.push(...single);
      continue;
    }
    expanded.push(tokens[i]);
  }

  return expanded.join(" ");
}

// Strips Turkish diacritics for case-insensitive token comparison. The
// dot-i pair (İ vs I) and Latin-vs-Turkish letter shapes show up across
// stamps, OCR output and typed forms inconsistently — folding them to
// ASCII for comparison only avoids false negatives without losing fidelity
// in the displayed normalized form.
function asciiFold(input: string): string {
  return input
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function tokenize(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

// Token-overlap ratio scaled by the larger token set. Uses asciiFold so
// "TURKİSHCARE" (typed lowercase i auto-uppercased to dotted İ) matches
// "TURKISHCARE" (typed Latin I as in the Codex stamp render).
export function companyNameSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(asciiFold(expandCompanyName(a))));
  const tb = new Set(tokenize(asciiFold(expandCompanyName(b))));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  ta.forEach((token) => {
    if (tb.has(token)) overlap += 1;
  });
  return overlap / Math.max(ta.size, tb.size);
}

export function digitsOnly(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\D+/g, "");
}

export function normalizeAddress(input: string | null | undefined): string {
  if (!input) return "";
  return turkishUpper(input)
    .replace(/[.,/\\:;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
