// ============================================================
// Text Normalizer — for match-time comparison, never mutation
// ============================================================
//
// Applied to both haystack (DOCX paragraph text) and needle (agent-
// proposed originalText) before comparison. The original strings are
// returned untouched to the caller — normalization is purely a lookup
// convenience so trivial typographic differences don't produce false
// orphans.
//
// Rules (case-sensitive — that stays meaningful):
//   - Collapse runs of whitespace (\s+) to a single space
//   - Straighten curly quotes (“ ” ‘ ’ ' ') → " and '
//   - Convert non-breaking space (\u00A0) to a normal space
//   - Trim leading / trailing whitespace
// ============================================================

const CURLY_DOUBLE_OPEN = /[\u201C\u201D\u201E\u201F]/g;
const CURLY_SINGLE = /[\u2018\u2019\u201A\u201B]/g;
const NBSP = /\u00A0/g;
const WHITESPACE_RUN = /\s+/g;

export function normalizeForMatch(input: string): string {
  return input
    .replace(CURLY_DOUBLE_OPEN, '"')
    .replace(CURLY_SINGLE, "'")
    .replace(NBSP, " ")
    .replace(WHITESPACE_RUN, " ")
    .trim();
}
