// ============================================================
// Document Ingestion Service
// ============================================================
//
// Transforms an uploaded file into a normalized ParsedDocument
// via the appropriate parser (PDF/DOCX/TXT). Stateless — state
// management is handled by the boardroom flow store.
// ============================================================

import type {
  DocumentSource,
  DocumentIngestionResult,
} from "./types";
import { getParser } from "./parsers";
import { segmentSections } from "./segmentation";

// --- Service Interface ---

export interface DocumentIngestionService {
  ingest(
    source: DocumentSource,
    rawFile?: File,
  ): Promise<DocumentIngestionResult>;
}

// --- Default Implementation ---

export class DefaultDocumentIngestionService
  implements DocumentIngestionService
{
  async ingest(
    source: DocumentSource,
    rawFile?: File,
  ): Promise<DocumentIngestionResult> {
    try {
      return this.ingestFromUpload(source, rawFile);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Ingestion failed",
        warnings: [],
      };
    }
  }

  // ── Upload Ingestion ─────────────────────────────────────────

  private async ingestFromUpload(
    source: DocumentSource,
    rawFile?: File,
  ): Promise<DocumentIngestionResult> {
    if (!rawFile) {
      return {
        success: false,
        error: "No file provided for upload ingestion",
        warnings: [],
      };
    }

    const ext = source.fileName.split(".").pop()?.toLowerCase() ?? "";
    const warnings: string[] = [];

    const parser = getParser(ext);
    const document = await parser.parse(rawFile);

    // Apply segmentation to enrich sections with clause structure
    if (document.sections.length > 0) {
      document.sections = segmentSections(document.sections);
    }

    // Surface extraction quality warnings
    if (document.metadata.extractionQuality === "none") {
      warnings.push(
        `No text could be extracted from this ${ext.toUpperCase()} file. ` +
          `The file may be scanned or password-protected.`,
      );
    } else if (document.metadata.extractionQuality === "poor") {
      warnings.push(
        `Text extraction quality is low for this ${ext.toUpperCase()} file. ` +
          `Analysis results may be limited.`,
      );
    }

    if (document.metadata.extractionNotes) {
      document.metadata.extractionNotes.forEach((note) => {
        console.log(`[Ingestion] ${note}`);
      });
    }

    return {
      success: true,
      document,
      warnings,
    };
  }
}

// --- Singleton ---

let _instance: DocumentIngestionService | null = null;

/**
 * Get the document ingestion service singleton.
 * Future: could accept configuration or return different implementations.
 */
export function getIngestionService(): DocumentIngestionService {
  if (!_instance) {
    _instance = new DefaultDocumentIngestionService();
  }
  return _instance;
}
