// ============================================================
// Clause Matcher — map agent clauseRef to a DOCX paragraph
// ============================================================
//
// Three layers, checked in order:
//
//   1. Regex anchor. If clauseRef carries a recognizable numbering
//      pattern (Madde 4.2, Article 4.2, §4.2), look for a paragraph
//      that starts with the same pattern. Cheap, high-precision.
//
//   2. Prefix match. Normalize both sides, compare the clauseRef's
//      first PREFIX_REF_LEN chars against each paragraph's first
//      PARA_SCAN_LEN chars. Catches cases where the agent referenced
//      the clause by its title ("Gizlilik Yükümlülüğü") instead of
//      a number.
//
//   3. Orphan. No match — the proposal can't land in the redline.
//      Caller records resolution = "orphan_unmatched".
//
// Design choices:
//   - Case-sensitive (legal language cares about casing, "Taraflar"
//     vs "taraflar" may carry different meaning in a defined-terms
//     context).
//   - No fuzzy distance metric (Levenshtein etc.) in v1. Too easy to
//     silently mis-route an edit to the wrong clause.
// ============================================================

import { normalizeForMatch } from "./text-normalizer";

export interface MatchableParagraph {
  /** Stable identifier for the paragraph (e.g. the <w:p>'s w:paraId). */
  id: string;
  /** Raw text of the paragraph as extracted from the DOCX run. */
  text: string;
}

export type ClauseMatch =
  | { kind: "anchor"; paragraphId: string }
  | { kind: "prefix"; paragraphId: string }
  | { kind: "title_substring"; paragraphId: string }
  | { kind: "orphan" };

// Accept "Madde 4.2", "Article 4.2", "§4.2" AND plain "4.2" / "4".
// Many Turkish contracts use bare numbering ("1. TARAFLAR",
// "4. BAYİ YETKİ DERECELERİ") without the "Madde" prefix; the
// matcher needs to catch those too.
const ANCHOR_REGEX =
  /^(?:(?:madde|article|art\.?|§)\s*)?(\d+(?:\.\d+)*)/i;

const PREFIX_REF_LEN = 40;
const PARA_SCAN_LEN = 80;
const TITLE_SCAN_LEN = 200;
const TITLE_MIN_LEN = 10;

function extractAnchor(ref: string): string | null {
  const match = ref.trim().match(ANCHOR_REGEX);
  if (!match) return null;
  return match[1];
}

function paragraphStartsWithAnchor(
  paragraphText: string,
  anchor: string,
): boolean {
  const head = normalizeForMatch(paragraphText.slice(0, PARA_SCAN_LEN));
  // Accept optional anchor prefix, then the same number, then either
  // a literal "." (e.g. "4." before a title word) or a word boundary
  // (end of number). The "." variant keeps "4" from matching "4.2"
  // paragraphs — the full number "4.2" still matches itself because
  // the escaped dots eat the "." before \b checks.
  const re = new RegExp(
    `^(?:(?:madde|article|art\\.?|§)\\s*)?${anchor.replace(/\./g, "\\.")}(?:\\.|\\b)`,
    "i",
  );
  return re.test(head);
}

/**
 * Attempts to match clauseRef to one of the candidate paragraphs.
 * Returns the first successful match; falls through to orphan.
 */
export function matchClause(
  clauseRef: string,
  paragraphs: MatchableParagraph[],
): ClauseMatch {
  // Layer 1 — regex anchor
  const anchor = extractAnchor(clauseRef);
  if (anchor) {
    for (const p of paragraphs) {
      if (paragraphStartsWithAnchor(p.text, anchor)) {
        return { kind: "anchor", paragraphId: p.id };
      }
    }
  }

  // Layer 2 — prefix match
  const needle = normalizeForMatch(clauseRef).slice(0, PREFIX_REF_LEN);
  if (needle.length > 0) {
    for (const p of paragraphs) {
      const head = normalizeForMatch(p.text).slice(0, PARA_SCAN_LEN);
      if (head.startsWith(needle)) {
        return { kind: "prefix", paragraphId: p.id };
      }
    }
  }

  // Layer 2.5 — title substring.
  // clauseRef is a bare title (no number anchor) and long enough to be
  // distinctive; find a paragraph whose head contains it regardless of
  // the numbering prefix the document uses. Turkish locale for the
  // İ/i folding.
  if (anchor === null && needle.length >= TITLE_MIN_LEN) {
    const caseFoldedNeedle = needle.toLocaleLowerCase("tr-TR");
    for (const p of paragraphs) {
      const caseFoldedHead = normalizeForMatch(
        p.text.slice(0, TITLE_SCAN_LEN),
      ).toLocaleLowerCase("tr-TR");
      if (caseFoldedHead.includes(caseFoldedNeedle)) {
        return { kind: "title_substring", paragraphId: p.id };
      }
    }
  }

  // Layer 3 — orphan
  return { kind: "orphan" };
}

/**
 * Locates an originalText phrase inside a paragraph for replace_phrase
 * edits. Uses a two-stage search:
 *   1. Exact substring match on the raw paragraph text.
 *   2. Normalized substring match — indexes into the normalized
 *      paragraph text, then maps back to the raw text via the
 *      normalization offset.
 * Fallback: trimmed-to-50-char prefix search. If that still fails,
 * returns null and the caller treats the edit as orphan.
 */
export function locatePhrase(
  paragraphText: string,
  originalText: string,
): { start: number; end: number } | null {
  // Stage 1 — exact
  const exactIdx = paragraphText.indexOf(originalText);
  if (exactIdx >= 0) {
    return { start: exactIdx, end: exactIdx + originalText.length };
  }

  // Stage 2 — normalized
  const normalizedPara = normalizeForMatch(paragraphText);
  const normalizedNeedle = normalizeForMatch(originalText);
  const normIdx = normalizedPara.indexOf(normalizedNeedle);
  if (normIdx >= 0 && normalizedNeedle.length > 0) {
    // Walk the raw paragraph to find the range whose normalized form
    // matches. Coarse approach: search raw indices whose normalized
    // prefix length equals normIdx.
    const range = mapNormalizedRangeToRaw(
      paragraphText,
      normalizedNeedle,
      normIdx,
    );
    if (range) return range;
  }

  // Fallback — trimmed 50-char prefix
  const trimmed = normalizeForMatch(originalText).slice(0, 50);
  if (trimmed.length > 0) {
    const normalizedParaText = normalizeForMatch(paragraphText);
    if (normalizedParaText.includes(trimmed)) {
      const fallbackNormIdx = normalizedParaText.indexOf(trimmed);
      const range = mapNormalizedRangeToRaw(
        paragraphText,
        trimmed,
        fallbackNormIdx,
      );
      if (range) return range;
    }
  }

  return null;
}

function mapNormalizedRangeToRaw(
  raw: string,
  normalizedNeedle: string,
  normStart: number,
): { start: number; end: number } | null {
  // Walk raw, tracking normalized position. When normalized position
  // hits normStart, mark the raw start. Continue until normalized
  // delta equals normalizedNeedle.length; mark raw end.
  let normPos = 0;
  let rawStart = -1;
  let pendingWhitespace = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const isWs = /\s/.test(ch);
    if (isWs) {
      if (!pendingWhitespace && normPos > 0) {
        if (normPos === normStart) rawStart = i;
        normPos++;
      }
      pendingWhitespace = true;
      continue;
    }
    pendingWhitespace = false;
    if (normPos === normStart && rawStart === -1) rawStart = i;
    normPos++;
    if (rawStart !== -1 && normPos - normStart >= normalizedNeedle.length) {
      return { start: rawStart, end: i + 1 };
    }
  }
  return null;
}
