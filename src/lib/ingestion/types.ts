// ============================================================
// Document Ingestion Types
// ============================================================
//
// Normalized types for document input uploaded by the user.
// Output (ParsedDocument) is consumed by the boardroom pipeline.
// ============================================================

// --- Document Source ---

/** Where the document came from — user upload */
export type DocumentSource = {
  type: "upload";
  fileName: string;
  fileType: string;
  fileSize: number;
};

// --- Section & Clause Types ---

/** Broad category for a document section */
export type SectionType =
  | "overview"
  | "clause"
  | "definition"
  | "appendix"
  | "context"
  | "general";

/**
 * A fine-grained clause within a section.
 * Represents a numbered article, paragraph, or sub-clause.
 *
 * Future findings generation will reference these directly.
 */
export interface DocumentClause {
  id: string;
  /** Reference string (e.g. "Madde 14.2", "3.1(a)") */
  ref: string;
  /** Clause title if detected (e.g. "Tazminat") */
  title?: string;
  /** Clause text content */
  text: string;
  /** Nesting depth: 0 = top-level article, 1 = sub-clause, 2 = sub-sub */
  depth: number;
}

/** A logical section extracted from the document */
export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  pageRange?: [number, number];
  /** Section category */
  sectionType?: SectionType;
  /** Clause reference (e.g. "Madde 14") for clause-type sections */
  clauseRef?: string;
  /** Nesting depth: 0 = top-level, 1 = subsection */
  depth?: number;
  /** Fine-grained clauses within this section */
  clauses?: DocumentClause[];
}

// --- Document Metadata ---

/** Metadata produced by the parser */
export interface DocumentMetadata {
  /** Best guess at the document type (e.g. "Bayi Dağıtım Sözleşmesi") */
  documentTypeGuess: string | null;
  /** Detected language (e.g. "tr", "en") */
  language: string | null;
  /** Which parser produced this result */
  parserUsed: "stub" | "plain-text" | "pdf" | "docx";
  /** Extraction quality assessment */
  extractionQuality?: "good" | "partial" | "poor" | "none";
  /** Diagnostics notes about the extraction process */
  extractionNotes?: string[];
}

/**
 * Normalized document representation.
 *
 * This is the canonical shape that downstream consumers (engine, UI)
 * should use. It captures both the content and provenance of a document.
 *
 * Sections are extracted by the appropriate parser (PDF/DOCX/TXT).
 */
export interface ParsedDocument {
  id: string;
  source: DocumentSource;
  fileName: string;
  fileType: "pdf" | "docx" | "txt";
  fileSize: number;
  pageCount: number | null;
  /** Extracted sections — empty array for stub-parsed uploads */
  sections: DocumentSection[];
  /** Raw text content — null when parsing is stubbed */
  fullText: string | null;
  metadata: DocumentMetadata;
  parsedAt: string;
}

// --- Ingestion Result ---

export interface DocumentIngestionResult {
  success: boolean;
  document?: ParsedDocument;
  error?: string;
  warnings: string[];
}

