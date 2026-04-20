// ============================================================
// Document Parsers — extract structured content from raw files
// ============================================================
//
// Parser hierarchy:
//   DocumentParser (interface)
//   ├── PdfParser        — extracts text from PDF via pdfjs-dist
//   ├── DocxParser       — extracts text from DOCX via mammoth.js
//   ├── PlainTextParser  — reads .txt files via FileReader (browser-native)
//   └── StubParser       — fallback for unsupported/failed extraction
//
// Each parser produces a ParsedDocument. Text normalization and
// clause segmentation are applied by the ingestion service after parsing.
// ============================================================

import type { ParsedDocument, DocumentMetadata, DocumentSection } from "./types";
import { segmentText } from "./segmentation";
import {
  normalizeExtractedText,
  assessExtractionQuality,
} from "./normalize-text";
import { assertDocxSize, DocxTooLargeError } from "./docx-guard";

// --- Parser Interface ---

export interface DocumentParser {
  /** File extensions this parser handles (e.g. ["pdf"], ["txt"]) */
  readonly supportedTypes: string[];
  /** Parse a browser File into a ParsedDocument */
  parse(file: File): Promise<ParsedDocument>;
}

// --- PDF Parser ---

/**
 * Extracts text from PDF files using pdfjs-dist (Mozilla pdf.js).
 * Works client-side in the browser. Extracts the text layer only —
 * scanned PDFs without a text layer will fall back to stub.
 */
export class PdfParser implements DocumentParser {
  readonly supportedTypes = ["pdf"];

  async parse(file: File): Promise<ParsedDocument> {
    const extractionNotes: string[] = [];

    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdfjsLib = await import("pdfjs-dist");

      // Use bundled worker to avoid CORS issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });
      const pdf = await loadingTask.promise;
      const pageCount = pdf.numPages;

      extractionNotes.push(`PDF loaded: ${pageCount} pages`);

      // Extract text from all pages
      const pageTexts: string[] = [];
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ("str" in item ? (item as { str: string }).str : ""))
          .join(" ");
        pageTexts.push(pageText);
      }

      const rawText = pageTexts.join("\n\n");

      // Normalize extracted text
      const { text, notes: normNotes } = normalizeExtractedText(rawText);
      extractionNotes.push(...normNotes);

      // Assess quality
      const { quality, notes: qualityNotes } = assessExtractionQuality(
        text,
        pageCount,
      );
      extractionNotes.push(...qualityNotes);

      // If extraction quality is too poor, return stub-like result with warning
      if (quality === "none" || quality === "poor") {
        extractionNotes.push(
          "Text extraction quality too low — possibly a scanned PDF",
        );
        return buildStubResult(file, "pdf", extractionNotes, quality);
      }

      // Segment text into sections
      let sections: DocumentSection[] = segmentText(text);
      if (sections.length === 0) {
        sections = splitIntoSections(text);
      }

      extractionNotes.push(`${sections.length} sections detected`);

      const metadata: DocumentMetadata = {
        documentTypeGuess: null,
        language: guessLanguage(text),
        parserUsed: "pdf",
        extractionQuality: quality,
        extractionNotes,
      };

      return {
        id: generateDocumentId(),
        source: {
          type: "upload",
          fileName: file.name,
          fileType: file.type || "application/pdf",
          fileSize: file.size,
        },
        fileName: file.name,
        fileType: "pdf",
        fileSize: file.size,
        pageCount,
        sections,
        fullText: text,
        metadata,
        parsedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "PDF extraction failed";
      extractionNotes.push(`PDF extraction error: ${errorMsg}`);
      console.error("PdfParser failed, falling back to stub:", errorMsg);
      return buildStubResult(file, "pdf", extractionNotes, "none");
    }
  }
}

// --- DOCX Parser ---

/**
 * Extracts text from DOCX files using mammoth.js.
 * Works client-side. Extracts plain text content with
 * basic structure preservation.
 */
export class DocxParser implements DocumentParser {
  readonly supportedTypes = ["docx"];

  async parse(file: File): Promise<ParsedDocument> {
    const extractionNotes: string[] = [];

    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);

      // Faz 4: enforce the size cap before parsing so the error surfaces
      // fast and callers can translate DOCX_TOO_LARGE into a 413.
      assertDocxSize(arrayBuffer);

      const mammoth = await import("mammoth");

      const result = await mammoth.extractRawText({
        arrayBuffer,
      });

      const rawText = result.value;

      if (result.messages && result.messages.length > 0) {
        const warnings = result.messages
          .filter((m: { type: string }) => m.type === "warning")
          .map((m: { message: string }) => m.message);
        if (warnings.length > 0) {
          extractionNotes.push(
            `mammoth warnings: ${warnings.slice(0, 3).join("; ")}`,
          );
        }
      }

      // Normalize extracted text
      const { text, notes: normNotes } = normalizeExtractedText(rawText);
      extractionNotes.push(...normNotes);

      // Assess quality
      const { quality, notes: qualityNotes } = assessExtractionQuality(
        text,
        null,
      );
      extractionNotes.push(...qualityNotes);

      if (quality === "none") {
        extractionNotes.push("No text extracted from DOCX");
        return buildStubResult(file, "docx", extractionNotes, "none");
      }

      // Segment text into sections
      let sections: DocumentSection[] = segmentText(text);
      if (sections.length === 0) {
        sections = splitIntoSections(text);
      }

      extractionNotes.push(`${sections.length} sections detected`);

      const metadata: DocumentMetadata = {
        documentTypeGuess: null,
        language: guessLanguage(text),
        parserUsed: "docx",
        extractionQuality: quality,
        extractionNotes,
      };

      // Faz 4: encode the original DOCX as base64 so it can travel
      // alongside the parsed view to the server and land in
      // DocumentArtifact.originalDocxBuffer for the redline renderer.
      const originalDocxBase64 = arrayBufferToBase64(arrayBuffer);

      return {
        id: generateDocumentId(),
        source: {
          type: "upload",
          fileName: file.name,
          fileType:
            file.type ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileSize: file.size,
        },
        fileName: file.name,
        fileType: "docx",
        fileSize: file.size,
        pageCount: null, // DOCX doesn't have a native page count
        sections,
        fullText: text,
        metadata,
        parsedAt: new Date().toISOString(),
        originalDocxBase64,
      };
    } catch (err) {
      if (err instanceof DocxTooLargeError) {
        throw err; // caller should map to 413
      }
      const errorMsg =
        err instanceof Error ? err.message : "DOCX extraction failed";
      extractionNotes.push(`DOCX extraction error: ${errorMsg}`);
      console.error("DocxParser failed, falling back to stub:", errorMsg);
      return buildStubResult(file, "docx", extractionNotes, "none");
    }
  }
}

// --- Base64 helper (browser-safe for moderate buffers) ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000; // avoid stack overflow on large buffers
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return typeof window !== "undefined"
    ? window.btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}

// --- Plain Text Parser ---

/**
 * Reads .txt files using the browser FileReader API.
 * Applies text normalization and clause-aware segmentation.
 */
export class PlainTextParser implements DocumentParser {
  readonly supportedTypes = ["txt"];

  async parse(file: File): Promise<ParsedDocument> {
    const rawText = await readFileAsText(file);
    const extractionNotes: string[] = [];

    // Normalize text
    const { text, notes: normNotes } = normalizeExtractedText(rawText);
    extractionNotes.push(...normNotes);

    // Assess quality
    const { quality, notes: qualityNotes } = assessExtractionQuality(
      text,
      null,
    );
    extractionNotes.push(...qualityNotes);

    // Use clause-aware segmentation
    let sections: DocumentSection[] = segmentText(text);
    if (sections.length === 0) {
      sections = splitIntoSections(text);
    }

    extractionNotes.push(`${sections.length} sections detected`);

    const metadata: DocumentMetadata = {
      documentTypeGuess: null,
      language: guessLanguage(text),
      parserUsed: "plain-text",
      extractionQuality: quality,
      extractionNotes,
    };

    return {
      id: generateDocumentId(),
      source: {
        type: "upload",
        fileName: file.name,
        fileType: file.type || "text/plain",
        fileSize: file.size,
      },
      fileName: file.name,
      fileType: "txt",
      fileSize: file.size,
      pageCount: null,
      sections,
      fullText: text,
      metadata,
      parsedAt: new Date().toISOString(),
    };
  }
}

// --- Stub Parser ---

/**
 * Fallback parser for unsupported file types or failed extraction.
 * Creates a valid ParsedDocument with empty content.
 */
export class StubParser implements DocumentParser {
  readonly supportedTypes = ["pdf", "docx"];

  async parse(file: File): Promise<ParsedDocument> {
    return buildStubResult(file, extractFileType(file.name), [
      "No parser available for this file type",
    ], "none");
  }
}

// --- Helpers ---

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function extractFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || ext === "docx" || ext === "txt") return ext;
  return "txt";
}

function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Split plain text into logical sections by double-newline boundaries.
 * Fallback when segmentText produces nothing.
 */
function splitIntoSections(
  text: string,
): { id: string; title: string; content: string }[] {
  const chunks = text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  return chunks.map((content, i) => ({
    id: `section-${i + 1}`,
    title: `Bölüm ${i + 1}`,
    content,
  }));
}

/**
 * Naive language detection: checks for common Turkish characters.
 */
function guessLanguage(text: string): string | null {
  const turkishPattern = /[çğıöşüÇĞİÖŞÜ]/;
  if (turkishPattern.test(text)) return "tr";
  return null;
}

/**
 * Build a stub ParsedDocument for failed or unsupported extraction.
 */
function buildStubResult(
  file: File,
  fileType: string,
  extractionNotes: string[],
  quality: "good" | "partial" | "poor" | "none",
): ParsedDocument {
  const ft = (fileType === "pdf" || fileType === "docx" ? fileType : "txt") as
    | "pdf"
    | "docx"
    | "txt";

  return {
    id: generateDocumentId(),
    source: {
      type: "upload",
      fileName: file.name,
      fileType: file.type || fileType,
      fileSize: file.size,
    },
    fileName: file.name,
    fileType: ft,
    fileSize: file.size,
    pageCount: null,
    sections: [],
    fullText: null,
    metadata: {
      documentTypeGuess: null,
      language: null,
      parserUsed: "stub",
      extractionQuality: quality,
      extractionNotes,
    },
    parsedAt: new Date().toISOString(),
  };
}

// --- Parser Registry ---

const parsers: DocumentParser[] = [
  new PdfParser(),
  new DocxParser(),
  new PlainTextParser(),
  new StubParser(),
];

/**
 * Get the appropriate parser for a file extension.
 * Falls back to StubParser for unknown types.
 */
export function getParser(fileType: string): DocumentParser {
  const normalized = fileType.toLowerCase().replace(".", "");
  return (
    parsers.find((p) => p.supportedTypes.includes(normalized)) ??
    parsers[parsers.length - 1] // StubParser fallback
  );
}
