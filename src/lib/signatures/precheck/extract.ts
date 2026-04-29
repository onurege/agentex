// Regex-first extraction for sirkü and petition documents.
//
// PDF text from imza sirküleri filings often comes back with column-broken
// line order — labels in one block, values in another — so most patterns
// here are position-agnostic and anchor on distinctive content (10-digit
// tax numbers, "tarihinden itibaren N yıl" duration phrasing, the
// city-dash-registry shape) rather than line-level layout.

import { digitsOnly } from "./normalize";
import type {
  AuthorityType,
  PetitionExtraction,
  SirkuExtraction,
} from "./types";

// Allow Turkish and Latin diacritic-stripped variants in the same regex
// because stamps and registry filings render the same suffix differently.
// Lookbehind/lookahead anchor on whitespace or punctuation (not JS \b which
// mis-handles Turkish letters) so "İMZA SİRKÜLERİ" doesn't false-match the
// "A S" alternative across the token boundary.
const COMPANY_SUFFIX_RE =
  /(?<=^|[\s.,])(ANON[Iİ]M\s+[ŞS][Iİ]RKET[Iİ]|L[Iİ]M[Iİ]TED\s+[ŞS][Iİ]RKET[Iİ]|A\.?\s*[ŞS]\.?|LTD\.?\s*[ŞS]T[Iİ]\.?)(?=\s|$|[.,])/i;

const PROSE_NEGATIVES = [
  /yukarıda/i,
  /onaylama/i,
  /tarafından/i,
  /şirketin\s/i,
  /türkiye\s+ticaret/i,
  /^bu\s/i,
  /dayanak/i,
  /müdürlüğü/i,
];

function trDateToIso(s: string): string | null {
  const m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function findFirst(re: RegExp, text: string, group = 1): string | null {
  const m = text.match(re);
  return m && m[group] ? m[group].trim() : null;
}

function isCompanyNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 8 || trimmed.length > 200) return false;
  if (!COMPANY_SUFFIX_RE.test(trimmed)) return false;
  if (PROSE_NEGATIVES.some((re) => re.test(trimmed))) return false;
  // Must be mostly uppercase — prose lines that happen to mention "A.Ş."
  // typically have lots of lowercase letters.
  const allLetters = trimmed.match(/[A-ZÇŞĞÜÖİa-zçşğüöı]/g) ?? [];
  if (allLetters.length === 0) return false;
  const upperLetters = trimmed.match(/[A-ZÇŞĞÜÖİ]/g) ?? [];
  return upperLetters.length / allLetters.length > 0.7;
}

function extractRepresentative(text: string): {
  name: string | null;
  id: string | null;
} {
  // \b boundaries on the 11-digit run prevent matching inside longer digit
  // sequences (e.g. the noter's phone "+902165205707" minus a leading digit).
  // Name token regex constrains the inter-token separator to space/tab so
  // it can't bleed across a newline into unrelated all-caps labels like
  // "ÜNVANI\nADRES".
  // Pattern A: 11-digit TC kimlik first, then name within ~80 chars
  let m = text.match(
    /\b(\d{11})\b[\s\S]{0,80}?(?:T\.?\s*C\.?\s*Kimlik(?:\s*Numaralı)?\s+)?([A-ZÇŞĞÜÖİ]{2,}[ \t]+[A-ZÇŞĞÜÖİ]{2,})/,
  );
  if (m) return { id: m[1], name: m[2].trim() };
  // Pattern B: name first, then 11-digit TC on the same logical line
  m = text.match(/([A-ZÇŞĞÜÖİ]{2,}[ \t]+[A-ZÇŞĞÜÖİ]{2,})[ \t]+\b(\d{11})\b/);
  if (m) return { id: m[2], name: m[1].trim() };
  return { id: null, name: null };
}

export function extractSirku(rawText: string): SirkuExtraction {
  const lines = rawText.split(/\n/).map((l) => l.trim());

  const companyName = lines.find(isCompanyNameLine) ?? null;

  // Tax number — \b boundaries naturally exclude TC kimlik (11 digits),
  // phone numbers (12+ in dial-code form), and date subsequences (≤4).
  // The first \b\d{10}\b in a sirkü is reliably the actual VKN because
  // there's nothing else in the document with that exact shape.
  const taxNumber = findFirst(/\b(\d{10})\b/, rawText);

  // Trade registry — "İSTANBUL - 270230-5" shape, broad city prefix
  const tradeRegistryNumber = findFirst(
    /[A-ZÇŞĞÜÖİ]{3,}\s*-\s*(\d{4,7}-\d{1,2})/,
    rawText,
  );

  const mersisNumber = findFirst(/\b(\d{16})\b/, rawText);

  // Address line — must reference both a Mahalle/Cadde anchor AND a "No:"
  const address =
    lines.find(
      (l) =>
        /(Mahallesi|Mah\.)/i.test(l) &&
        /(Caddesi|Cadde|Cad\.)/i.test(l) &&
        /No\s*:/i.test(l),
    ) ?? null;

  const authorityRaw = findFirst(/(Münferiden|Müştereken)/i, rawText);
  const authorityType: AuthorityType = authorityRaw
    ? authorityRaw.toLowerCase().startsWith("müşt")
      ? "müştereken"
      : "münferiden"
    : "belirsiz";

  const durationMatch = rawText.match(
    /(\d{2}\.\d{2}\.\d{4})\s+tarihinden\s+itibaren\s+(\d+)\s+yıl/i,
  );
  const authorityStart = durationMatch ? trDateToIso(durationMatch[1]) : null;
  const authorityDurationYears = durationMatch
    ? Number.parseInt(durationMatch[2], 10)
    : null;

  const sirkuDateRaw = findFirst(
    /Tarih\s*:\s*(\d{2}[./]\d{2}[./]\d{4})/i,
    rawText,
  );
  const sirkuDate = sirkuDateRaw ? trDateToIso(sirkuDateRaw) : null;

  const rep = extractRepresentative(rawText);

  return {
    companyName,
    taxNumber,
    tradeRegistryNumber,
    mersisNumber,
    address,
    representativeName: rep.name,
    representativeIdNumber: rep.id,
    authorityType,
    authorityStart,
    authorityDurationYears,
    sirkuDate,
    rawText,
  };
}

function extractStampCompanyName(lines: string[]): string | null {
  // Anchor 1: walk backward from Mersis or V.D line — these label rows
  // are reliable bottom anchors for the stamp block.
  const mersisIdx = lines.findIndex((l) => /Mersis/i.test(l));
  const vdIdx = lines.findIndex((l) => /V\.?\s*D[:.]/i.test(l));
  const anchor = mersisIdx >= 0 ? mersisIdx : vdIdx;
  if (anchor > 0) {
    for (let i = anchor - 1; i >= Math.max(0, anchor - 8); i--) {
      if (isCompanyNameLine(lines[i])) return lines[i];
    }
  }

  // Anchor 2: KAŞE marker, scan forward
  const kaseIdx = lines.findIndex((l) => /KAŞE/i.test(l));
  if (kaseIdx >= 0) {
    for (let i = kaseIdx + 1; i < Math.min(lines.length, kaseIdx + 8); i++) {
      if (isCompanyNameLine(lines[i])) return lines[i];
    }
  }

  // Fallback: first qualifying line anywhere
  return lines.find(isCompanyNameLine) ?? null;
}

export function extractPetition(rawText: string): PetitionExtraction {
  const lines = rawText.split(/\n/).map((l) => l.trim());

  const companyName = extractStampCompanyName(lines);

  const petitionDateRaw = findFirst(
    /(?:TARİH|TARIH)\s*:?\s*(\d{2}[./]\d{2}[./]\d{4})/i,
    rawText,
  );
  const petitionDate = petitionDateRaw ? trDateToIso(petitionDateRaw) : null;

  // Tax number — V.D / V D / VD with or without colon, allowing spaced
  // 3-3-4 digit groupings ("871 121 8985").
  const taxAnchored = findFirst(
    /V\.?\s*D[^\d]{0,5}(\d[\d\s]{8,15})/i,
    rawText,
  );
  const taxDigits = taxAnchored ? digitsOnly(taxAnchored) : "";
  const taxNumber = taxDigits.length === 10 ? taxDigits : null;

  const tradeRegistryNumber = findFirst(
    /Tic\.?\s*Sic\.?\s*N?o?\.?\s*:?\s*(\d{4,7}-\d{1,2})/i,
    rawText,
  );

  const mersisAnchored = findFirst(
    /Mersis\s*N?o?\.?\s*:?\s*(\d{10,16})/i,
    rawText,
  );
  const mersisNumber =
    mersisAnchored ?? findFirst(/\b(\d{16})\b/, rawText) ?? null;

  // Address — text between the stamp company line and the Mersis/V.D anchor.
  let address: string | null = null;
  if (companyName) {
    const compIdx = lines.indexOf(companyName);
    const mersisIdx = lines.findIndex((l) => /Mersis/i.test(l));
    const vdIdx = lines.findIndex((l) => /V\.?\s*D[:.]/i.test(l));
    const anchor = mersisIdx >= 0 ? mersisIdx : vdIdx;
    if (compIdx >= 0 && anchor > compIdx + 1) {
      const between = lines.slice(compIdx + 1, anchor).filter(Boolean);
      if (between.length > 0) address = between.join(" ");
    }
  }

  return {
    companyName,
    taxNumber,
    tradeRegistryNumber,
    mersisNumber,
    address,
    petitionDate,
    // Pre-check uses signature count only as a hint for münferit/müşterek
    // gating — fine-grained signature detection is the job of the existing
    // mask-based compare module. Default to 1 for the common case.
    signatureCount: 1,
    rawText,
  };
}
