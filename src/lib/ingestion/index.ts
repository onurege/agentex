// ============================================================
// Document Ingestion — Public API
// ============================================================
//
// Usage:
//   import { getIngestionService, type ParsedDocument } from "@/lib/ingestion";
//
//   const service = getIngestionService();
//   const result = await service.ingest({ type: "upload", ... }, file);
//
// Architecture:
//   ingestion/
//   ├── types.ts              — DocumentSource, ParsedDocument, ReviewInput
//   ├── parsers.ts            — PdfParser, DocxParser, PlainTextParser, StubParser
//   ├── normalize-text.ts     — Text cleanup and quality assessment
//   ├── segmentation.ts       — Clause-level structure detection
//   ├── ingestion-service.ts  — DefaultDocumentIngestionService
//   └── index.ts              — re-exports (this file)
// ============================================================

// Types
export type {
  DocumentSource,
  SectionType,
  DocumentClause,
  DocumentSection,
  DocumentMetadata,
  ParsedDocument,
  DocumentIngestionResult,
  ReviewInput,
} from "./types";

// Segmentation
export {
  segmentSections,
  segmentText,
  synthesizeClausesFromFindings,
} from "./segmentation";

// Text normalization
export {
  normalizeExtractedText,
  assessExtractionQuality,
} from "./normalize-text";

// Parsers
export type { DocumentParser } from "./parsers";
export {
  PdfParser,
  DocxParser,
  PlainTextParser,
  StubParser,
  getParser,
} from "./parsers";

// Service
export type { DocumentIngestionService } from "./ingestion-service";
export {
  DefaultDocumentIngestionService,
  getIngestionService,
} from "./ingestion-service";
