// ============================================================
// Evaluation Cases — representative test inputs
// ============================================================

import type { EvalCase } from "./types";
import type { ParsedDocument } from "../ingestion/types";
import { DEMO_SCENARIOS } from "../scenarios";
import { getIngestionService } from "../ingestion";

// --- Build Cases from Scenarios ---

function buildScenarioCase(scenarioId: string): EvalCase | null {
  const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return null;

  // Build ParsedDocument via ingestion service (synchronous for scenarios)
  const service = getIngestionService();
  // Ingestion is async but scenario path is sync internally
  let document: ParsedDocument | null = null;

  // We'll build it inline since scenario ingestion doesn't need async
  const source = { type: "scenario" as const, scenarioId };
  service.ingest(source).then((r) => {
    if (r.success && r.document) document = r.document;
  });

  // Fallback: build minimal ParsedDocument directly
  if (!document) {
    document = {
      id: `eval-${scenarioId}`,
      source,
      fileName: scenario.document.name,
      fileType: scenario.document.type,
      fileSize: scenario.document.size,
      pageCount: scenario.document.pageCount ?? null,
      sections: [],
      fullText: null,
      metadata: {
        documentTypeGuess: scenario.chiefRecommendation.documentType,
        language: "tr",
        parserUsed: "mock-scenario",
      },
      parsedAt: new Date().toISOString(),
    };
  }

  return {
    id: scenarioId,
    name: scenario.name,
    description: scenario.description,
    scenarioId,
    document,
    businessContext: scenario.businessContext,
    selectedAgents: scenario.chiefRecommendation.recommendedAgents,
    expectations: {
      minFindings: 6,
      minAgentsWithFindings: 2,
      expectClauseRefs: true,
      minRevisions: 2,
      expectDisagreements: true,
      minCorrections: 2,
      hasDocumentContent: true,
    },
  };
}

// --- Synthetic Upload Case ---

const SYNTHETIC_CONTRACT_TEXT = `DANIŞMANLIK HİZMET SÖZLEŞMESİ

Madde 1 — Taraflar
Bu sözleşme, Şirket ("Müşteri") ile Danışman ("Hizmet Sağlayıcı") arasında akdedilmiştir.

Madde 2 — Hizmet Kapsamı
Danışman, Müşteri'ye stratejik danışmanlık hizmetleri sunacaktır.
Hizmetler aylık raporlama ve üç aylık değerlendirme toplantılarını kapsar.

Madde 3 — Ücret ve Ödeme
3.1 Aylık danışmanlık ücreti 15.000 EUR + KDV olarak belirlenmiştir.
3.2 Ödemeler, fatura tarihinden itibaren 30 gün içinde yapılacaktır.
3.3 Geç ödemelere aylık %1,5 gecikme faizi uygulanır.

Madde 4 — Süre ve Fesih
4.1 Sözleşme süresi 12 aydır ve taraflardan biri 60 gün önceden yazılı bildirimde bulunmadıkça otomatik olarak yenilenir.
4.2 Haklı sebep halinde derhal fesih mümkündür.

Madde 5 — Gizlilik
Taraflar, iş ilişkisi süresince ve sözleşme sona erdikten sonra 2 yıl boyunca gizli bilgileri koruyacaktır.

Madde 6 — Sorumluluk
Danışmanın toplam sorumluluğu, son 12 aylık dönemde ödenen toplam ücretle sınırlıdır.`;

function buildSyntheticUploadCase(): EvalCase {
  const document: ParsedDocument = {
    id: "eval-synthetic-upload",
    source: {
      type: "upload",
      fileName: "danismanlik_sozlesmesi.txt",
      fileType: "text/plain",
      fileSize: SYNTHETIC_CONTRACT_TEXT.length,
    },
    fileName: "danismanlik_sozlesmesi.txt",
    fileType: "txt",
    fileSize: SYNTHETIC_CONTRACT_TEXT.length,
    pageCount: null,
    sections: [], // Will be populated by segmentation
    fullText: SYNTHETIC_CONTRACT_TEXT,
    metadata: {
      documentTypeGuess: null,
      language: "tr",
      parserUsed: "plain-text",
    },
    parsedAt: new Date().toISOString(),
  };

  // Apply segmentation
  const { segmentText } = require("../ingestion/segmentation");
  document.sections = segmentText(SYNTHETIC_CONTRACT_TEXT);

  return {
    id: "synthetic-upload",
    name: "Sentetik Danışmanlık Sözleşmesi (Upload)",
    description: "Plain-text contract for testing upload extraction pipeline",
    document,
    businessContext: {
      notes: [
        "Stratejik danışmanlık hizmeti",
        "12 aylık sözleşme, otomatik yenileme",
        "Aylık 15.000 EUR",
      ],
      industry: "Danışmanlık",
      dealType: "Hizmet Sözleşmesi",
    },
    selectedAgents: ["legal-counsel", "finance-director"],
    expectations: {
      minFindings: 3,
      minAgentsWithFindings: 2,
      expectClauseRefs: true,
      minRevisions: 1,
      expectDisagreements: false, // only 2 agents
      minCorrections: 1,
      hasDocumentContent: true,
    },
  };
}

// --- Public API ---

export function getEvalCases(): EvalCase[] {
  const cases: EvalCase[] = [];

  // Scenario-based cases
  for (const id of ["distributor", "saas-master", "consulting"]) {
    const evalCase = buildScenarioCase(id);
    if (evalCase) cases.push(evalCase);
  }

  // Synthetic upload case
  cases.push(buildSyntheticUploadCase());

  return cases;
}

export function getEvalCase(id: string): EvalCase | undefined {
  return getEvalCases().find((c) => c.id === id);
}
