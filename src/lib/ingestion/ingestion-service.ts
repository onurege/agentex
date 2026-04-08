// ============================================================
// Document Ingestion Service
// ============================================================
//
// Orchestrates the flow from raw input (scenario or uploaded file)
// to a normalized ParsedDocument.
//
// Two paths:
//   1. Scenario → builds ParsedDocument from DemoScenario data
//   2. Upload   → delegates to the appropriate DocumentParser
//
// The service is stateless — it transforms input and returns results.
// State management (storing the ParsedDocument) is handled by the store.
// ============================================================

import type {
  DocumentSource,
  ParsedDocument,
  DocumentIngestionResult,
  DocumentSection,
  DocumentMetadata,
} from "./types";
import { getParser } from "./parsers";
import { getScenario } from "../scenarios";
import { segmentSections, synthesizeClausesFromFindings } from "./segmentation";

// --- Service Interface ---

export interface DocumentIngestionService {
  /**
   * Ingest a document from any source.
   *
   * @param source — identifies the origin (scenario or upload metadata)
   * @param rawFile — the browser File object (required for upload sources)
   */
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
      if (source.type === "scenario") {
        return this.ingestFromScenario(source.scenarioId);
      }
      return this.ingestFromUpload(source, rawFile);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Ingestion failed",
        warnings: [],
      };
    }
  }

  // ── Scenario Ingestion ───────────────────────────────────────

  private ingestFromScenario(
    scenarioId: string,
  ): DocumentIngestionResult {
    const scenario = getScenario(scenarioId);
    if (!scenario) {
      return {
        success: false,
        error: `Scenario not found: ${scenarioId}`,
        warnings: [],
      };
    }

    const doc = scenario.document;

    // Base sections from scenario metadata
    const baseSections: DocumentSection[] = [
      {
        id: "section-overview",
        title: "Genel Bakış",
        content: doc.summary || scenario.description,
        sectionType: "overview",
        depth: 0,
      },
      {
        id: "section-context",
        title: "İş Bağlamı",
        content: scenario.businessContext.notes.join("\n"),
        sectionType: "context",
        depth: 0,
      },
    ];

    // Risk category sections
    scenario.chiefRecommendation.riskCategories.forEach((risk, i) => {
      baseSections.push({
        id: `section-risk-${i + 1}`,
        title: risk.name,
        content: risk.description,
        sectionType: "general",
        depth: 0,
      });
    });

    // Synthesize clause-level sections from findings data
    const clauseSections = synthesizeClausesFromFindings(scenario.findings);

    // Merge: base sections first, then clause sections
    const sections: DocumentSection[] = [
      ...baseSections,
      ...clauseSections,
    ];

    const metadata: DocumentMetadata = {
      documentTypeGuess: scenario.chiefRecommendation.documentType,
      language: "tr",
      parserUsed: "mock-scenario",
    };

    const parsedDocument: ParsedDocument = {
      id: `scenario-${scenarioId}`,
      source: { type: "scenario", scenarioId },
      fileName: doc.name,
      fileType: doc.type,
      fileSize: doc.size,
      pageCount: doc.pageCount ?? null,
      sections,
      fullText: null, // scenarios don't have real text content
      metadata,
      parsedAt: new Date().toISOString(),
    };

    return {
      success: true,
      document: parsedDocument,
      warnings: [],
    };
  }

  // ── Upload Ingestion ─────────────────────────────────────────

  private async ingestFromUpload(
    source: Extract<DocumentSource, { type: "upload" }>,
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
