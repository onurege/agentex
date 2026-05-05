// ============================================================
// DOCX Redline Renderer
// ============================================================
//
// Takes the original .docx bytes + a list of arbitrated edits and
// produces a new .docx with Word-native track-changes markup.
// Opening the result in Word shows additions in green and deletions
// in red (or whatever the user's track-changes preference is).
//
// Approach:
//   - jszip reads the .docx, word/document.xml is mutated in place,
//     jszip re-zips. Everything outside the body (styles, numbering,
//     headers, footers, tables' own XML) is untouched, so round-trip
//     fidelity is high.
//   - Paragraphs are extracted with a regex (<w:p>...</w:p>). Inside
//     each paragraph the renderer keeps the <w:pPr> block and
//     rewrites only the content runs.
//   - clause-matcher locates the target paragraph by clauseRef;
//     unmatched edits are counted as orphans and skipped.
//
// Track-changes schema (per OOXML ECMA-376):
//   <w:ins w:id="N" w:author="..." w:date="..."><w:r>...</w:r></w:ins>
//   <w:del w:id="N" w:author="..." w:date="...">
//     <w:r><w:delText>...</w:delText></w:r>
//   </w:del>
// Note: <w:t> becomes <w:delText> inside <w:del>; otherwise Word
// treats it as live text, not deletion.
// ============================================================

import JSZip from "jszip";
import type { ArbitratedEdit } from "./types";
import { matchClause, locatePhrase, type MatchableParagraph } from "./clause-matcher";

export interface RedlineResult {
  buffer: Buffer;
  appliedCount: number;
  orphanCount: number;
}

interface ExtractedParagraph extends MatchableParagraph {
  rawXml: string;
  /** The content inside <w:p>...</w:p> minus <w:pPr>. */
  inner: string;
  /** The <w:pPr> block, empty string if absent. */
  pPr: string;
}

const PARAGRAPH_REGEX = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const TEXT_REGEX = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
const PPR_REGEX = /<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>|<w:pPr(?:\s[^>]*)?\/>/;

const DEFAULT_AUTHOR = "Consulera";

// Explicit revision styling. Two layers are applied per change:
//
//   1. <w:color w:val="HEX"/> — red for deletions, green for
//      insertions. This is the "nice" layer that matches the standard
//      Office "Dark Red" and "Green" theme palette.
//
//   2. <w:highlight w:val="green"/> on INSERTIONS only. Word's track-
//      changes renderer overrides inline <w:color> on <w:ins> runs
//      whenever the reviewer has Insertions color set to "By author"
//      (the default). In that mode the author gets an auto-assigned
//      tint and our green is ignored. <w:highlight> is NOT subject to
//      that override, so adding it guarantees visible contrast even
//      when the "By author" default is in effect. The enum is the
//      CT_Highlight set (yellow, green, cyan, …); green pairs with the
//      green color for a consistent before/after reading.
//
// Deletions keep only <w:color>. Strikethrough + color render reliably
// on <w:del> without the highlight, and highlighted strikethrough is
// harder to skim.
const DEL_COLOR_HEX = "C00000";
const INS_COLOR_HEX = "00B050";
const INS_HIGHLIGHT = "green";
const DEL_RPR = `<w:rPr><w:color w:val="${DEL_COLOR_HEX}"/></w:rPr>`;
const INS_RPR = `<w:rPr><w:color w:val="${INS_COLOR_HEX}"/><w:highlight w:val="${INS_HIGHLIGHT}"/></w:rPr>`;

export async function applyRedline(
  originalDocx: Buffer,
  edits: ArbitratedEdit[],
  options?: { author?: string },
): Promise<RedlineResult> {
  const author = options?.author ?? DEFAULT_AUTHOR;
  const date = new Date().toISOString();

  const zip = await JSZip.loadAsync(originalDocx);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    throw new Error("INVALID_DOCX: word/document.xml missing");
  }
  const originalXml = await documentFile.async("string");

  const paragraphs = extractParagraphs(originalXml);

  let mutatedXml = originalXml;
  let appliedCount = 0;
  let orphanCount = 0;
  let revId = Number.parseInt(`${Date.now()}`.slice(-9), 10);

  for (const edit of edits) {
    if (
      edit.resolution === "orphan_unmatched" ||
      edit.resolution === "rejected_all"
    ) {
      orphanCount++;
      continue;
    }

    const match = matchClause(edit.clauseRef, paragraphs);
    if (match.kind === "orphan") {
      orphanCount++;
      continue;
    }

    let target = paragraphs.find((p) => p.id === match.paragraphId);
    if (!target) {
      orphanCount++;
      continue;
    }

    let replacement: string | null = null;
    switch (edit.editType) {
      case "replace_clause":
        replacement =
          buildDeletedParagraph(target, author, date, revId++) +
          buildInsertedParagraph(
            target.pPr,
            edit.finalText,
            author,
            date,
            revId++,
          );
        break;
      case "delete_clause":
        replacement = buildDeletedParagraph(target, author, date, revId++);
        break;
      case "insert_after":
        replacement =
          target.rawXml +
          buildInsertedParagraph(
            target.pPr,
            edit.finalText,
            author,
            date,
            revId++,
          );
        break;
      case "replace_phrase": {
        replacement = replacePhraseInParagraph(
          target,
          edit.originalText ?? "",
          edit.finalText,
          author,
          date,
          revId,
        );
        // Fallback — clauseRef frequently matches a section heading
        // whose body text lives in the paragraphs that follow. Walk
        // forward within the same section (until the next heading or
        // LIMIT paragraphs) and try each until one contains the phrase.
        // This salvages edits that would otherwise silently orphan
        // whenever the agent emits a heading-level clauseRef.
        if (!replacement) {
          const startIdx = paragraphs.findIndex((p) => p.id === target!.id);
          const LIMIT = 15;
          for (
            let j = startIdx + 1;
            j < Math.min(paragraphs.length, startIdx + 1 + LIMIT);
            j++
          ) {
            const candidate = paragraphs[j];
            if (isSectionHeading(candidate.text)) break;
            const alt = replacePhraseInParagraph(
              candidate,
              edit.originalText ?? "",
              edit.finalText,
              author,
              date,
              revId,
            );
            if (alt) {
              target = candidate;
              replacement = alt;
              break;
            }
          }
        }
        if (replacement) revId += 2;
        break;
      }
    }

    if (!replacement) {
      orphanCount++;
      continue;
    }

    // Look the target up in mutatedXml fresh — earlier edits may have
    // shifted content. Use exact rawXml match; if another edit already
    // replaced this paragraph, skip to avoid corruption.
    const idx = mutatedXml.indexOf(target.rawXml);
    if (idx === -1) {
      orphanCount++;
      continue;
    }

    mutatedXml =
      mutatedXml.slice(0, idx) +
      replacement +
      mutatedXml.slice(idx + target.rawXml.length);
    appliedCount++;
  }

  zip.file("word/document.xml", mutatedXml);
  const buffer = (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
  return { buffer, appliedCount, orphanCount };
}

// ── Section-heading classifier ─────────────────────────
//
// Used by the replace_phrase fallback walk to stop at the next section
// boundary. Turkish contracts mix three common heading styles:
//   "4. BAYİ YETKİ DERECELERİ"   — plain number + ALL-CAPS title
//   "Madde 5 Süre" / "Article 5" — anchor-prefix + title
//   "EK - 3: MALİ KOŞULLAR"      — appendix marker
// Digit-prefix detection requires uppercase so that lettered subclauses
// ("a. Bayi hakları") remain inside the containing section.

export function isSectionHeading(text: string): boolean {
  const head = text.trim().slice(0, 50);
  return (
    /^(?:madde|article)\s+\d+/i.test(head) ||
    /^ek\s*-?\s*\d+/i.test(head) ||
    /^\d+\.\s+[A-ZÇĞİÖŞÜ]{2,}/.test(head)
  );
}

// ── Paragraph extraction ────────────────────────────────

function extractParagraphs(xml: string): ExtractedParagraph[] {
  const paragraphs: ExtractedParagraph[] = [];
  const matches = Array.from(xml.matchAll(PARAGRAPH_REGEX));
  let idx = 0;
  for (const m of matches) {
    const rawXml = m[0];
    const pPrMatch = rawXml.match(PPR_REGEX);
    const pPr = pPrMatch ? pPrMatch[0] : "";
    // Strip opening <w:p...> and closing </w:p> and the pPr block
    const openClose = rawXml
      .replace(/^<w:p(?:\s[^>]*)?>/, "")
      .replace(/<\/w:p>$/, "");
    const inner = pPr ? openClose.replace(pPr, "") : openClose;

    paragraphs.push({
      id: `para-${idx++}`,
      text: extractText(rawXml),
      rawXml,
      inner,
      pPr,
    });
  }
  return paragraphs;
}

function extractText(paragraphXml: string): string {
  const matches = paragraphXml.matchAll(TEXT_REGEX);
  return Array.from(matches)
    .map((m) => decodeEntities(m[1]))
    .join("");
}

// ── XML builders ────────────────────────────────────────

function buildDeletedParagraph(
  p: ExtractedParagraph,
  author: string,
  date: string,
  revId: number,
): string {
  // Convert <w:t> → <w:delText> inside the inner runs, then wrap
  // everything in <w:del>. pPr stays outside <w:del>. Each run is
  // forced red so the deletion stands out even when the reviewer's
  // Word ignores author-based coloring.
  const innerAsDeleted = colorizeRuns(
    p.inner
      .replace(/<w:t(\s[^>]*)?>/g, "<w:delText$1>")
      .replace(/<\/w:t>/g, "</w:delText>"),
    DEL_COLOR_HEX,
  );
  const deletion = `<w:del w:id="${revId}" w:author="${escapeAttr(
    author,
  )}" w:date="${date}">${innerAsDeleted}</w:del>`;
  return `<w:p>${p.pPr}${deletion}</w:p>`;
}

// ── Run colorization ────────────────────────────────────
//
// Injects <w:color> (and optionally <w:highlight>) into every <w:r>
// inside `xml`. Three input shapes to handle per OOXML:
//   (a) Self-closing rPr: <w:rPr/>   → expand with our tags.
//   (b) Existing rPr block: strip any prior color/highlight, then
//       splice ours in at the schema-correct position so the run's
//       other properties (bold, italic, fonts, size) survive intact.
//   (c) Run without rPr: inject a fresh <w:rPr> right after <w:r>.
// Order matters — (a) must run before (b) so the self-closing form
// doesn't match as an "existing block".
//
// ECMA-376 §17.3.2.28 CT_RPr requires a specific child-element
// sequence (rStyle → rFonts → b/i/… → color → sz → highlight → u → …).
// Previously we prepended <w:color> to the rPr body, which put it
// ahead of rStyle/rFonts/b/etc. — an invalid sequence that Word can
// silently drop. The new logic ranks each child by its schema
// position and splices our tags in order.

// CT_RPr child-element order. Subset covering the properties Word
// commonly emits; unknown tags fall to the end.
const RPR_SCHEMA_ORDER = [
  "rStyle",
  "rFonts",
  "b",
  "bCs",
  "i",
  "iCs",
  "caps",
  "smallCaps",
  "strike",
  "dstrike",
  "outline",
  "shadow",
  "emboss",
  "imprint",
  "noProof",
  "snapToGrid",
  "vanish",
  "webHidden",
  "color",
  "spacing",
  "w",
  "kern",
  "position",
  "sz",
  "szCs",
  "highlight",
  "u",
  "effect",
  "bdr",
  "shd",
  "fitText",
  "vertAlign",
  "rtl",
  "cs",
  "em",
  "lang",
  "eastAsianLayout",
  "specVanish",
  "oMath",
  "rPrChange",
] as const;

function rprChildRank(tagName: string): number {
  const idx = (RPR_SCHEMA_ORDER as readonly string[]).indexOf(tagName);
  return idx === -1 ? RPR_SCHEMA_ORDER.length : idx;
}

export function colorizeRuns(
  xml: string,
  colorHex: string,
  highlightVal?: string,
): string {
  const inserts: Array<{ tagName: string; xml: string }> = [
    { tagName: "color", xml: `<w:color w:val="${colorHex}"/>` },
  ];
  if (highlightVal) {
    inserts.push({
      tagName: "highlight",
      xml: `<w:highlight w:val="${highlightVal}"/>`,
    });
  }
  const freshRpr = `<w:rPr>${inserts.map((i) => i.xml).join("")}</w:rPr>`;

  // (a) self-closing rPr
  let result = xml.replace(/<w:rPr(?:\s[^>]*)?\/>/g, freshRpr);

  // (b) existing rPr body — strip prior color/highlight, splice in order
  result = result.replace(
    /<w:rPr(?:\s[^>]*)?>([\s\S]*?)<\/w:rPr>/g,
    (_full, body: string) =>
      `<w:rPr>${injectRprChildren(body, inserts)}</w:rPr>`,
  );

  // (c) run without rPr
  result = result.replace(
    /(<w:r(?:\s[^>]*)?>)(?!<w:rPr)/g,
    `$1${freshRpr}`,
  );

  return result;
}

function injectRprChildren(
  body: string,
  newTags: ReadonlyArray<{ tagName: string; xml: string }>,
): string {
  // 1. Strip any existing copies of the tags we're about to insert
  //    (self-closing or paired form; attributes optional).
  let cleaned = body;
  for (const { tagName } of newTags) {
    const selfClosing = new RegExp(
      `<w:${tagName}(?:\\s[^>]*)?\\/>`,
      "g",
    );
    const paired = new RegExp(
      `<w:${tagName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/w:${tagName}>`,
      "g",
    );
    cleaned = cleaned.replace(selfClosing, "").replace(paired, "");
  }

  // 2. Enumerate top-level <w:*> elements with their schema rank.
  //    Non-w: elements and text fall through unchanged (they'll be
  //    emitted between element boundaries by the cursor walk).
  const elementRe =
    /<w:([a-zA-Z0-9]+)(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/w:\1>)/g;
  const positions: Array<{ end: number; rank: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = elementRe.exec(cleaned)) !== null) {
    positions.push({
      end: m.index + m[0].length,
      rank: rprChildRank(m[1]),
    });
  }

  // 3. Walk the cleaned body; before each existing element whose rank
  //    is strictly greater than a pending insert, splice the insert in.
  const pending = newTags
    .slice()
    .sort((a, b) => rprChildRank(a.tagName) - rprChildRank(b.tagName));

  let out = "";
  let cursor = 0;
  let insertIdx = 0;
  for (const pos of positions) {
    while (
      insertIdx < pending.length &&
      rprChildRank(pending[insertIdx].tagName) < pos.rank
    ) {
      out += pending[insertIdx].xml;
      insertIdx++;
    }
    out += cleaned.slice(cursor, pos.end);
    cursor = pos.end;
  }
  out += cleaned.slice(cursor);
  while (insertIdx < pending.length) {
    out += pending[insertIdx].xml;
    insertIdx++;
  }
  return out;
}

function buildInsertedParagraph(
  pPr: string,
  text: string,
  author: string,
  date: string,
  revId: number,
): string {
  // Single synthetic run — force green via inline rPr so inserted text
  // visually pairs with the red deletions above it.
  const insertion = `<w:ins w:id="${revId}" w:author="${escapeAttr(
    author,
  )}" w:date="${date}"><w:r>${INS_RPR}<w:t xml:space="preserve">${encodeEntities(
    text,
  )}</w:t></w:r></w:ins>`;
  return `<w:p>${pPr}${insertion}</w:p>`;
}

/**
 * Best-effort phrase replacement. Finds the first <w:r> whose <w:t>
 * contains originalText and splits the whole run into
 * (before-run) + <w:del> + <w:ins> + (after-run), inheriting the
 * original <w:rPr> on each side so formatting survives. Returns null
 * when the phrase spans multiple runs; the caller falls back to a
 * paragraph-level del+ins pair via locatePhrase.
 */
function replacePhraseInParagraph(
  p: ExtractedParagraph,
  originalText: string,
  finalText: string,
  author: string,
  date: string,
  revIdStart: number,
): string | null {
  if (!originalText) return null;
  const encoded = encodeEntities(originalText);

  // Match a whole <w:r>...</w:r> run that contains the phrase. We need
  // the full run (not just <w:t>) for two reasons:
  //   1. The before/after splits must inherit the run's <w:rPr> so that
  //      font, size, bold, italic, etc. survive the edit. The earlier
  //      version copied only the <w:t> opening tag, dropping all the
  //      formatting.
  //   2. The earlier version emitted "<w:r><w:t>after" with no closing
  //      "</w:t>", which produced invalid OOXML. Word silently dropped
  //      the rest of the body when the parser hit the broken run, so
  //      the downloaded DOCX appeared as a single corrupt paragraph.
  // Replacing the run as an atomic unit avoids both issues.
  const runRegex = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  const tInnerRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/;
  const tOpenRegex = /<w:t(?:\s[^>]*)?>/;
  const rPrRegex =
    /<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>|<w:rPr(?:\s[^>]*)?\/>/;

  let m: RegExpExecArray | null;
  while ((m = runRegex.exec(p.rawXml)) !== null) {
    const runXml = m[0];
    const tMatch = runXml.match(tInnerRegex);
    if (!tMatch) continue;
    const textContent = tMatch[1];
    if (!textContent.includes(encoded)) continue;

    const before = textContent.slice(0, textContent.indexOf(encoded));
    const after = textContent.slice(
      textContent.indexOf(encoded) + encoded.length,
    );

    const rPrMatch = runXml.match(rPrRegex);
    const rPr = rPrMatch ? rPrMatch[0] : "";
    const tOpen = runXml.match(tOpenRegex)?.[0] ?? '<w:t xml:space="preserve">';

    const beforeRun =
      before.length > 0 ? `<w:r>${rPr}${tOpen}${before}</w:t></w:r>` : "";
    const afterRun =
      after.length > 0 ? `<w:r>${rPr}${tOpen}${after}</w:t></w:r>` : "";
    const delBlock =
      `<w:del w:id="${revIdStart}" w:author="${escapeAttr(author)}" w:date="${date}">` +
      `<w:r>${DEL_RPR}<w:delText xml:space="preserve">${encoded}</w:delText></w:r>` +
      `</w:del>`;
    const insBlock =
      `<w:ins w:id="${revIdStart + 1}" w:author="${escapeAttr(author)}" w:date="${date}">` +
      `<w:r>${INS_RPR}<w:t xml:space="preserve">${encodeEntities(finalText)}</w:t></w:r>` +
      `</w:ins>`;

    const replacement = beforeRun + delBlock + insBlock + afterRun;
    return p.rawXml.replace(runXml, replacement);
  }

  // Fallback: multi-run / whitespace-mismatch case. Word splits text
  // across <w:r> boundaries for formatting reasons (bold toggles,
  // autocorrect runs, pasted spans) so the phrase often isn't in a
  // single <w:t>. locatePhrase finds it in the raw plain-text view;
  // if it's there, emit the edit as a whole-paragraph del+ins pair.
  // Trade-off: intra-paragraph formatting inside the deleted block
  // collapses to a single inserted run, but the edit is VISIBLE
  // instead of silently orphaned.
  const range = locatePhrase(p.text, originalText);
  if (!range) return null;

  const newText =
    p.text.slice(0, range.start) + finalText + p.text.slice(range.end);

  return (
    buildDeletedParagraph(p, author, date, revIdStart) +
    buildInsertedParagraph(p.pPr, newText, author, date, revIdStart + 1)
  );
}

// ── Entity handling ─────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function encodeEntities(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
