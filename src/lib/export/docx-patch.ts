// ============================================================
// DOCX In-Place Patching — conservative span-level revisions
// ============================================================
//
// Takes the original uploaded DOCX and applies revision suggestions
// with minimal disruption to the original document:
//
//   1. Finds currentText as an exact, unique match in paragraph text
//   2. Identifies the specific run span containing the match
//   3. Splits only the affected runs, preserving surrounding text
//   4. Inserts red+strikethrough (old) + green (new) for the matched span
//   5. All other paragraphs and runs remain completely untouched
//
// Conservative rules:
//   - Only exact, unique matches are patched in-place
//   - Ambiguous matches (found in 2+ paragraphs) → fallback
//   - No match found → fallback
//   - Each paragraph can only be patched once
//   - Unmatched revisions appended as a fallback section at the end
// ============================================================

import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { RevisionSuggestion } from "../types";
import { AGENTS } from "../agents";

// --- OOXML Namespace ---

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// --- Types ---

export type MatchConfidence = "exact" | "ambiguous" | "none";

export interface RevisionPatchDetail {
  section: string;
  confidence: MatchConfidence;
  patched: boolean;
  reason?: string;
}

export interface PatchResult {
  matched: number;
  unmatched: number;
  ambiguous: number;
  revisionDetails: RevisionPatchDetail[];
}

// --- Main Patching Function ---

export async function patchDocxWithRevisions(
  originalBuffer: ArrayBuffer,
  revisions: RevisionSuggestion[],
): Promise<{ blob: Blob; result: PatchResult }> {
  const zip = await JSZip.loadAsync(originalBuffer);

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new Error("Invalid DOCX: word/document.xml not found");
  }

  const xmlString = await docXmlFile.async("string");
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  const body = doc.getElementsByTagNameNS(W_NS, "body")[0];
  if (!body) {
    throw new Error("Invalid DOCX: no body element");
  }

  const result: PatchResult = {
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    revisionDetails: [],
  };

  // Track patched paragraphs to prevent double-patching
  const patchedParagraphs = new Set<Element>();
  const unmatchedRevisions: RevisionSuggestion[] = [];

  // Collect all paragraphs once
  const paragraphs = collectParagraphs(body);

  // Process each revision
  for (const rev of revisions) {
    const detail = applyRevisionSafely(
      doc,
      paragraphs,
      patchedParagraphs,
      rev,
    );
    result.revisionDetails.push(detail);

    if (detail.patched) {
      result.matched++;
    } else if (detail.confidence === "ambiguous") {
      result.ambiguous++;
      unmatchedRevisions.push(rev);
    } else {
      result.unmatched++;
      unmatchedRevisions.push(rev);
    }
  }

  // Append unmatched/ambiguous revisions as a fallback section
  if (unmatchedRevisions.length > 0) {
    appendFallbackSection(doc, body, unmatchedRevisions);
  }

  // Serialize back to XML
  const serializer = new XMLSerializer();
  const modifiedXml = serializer.serializeToString(doc);

  zip.file("word/document.xml", modifiedXml);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return { blob, result };
}

// --- Collect Paragraphs ---

function collectParagraphs(body: Element): Element[] {
  const nodeList = body.getElementsByTagNameNS(W_NS, "p");
  const result: Element[] = [];
  for (let i = 0; i < nodeList.length; i++) {
    result.push(nodeList[i]);
  }
  return result;
}

// --- Safe Revision Application ---

function applyRevisionSafely(
  doc: Document,
  paragraphs: Element[],
  patchedParagraphs: Set<Element>,
  rev: RevisionSuggestion,
): RevisionPatchDetail {
  const searchText = normalizeForMatch(rev.currentText);

  if (searchText.length < 10) {
    return {
      section: rev.section,
      confidence: "none",
      patched: false,
      reason: "currentText too short for safe matching",
    };
  }

  // Find ALL paragraphs containing the search text
  const candidates: Array<{ para: Element; paraText: string; matchIndex: number }> = [];

  for (const para of paragraphs) {
    if (patchedParagraphs.has(para)) continue;

    const paraText = getParagraphText(para);
    const normalizedPara = normalizeForMatch(paraText);
    const matchIndex = normalizedPara.indexOf(searchText);

    if (matchIndex !== -1) {
      candidates.push({ para, paraText, matchIndex });
    }
  }

  // No match
  if (candidates.length === 0) {
    return {
      section: rev.section,
      confidence: "none",
      patched: false,
      reason: "currentText not found in document",
    };
  }

  // Ambiguous: found in multiple paragraphs
  if (candidates.length > 1) {
    return {
      section: rev.section,
      confidence: "ambiguous",
      patched: false,
      reason: `Found in ${candidates.length} paragraphs — skipping to avoid wrong match`,
    };
  }

  // Exactly one match — safe to patch
  const { para, paraText } = candidates[0];

  const success = patchParagraphSpan(doc, para, paraText, rev);
  if (success) {
    patchedParagraphs.add(para);
    return {
      section: rev.section,
      confidence: "exact",
      patched: true,
    };
  }

  return {
    section: rev.section,
    confidence: "exact",
    patched: false,
    reason: "Span-level patching failed internally",
  };
}

// --- Span-Level Paragraph Patching ---

/**
 * Patch a specific text span within a paragraph, preserving
 * all surrounding text and run formatting.
 *
 * Algorithm:
 *   1. Walk runs to build a character offset map
 *   2. Find which runs contain the matched text span
 *   3. Split affected runs: keep before-text, insert redline, keep after-text
 *   4. All unaffected runs remain untouched
 */
function patchParagraphSpan(
  doc: Document,
  para: Element,
  paraText: string,
  rev: RevisionSuggestion,
): boolean {
  // Find the match position in the original (non-normalized) paragraph text
  const matchStart = findMatchPosition(paraText, rev.currentText);
  if (matchStart === -1) return false;

  const matchEnd = matchStart + rev.currentText.length;

  // Build run offset map
  const directRuns = getDirectRuns(para);
  const runMap = buildRunOffsetMap(directRuns);

  if (runMap.length === 0) return false;

  // Find which runs are affected by the match span
  const affectedRuns = findAffectedRuns(runMap, matchStart, matchEnd);
  if (affectedRuns.length === 0) return false;

  // Build replacement nodes
  const replacementNodes: Element[] = [];

  for (let i = 0; i < runMap.length; i++) {
    const entry = runMap[i];

    if (!affectedRuns.includes(i)) {
      // Unaffected run — keep as-is (no modification)
      continue;
    }

    const runStart = entry.offset;
    const runEnd = entry.offset + entry.text.length;

    // Text before the match within this run
    const beforeStart = Math.max(0, matchStart - runStart);
    const beforeText = entry.text.slice(0, beforeStart);

    // Text after the match within this run
    const afterStart = Math.min(entry.text.length, matchEnd - runStart);
    const afterText = entry.text.slice(afterStart);

    // Keep text before match (preserve original run properties)
    if (beforeText.length > 0) {
      const beforeRun = cloneRunWithText(doc, entry.run, beforeText);
      replacementNodes.push(beforeRun);
    }

    // Insert redline only once (at the first affected run)
    if (i === affectedRuns[0]) {
      // Old text: red + strikethrough
      replacementNodes.push(
        createRedlineRun(doc, rev.currentText, "delete"),
      );
      // New text: green + bold
      replacementNodes.push(
        createRedlineRun(doc, rev.suggestedText, "insert"),
      );
    }

    // Keep text after match (preserve original run properties)
    if (afterText.length > 0) {
      const afterRun = cloneRunWithText(doc, entry.run, afterText);
      replacementNodes.push(afterRun);
    }
  }

  // Replace affected runs with new nodes
  // First, find the insertion reference point (first affected run)
  const firstAffectedRun = runMap[affectedRuns[0]].run;

  // Insert replacement nodes before the first affected run
  for (const node of replacementNodes) {
    para.insertBefore(node, firstAffectedRun);
  }

  // Remove all affected original runs
  for (const idx of affectedRuns) {
    const run = runMap[idx].run;
    if (run.parentNode === para) {
      para.removeChild(run);
    }
  }

  return true;
}

// --- Run Offset Map ---

interface RunEntry {
  run: Element;
  text: string;
  offset: number; // character offset within paragraph
}

function getDirectRuns(para: Element): Element[] {
  const runs: Element[] = [];
  for (let i = 0; i < para.childNodes.length; i++) {
    const child = para.childNodes[i];
    if (
      child.nodeType === 1 &&
      (child as Element).localName === "r" &&
      (child as Element).namespaceURI === W_NS
    ) {
      runs.push(child as Element);
    }
  }
  return runs;
}

function buildRunOffsetMap(runs: Element[]): RunEntry[] {
  const map: RunEntry[] = [];
  let offset = 0;

  for (const run of runs) {
    const text = getRunText(run);
    map.push({ run, text, offset });
    offset += text.length;
  }

  return map;
}

function getRunText(run: Element): string {
  let text = "";
  const tElements = run.getElementsByTagNameNS(W_NS, "t");
  for (let i = 0; i < tElements.length; i++) {
    text += tElements[i].textContent ?? "";
  }
  return text;
}

function findAffectedRuns(
  runMap: RunEntry[],
  matchStart: number,
  matchEnd: number,
): number[] {
  const affected: number[] = [];
  for (let i = 0; i < runMap.length; i++) {
    const entry = runMap[i];
    const runStart = entry.offset;
    const runEnd = entry.offset + entry.text.length;

    // Run overlaps with match span
    if (runEnd > matchStart && runStart < matchEnd) {
      affected.push(i);
    }
  }
  return affected;
}

// --- Text Matching ---

function getParagraphText(para: Element): string {
  const runs = getDirectRuns(para);
  return runs.map((r) => getRunText(r)).join("");
}

function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Find the position of revisionText within paragraphText,
 * using normalized whitespace matching but returning the
 * position in the original text.
 */
function findMatchPosition(
  paraText: string,
  revisionText: string,
): number {
  // Try exact match first
  const exactIdx = paraText.indexOf(revisionText);
  if (exactIdx !== -1) return exactIdx;

  // Try normalized whitespace match
  // Build a mapping from normalized positions to original positions
  const normalizedPara = normalizeForMatch(paraText);
  const normalizedSearch = normalizeForMatch(revisionText);

  const normalizedIdx = normalizedPara.indexOf(normalizedSearch);
  if (normalizedIdx === -1) return -1;

  // Map normalized position back to original position
  // Walk original text, tracking how many normalized chars we've passed
  let normalizedCount = 0;
  let inWhitespace = false;
  let originalStart = -1;

  // Skip leading whitespace in normalized
  const paraLower = paraText.toLowerCase();
  let startOffset = 0;
  while (startOffset < paraLower.length && paraLower[startOffset] === " ") {
    startOffset++;
  }

  for (let i = startOffset; i < paraText.length; i++) {
    const ch = paraText[i];

    if (/\s/.test(ch)) {
      if (!inWhitespace) {
        normalizedCount++;
        inWhitespace = true;
      }
    } else {
      inWhitespace = false;
      normalizedCount++;
    }

    if (normalizedCount - 1 === normalizedIdx && originalStart === -1) {
      originalStart = i;
    }

    if (originalStart !== -1) {
      // Check if we've covered enough characters
      const candidateSlice = paraText.slice(originalStart);
      if (
        normalizeForMatch(candidateSlice.slice(0, candidateSlice.length)) ===
        normalizedSearch
      ) {
        // Find exact end
        for (let len = revisionText.length; len <= candidateSlice.length; len++) {
          if (normalizeForMatch(candidateSlice.slice(0, len)) === normalizedSearch) {
            return originalStart;
          }
        }
      }
    }
  }

  // Fallback: use approximate position
  if (originalStart !== -1) return originalStart;
  return -1;
}

// --- Run Cloning ---

/**
 * Clone a run element, preserving its formatting (rPr) but
 * replacing the text content.
 */
function cloneRunWithText(
  doc: Document,
  originalRun: Element,
  newText: string,
): Element {
  const r = doc.createElementNS(W_NS, "w:r");

  // Copy run properties if they exist
  const rPr = originalRun.getElementsByTagNameNS(W_NS, "rPr")[0];
  if (rPr) {
    r.appendChild(rPr.cloneNode(true));
  }

  // New text element
  const t = doc.createElementNS(W_NS, "w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = newText;
  r.appendChild(t);

  return r;
}

// --- Redline Run Creation ---

function createRedlineRun(
  doc: Document,
  text: string,
  type: "delete" | "insert",
): Element {
  const r = doc.createElementNS(W_NS, "w:r");

  const rPr = doc.createElementNS(W_NS, "w:rPr");

  const color = doc.createElementNS(W_NS, "w:color");
  color.setAttribute("w:val", type === "delete" ? "CC0000" : "008000");
  rPr.appendChild(color);

  if (type === "delete") {
    const strike = doc.createElementNS(W_NS, "w:strike");
    rPr.appendChild(strike);
  } else {
    const bold = doc.createElementNS(W_NS, "w:b");
    rPr.appendChild(bold);
  }

  r.appendChild(rPr);

  const t = doc.createElementNS(W_NS, "w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);

  return r;
}

// --- Fallback Section ---

function appendFallbackSection(
  doc: Document,
  body: Element,
  revisions: RevisionSuggestion[],
): void {
  const sectPr = body.getElementsByTagNameNS(W_NS, "sectPr")[0];

  const insertNode = (el: Element) => {
    if (sectPr) {
      body.insertBefore(el, sectPr);
    } else {
      body.appendChild(el);
    }
  };

  insertNode(createSimpleParagraph(doc, ""));
  insertNode(
    createSimpleParagraph(
      doc,
      "── Eşleştirilemeyen Revizyonlar ──",
      "666666",
      true,
    ),
  );
  insertNode(createSimpleParagraph(doc, ""));

  for (const rev of revisions) {
    const agent = AGENTS[rev.agentId];
    const agentName = agent?.shortName ?? rev.agentId;

    insertNode(
      createSimpleParagraph(
        doc,
        `${rev.section} (${agentName})`,
        "333333",
        true,
      ),
    );

    const oldPara = doc.createElementNS(W_NS, "w:p");
    oldPara.appendChild(createRedlineRun(doc, rev.currentText, "delete"));
    insertNode(oldPara);

    const newPara = doc.createElementNS(W_NS, "w:p");
    newPara.appendChild(createRedlineRun(doc, rev.suggestedText, "insert"));
    insertNode(newPara);

    insertNode(
      createSimpleParagraph(doc, `Gerekçe: ${rev.rationale}`, "999999"),
    );
    insertNode(createSimpleParagraph(doc, ""));
  }
}

function createSimpleParagraph(
  doc: Document,
  text: string,
  color?: string,
  bold?: boolean,
): Element {
  const p = doc.createElementNS(W_NS, "w:p");
  const r = doc.createElementNS(W_NS, "w:r");

  if (color || bold) {
    const rPr = doc.createElementNS(W_NS, "w:rPr");
    if (color) {
      const c = doc.createElementNS(W_NS, "w:color");
      c.setAttribute("w:val", color);
      rPr.appendChild(c);
    }
    if (bold) {
      const b = doc.createElementNS(W_NS, "w:b");
      rPr.appendChild(b);
    }
    r.appendChild(rPr);
  }

  const t = doc.createElementNS(W_NS, "w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);

  p.appendChild(r);
  return p;
}

// --- Download Helper ---

export async function downloadPatchedDocx(
  originalBuffer: ArrayBuffer,
  fileName: string,
  revisions: RevisionSuggestion[],
): Promise<PatchResult> {
  const { blob, result } = await patchDocxWithRevisions(
    originalBuffer,
    revisions,
  );

  const baseName = fileName.replace(/\.[^.]+$/, "");
  saveAs(blob, `${baseName}_redline.docx`);

  return result;
}
