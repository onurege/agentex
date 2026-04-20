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
import { matchClause, type MatchableParagraph } from "./clause-matcher";

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

const DEFAULT_AUTHOR = "AI Boardroom";

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

    const target = paragraphs.find((p) => p.id === match.paragraphId);
    if (!target) {
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
      case "replace_phrase":
        replacement = replacePhraseInParagraph(
          target,
          edit.originalText ?? "",
          edit.finalText,
          author,
          date,
          revId,
        );
        if (replacement) revId += 2;
        break;
    }

    if (!replacement) {
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
  // everything in <w:del>. pPr stays outside <w:del>.
  const innerAsDeleted = p.inner
    .replace(/<w:t(\s[^>]*)?>/g, "<w:delText$1>")
    .replace(/<\/w:t>/g, "</w:delText>");
  const deletion = `<w:del w:id="${revId}" w:author="${escapeAttr(
    author,
  )}" w:date="${date}">${innerAsDeleted}</w:del>`;
  return `<w:p>${p.pPr}${deletion}</w:p>`;
}

function buildInsertedParagraph(
  pPr: string,
  text: string,
  author: string,
  date: string,
  revId: number,
): string {
  const insertion = `<w:ins w:id="${revId}" w:author="${escapeAttr(
    author,
  )}" w:date="${date}"><w:r><w:t xml:space="preserve">${encodeEntities(
    text,
  )}</w:t></w:r></w:ins>`;
  return `<w:p>${pPr}${insertion}</w:p>`;
}

/**
 * Best-effort phrase replacement. Finds the first <w:t> whose text
 * contains originalText and splits it into before + del + ins + after.
 * Returns null when the phrase spans multiple runs (out of scope for
 * v1); the caller falls back to orphan.
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

  // Find a <w:t>...</w:t> block whose content contains the encoded phrase.
  const regex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(p.rawXml)) !== null) {
    const textContent = m[1];
    if (!textContent.includes(encoded)) continue;

    const before = textContent.slice(0, textContent.indexOf(encoded));
    const after = textContent.slice(
      textContent.indexOf(encoded) + encoded.length,
    );

    const opening = m[0].slice(0, m[0].indexOf(">") + 1);
    const replacement =
      `${opening}${before}</w:t></w:r>` +
      `<w:del w:id="${revIdStart}" w:author="${escapeAttr(author)}" w:date="${date}">` +
      `<w:r><w:delText xml:space="preserve">${encoded}</w:delText></w:r>` +
      `</w:del>` +
      `<w:ins w:id="${revIdStart + 1}" w:author="${escapeAttr(author)}" w:date="${date}">` +
      `<w:r><w:t xml:space="preserve">${encodeEntities(finalText)}</w:t></w:r>` +
      `</w:ins>` +
      `<w:r>${opening}${after}`;

    return p.rawXml.replace(m[0], replacement);
  }
  return null;
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
