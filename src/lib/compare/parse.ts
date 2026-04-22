// ============================================================
// Compare Module — Document Parser
// ============================================================
//
// Thin adapter over src/lib/ingestion. Runs the file through the
// appropriate parser (DOCX/PDF/TXT) and flattens the resulting
// document tree into CompareSections — the atomic unit the diff
// engine operates on. For DOCX uploads it also surfaces the original
// file buffer so the redline exporter can mutate it directly.
// ============================================================

import { getParser } from "@/lib/ingestion";
import type {
  DocumentSection,
  ParsedDocument,
} from "@/lib/ingestion/types";

/**
 * A diffable unit extracted from a contract. Either a top-level
 * section or a nested clause — the diff engine treats both uniformly
 * and matches by `clauseRef` across versions.
 */
export interface CompareSection {
  id: string;
  /** Canonical reference used for cross-version matching ("Madde 3.1", "8.2", etc.). */
  clauseRef: string;
  title?: string;
  text: string;
  /** 0 = top-level section / article, 1+ = nested sub-clause. */
  depth: number;
}

export interface CompareParseResult {
  fileName: string;
  sizeBytes: number;
  parsedAt: string;
  sections: CompareSection[];
  /** DOCX arraybuffer for downstream redline export. Null for PDF/TXT. */
  originalBuffer: ArrayBuffer | null;
}

/**
 * Parse a user-uploaded contract file into the compare module's shape.
 * Throws {@link DocxTooLargeError} for oversized DOCX uploads; other
 * failures fall back to a zero-section result via the ingestion
 * stub parser.
 */
export async function parseCompareDocument(
  file: File,
): Promise<CompareParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const fileType =
    ext === "pdf" || ext === "docx" || ext === "txt" ? ext : "txt";
  const parser = getParser(fileType);
  const parsed: ParsedDocument = await parser.parse(file);

  const sections = flattenSections(parsed.sections);
  const originalBuffer = parsed.originalDocxBase64
    ? base64ToArrayBuffer(parsed.originalDocxBase64)
    : null;

  return {
    fileName: parsed.fileName,
    sizeBytes: parsed.fileSize,
    parsedAt: parsed.parsedAt,
    sections,
    originalBuffer,
  };
}

/**
 * Flatten the ingestion parser's nested section/clause tree into a
 * flat list. When a section exposes detected clauses we emit those
 * and drop the parent — the clause IS the diffable unit. Sections
 * with no clauses and no content are discarded.
 */
function flattenSections(sections: DocumentSection[]): CompareSection[] {
  const flat: CompareSection[] = [];
  let fallbackIdx = 0;

  for (const section of sections) {
    if (section.clauses && section.clauses.length > 0) {
      for (const clause of section.clauses) {
        const text = clause.text.trim();
        if (text.length === 0) continue;
        flat.push({
          id: clause.id,
          clauseRef: clause.ref,
          title: clause.title ?? section.title,
          text,
          depth: clause.depth,
        });
      }
      continue;
    }

    const content = section.content.trim();
    if (content.length === 0) continue;

    fallbackIdx++;
    flat.push({
      id: section.id,
      clauseRef: section.clauseRef ?? `Bölüm ${fallbackIdx}`,
      title: section.title,
      text: content,
      depth: section.depth ?? 0,
    });
  }

  return flat;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  const buf = Buffer.from(base64, "base64");
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}
