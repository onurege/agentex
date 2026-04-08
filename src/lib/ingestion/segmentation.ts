// ============================================================
// Document Segmentation — clause-level structure detection
// ============================================================
//
// Post-processing step that transforms flat DocumentSections
// into clause-aware sections by detecting patterns:
//   - Turkish legal clauses: "Madde X", "Madde X.Y"
//   - Numbered items: "1.", "1.1", "1.1.1", "(a)", "(i)"
//   - Heading-like lines: ALL CAPS, lines ending with ":"
//
// This module is deterministic — no LLM calls.
// It improves structure from whatever the parser produced.
//
// Future findings generation will consume these clauses
// to produce accurate clause-referenced findings.
// ============================================================

import type { DocumentSection, DocumentClause, SectionType } from "./types";

// --- Public API ---

/**
 * Segment raw sections into clause-aware sections.
 * Enriches sections with sectionType, clauseRef, depth, and clauses.
 * Safe to call on any sections — no-op on empty input.
 */
export function segmentSections(
  sections: DocumentSection[],
): DocumentSection[] {
  if (sections.length === 0) return [];

  return sections.map((section) => {
    const sectionType = detectSectionType(section);
    const clauseRef = extractClauseRef(section.title) ?? section.clauseRef;
    const clauses = extractClauses(section.content);

    return {
      ...section,
      sectionType: section.sectionType ?? sectionType,
      clauseRef,
      depth: section.depth ?? (clauseRef ? 0 : undefined),
      clauses: clauses.length > 0 ? clauses : section.clauses,
    };
  });
}

/**
 * Segment raw text into sections by detecting headings and clause patterns.
 * Used by PlainTextParser as a smarter alternative to double-newline splitting.
 */
export function segmentText(text: string): DocumentSection[] {
  const lines = text.split("\n");
  const sections: DocumentSection[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];
  let sectionIdx = 0;

  const flushSection = () => {
    const content = currentLines.join("\n").trim();
    if (content.length === 0 && !currentTitle) return;

    sectionIdx++;
    const title = currentTitle || `Bölüm ${sectionIdx}`;
    const clauseRef = extractClauseRef(title);
    const sectionType = clauseRef ? "clause" as SectionType : "general" as SectionType;
    const clauses = extractClauses(content);

    sections.push({
      id: `section-${sectionIdx}`,
      title,
      content: content || title,
      sectionType,
      clauseRef: clauseRef ?? undefined,
      depth: clauseRef ? 0 : undefined,
      clauses: clauses.length > 0 ? clauses : undefined,
    });

    currentTitle = "";
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (isHeadingLine(trimmed)) {
      flushSection();
      currentTitle = trimmed;
    } else {
      currentLines.push(line);
    }
  }

  flushSection();

  return sections;
}

// --- Pattern Detection ---

/** Turkish legal clause pattern: "Madde 14", "MADDE 8.3", "Madde 14.2(a)" */
const MADDE_PATTERN = /^Madde\s+(\d+(?:\.\d+)*(?:\([a-zıiA-Zİ]\))?)/i;

/** Numbered section pattern: "1.", "1.1", "1.1.1" at start of line */
const NUMBERED_PATTERN = /^(\d+(?:\.\d+)*)\.\s+/;

/** Sub-item pattern: "(a)", "(i)", "(1)" */
const SUBITEM_PATTERN = /^\(([a-zıi\d]+)\)\s+/i;

/** ALL CAPS heading (at least 3 words, Turkish chars included) */
const ALLCAPS_PATTERN = /^[A-ZÇĞİÖŞÜ\s]{8,}$/;

/** Heading-like line: ends with ":" or is a short ALL CAPS line */
function isHeadingLine(line: string): boolean {
  if (line.length === 0) return false;

  // "Madde X — Title" pattern
  if (MADDE_PATTERN.test(line)) return true;

  // ALL CAPS line (min 8 chars)
  if (ALLCAPS_PATTERN.test(line)) return true;

  // Numbered section heading: "1. Title" or "1.1 Title"
  if (NUMBERED_PATTERN.test(line) && line.length < 100) return true;

  // Short line ending with ":"
  if (line.endsWith(":") && line.length < 80) return true;

  return false;
}

/** Extract clause reference from a title string */
function extractClauseRef(title: string): string | null {
  // "Madde 14.2 — Tazminat" → "Madde 14.2"
  const maddeMatch = title.match(MADDE_PATTERN);
  if (maddeMatch) return `Madde ${maddeMatch[1]}`;

  // "14.2 Tazminat" → "14.2"
  const numberedMatch = title.match(NUMBERED_PATTERN);
  if (numberedMatch) return numberedMatch[1];

  return null;
}

/** Detect section type from content and title */
function detectSectionType(section: DocumentSection): SectionType {
  const title = section.title.toLowerCase();

  if (MADDE_PATTERN.test(section.title)) return "clause";

  if (
    title.includes("tanım") ||
    title.includes("definition") ||
    title.includes("terim")
  )
    return "definition";

  if (
    title.includes("ek") ||
    title.includes("appendix") ||
    title.includes("annex")
  )
    return "appendix";

  if (
    title.includes("genel bakış") ||
    title.includes("özet") ||
    title.includes("giriş") ||
    title.includes("overview")
  )
    return "overview";

  if (
    title.includes("bağlam") ||
    title.includes("context") ||
    title.includes("amaç")
  )
    return "context";

  return "general";
}

// --- Clause Extraction ---

/**
 * Extract fine-grained clauses from section content.
 * Detects "Madde X.Y", numbered items, and sub-items.
 */
function extractClauses(content: string): DocumentClause[] {
  const lines = content.split("\n");
  const clauses: DocumentClause[] = [];
  let currentRef = "";
  let currentTitle: string | undefined;
  let currentLines: string[] = [];
  let currentDepth = 0;
  let clauseIdx = 0;

  const flushClause = () => {
    const text = currentLines.join("\n").trim();
    if (!currentRef || text.length === 0) {
      currentLines = [];
      return;
    }

    clauseIdx++;
    clauses.push({
      id: `clause-${clauseIdx}`,
      ref: currentRef,
      title: currentTitle,
      text,
      depth: currentDepth,
    });

    currentRef = "";
    currentTitle = undefined;
    currentLines = [];
    currentDepth = 0;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Check for "Madde X.Y" clause start
    const maddeMatch = trimmed.match(MADDE_PATTERN);
    if (maddeMatch) {
      flushClause();
      currentRef = `Madde ${maddeMatch[1]}`;
      currentDepth = (maddeMatch[1].match(/\./g) || []).length;
      // Extract title after the ref: "Madde 14.2 — Tazminat" → "Tazminat"
      const afterRef = trimmed.slice(maddeMatch[0].length).replace(/^[\s—–-]+/, "").trim();
      if (afterRef.length > 0 && afterRef.length < 60) {
        currentTitle = afterRef;
      }
      continue;
    }

    // Check for numbered clause: "8.3 Komisyon Hesaplama"
    const numberedMatch = trimmed.match(NUMBERED_PATTERN);
    if (numberedMatch && trimmed.length < 120) {
      flushClause();
      currentRef = numberedMatch[1];
      currentDepth = (numberedMatch[1].match(/\./g) || []).length;
      const afterNum = trimmed.slice(numberedMatch[0].length).trim();
      if (afterNum.length > 0 && afterNum.length < 60) {
        currentTitle = afterNum;
      } else {
        currentLines.push(afterNum);
      }
      continue;
    }

    // Check for sub-items: "(a) ..."
    const subMatch = trimmed.match(SUBITEM_PATTERN);
    if (subMatch && currentRef) {
      // Sub-items become part of current clause content
      currentLines.push(trimmed);
      continue;
    }

    // Regular content line
    if (currentRef) {
      currentLines.push(trimmed);
    }
  }

  flushClause();
  return clauses;
}

// --- Scenario Clause Synthesis ---

/**
 * Synthesize clause sections from scenario findings data.
 * Extracts unique clause/section references from findings
 * and creates structured sections with clause metadata.
 *
 * This gives Gemini accurate clause targets for findings generation.
 */
export function synthesizeClausesFromFindings(
  findings: Array<{
    clause?: string;
    section?: string;
    title: string;
    description: string;
  }>,
): DocumentSection[] {
  // Group findings by section
  const sectionMap = new Map<
    string,
    { clauses: Map<string, string[]>; descriptions: string[] }
  >();

  for (const f of findings) {
    const sectionName = f.section || "Genel";
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, { clauses: new Map(), descriptions: [] });
    }

    const entry = sectionMap.get(sectionName)!;
    entry.descriptions.push(`${f.title}: ${f.description.slice(0, 150)}`);

    if (f.clause) {
      if (!entry.clauses.has(f.clause)) {
        entry.clauses.set(f.clause, []);
      }
      entry.clauses.get(f.clause)!.push(f.title);
    }
  }

  // Build sections
  const sections: DocumentSection[] = [];
  let idx = 0;

  Array.from(sectionMap.entries()).forEach(([sectionName, data]) => {
    idx++;
    const clauseRef = extractClauseRef(sectionName);

    const clauses: DocumentClause[] = [];
    let clauseIdx = 0;
    Array.from(data.clauses.entries()).forEach(([ref, titles]) => {
      clauseIdx++;
      clauses.push({
        id: `clause-synth-${idx}-${clauseIdx}`,
        ref,
        title: titles[0],
        text: titles.join("; "),
        depth: (ref.match(/\./g) || []).length,
      });
    });

    sections.push({
      id: `section-synth-${idx}`,
      title: sectionName,
      content: data.descriptions.join("\n"),
      sectionType: clauseRef || clauses.length > 0 ? "clause" : "general",
      clauseRef: clauseRef ?? undefined,
      depth: 0,
      clauses: clauses.length > 0 ? clauses : undefined,
    });
  });

  return sections;
}
