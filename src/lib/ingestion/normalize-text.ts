// ============================================================
// Text Normalization — clean extracted text for downstream use
// ============================================================
//
// Applied after extraction (PDF/DOCX/TXT) and before segmentation.
// Handles common extraction artifacts:
//   - Excessive whitespace and blank lines
//   - Broken line wrapping (mid-word line breaks from PDF)
//   - Page number artifacts
//   - Bullet/numbering normalization
//   - Trailing/leading whitespace per line
// ============================================================

/**
 * Normalize extracted text for clean downstream consumption.
 * Returns the cleaned text and a list of normalization notes.
 */
export function normalizeExtractedText(
  raw: string,
): { text: string; notes: string[] } {
  const notes: string[] = [];
  let text = raw;

  const originalLength = text.length;

  // 1. Normalize line endings to \n
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Remove page number artifacts: standalone lines with just a number
  //    (common in PDF extraction: "12\n" between paragraphs)
  const pageNumsBefore = text;
  text = text.replace(/\n\s*\d{1,4}\s*\n/g, "\n");
  if (text !== pageNumsBefore) {
    notes.push("Removed page number artifacts");
  }

  // 3. Remove form feed characters (PDF page breaks)
  text = text.replace(/\f/g, "\n");

  // 4. Fix broken line wrapping (mid-word breaks from PDF column extraction)
  //    Pattern: lowercase letter + \n + lowercase letter (no space) = join
  const brokenBefore = text;
  text = text.replace(/([a-zçğıöşü])\n([a-zçğıöşü])/gi, "$1$2");
  if (text !== brokenBefore) {
    notes.push("Repaired broken line wrapping");
  }

  // 5. Fix soft line breaks within paragraphs
  //    Pattern: non-punctuation end + \n + lowercase start = join with space
  text = text.replace(
    /([^.\n:;!?\-—])\n([a-zçğıöşü])/g,
    "$1 $2",
  );

  // 6. Trim trailing whitespace per line
  text = text.replace(/[ \t]+$/gm, "");

  // 7. Collapse 3+ consecutive blank lines to 2
  const blankBefore = text;
  text = text.replace(/\n{4,}/g, "\n\n\n");
  if (text !== blankBefore) {
    notes.push("Collapsed excessive blank lines");
  }

  // 8. Normalize bullet characters to standard dash
  text = text.replace(/^[•●○◦▪▸►‣⁃]\s*/gm, "- ");

  // 9. Normalize tab-based indentation to spaces
  text = text.replace(/\t/g, "  ");

  // 10. Trim leading/trailing whitespace from the entire text
  text = text.trim();

  if (notes.length === 0 && text.length < originalLength * 0.95) {
    notes.push("Minor whitespace cleanup applied");
  }

  return { text, notes };
}

/**
 * Estimate extraction quality based on text characteristics.
 * Returns a quality label and notes.
 */
export function assessExtractionQuality(
  text: string | null,
  pageCount: number | null,
): { quality: "good" | "partial" | "poor" | "none"; notes: string[] } {
  if (!text || text.length === 0) {
    return { quality: "none", notes: ["No text extracted"] };
  }

  const notes: string[] = [];
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const lineCount = text.split("\n").length;

  notes.push(`${wordCount} words, ${lineCount} lines extracted`);

  // Very short text relative to page count suggests poor extraction
  if (pageCount && pageCount > 1) {
    const wordsPerPage = wordCount / pageCount;
    if (wordsPerPage < 20) {
      notes.push(`Very low word density (${Math.round(wordsPerPage)} words/page) — possibly scanned`);
      return { quality: "poor", notes };
    }
    if (wordsPerPage < 100) {
      notes.push(`Low word density (${Math.round(wordsPerPage)} words/page)`);
      return { quality: "partial", notes };
    }
  }

  // Very short total text
  if (charCount < 200) {
    notes.push("Very short extracted text");
    return { quality: "poor", notes };
  }

  if (charCount < 1000) {
    notes.push("Short extracted text");
    return { quality: "partial", notes };
  }

  return { quality: "good", notes };
}
