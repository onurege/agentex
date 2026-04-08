// ============================================================
// Analysis Engine Factory
// ============================================================
//
// Entry point for obtaining an AnalysisEngine instance.
//
// Provider selection via NEXT_PUBLIC_ANALYSIS_PROVIDER:
//   - "mock" (default) → MockAnalysisEngine
//   - "gemini"         → GeminiAnalysisEngine (hybrid: Gemini + mock fallback)
//
// The factory is the ONLY place that bridges scenario data into
// the engine. The engine itself is input-driven and never imports
// scenarios directly.
// ============================================================

import type { AnalysisEngine, AnalysisSeedData } from "./types";
import { MockAnalysisEngine } from "./mock-engine";
import { GeminiAnalysisEngine } from "./gemini/gemini-engine";
import type { DemoScenario } from "../types";
import { getScenario } from "../scenarios";

// --- Provider Detection ---

export type AnalysisProvider = "mock" | "gemini";

export function getAnalysisProvider(): AnalysisProvider {
  const env =
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_ANALYSIS_PROVIDER) ||
    "";
  const provider = env === "gemini" ? "gemini" : "mock";
  console.log(`[DEBUG] getAnalysisProvider — env="${env}", resolved="${provider}"`);
  return provider;
}

// --- Seed Data Extraction ---

/**
 * Extract AnalysisSeedData from a DemoScenario.
 * This is the bridge between scenario data and the engine's input model.
 */
export function extractSeedData(scenario: DemoScenario): AnalysisSeedData {
  return {
    chiefRecommendation: scenario.chiefRecommendation,
    findings: scenario.findings,
    correctionRequests: scenario.correctionRequests,
    disagreements: scenario.disagreements,
    revisionSuggestions: scenario.revisionSuggestions,
    contextLabel: scenario.shortName,
  };
}

// --- Factory ---

/**
 * Create an AnalysisEngine instance.
 *
 * @param options — either { scenarioId } to load seed data from a scenario,
 *                  or { seedData } to inject pre-built seed data directly.
 * @param provider — optional override; defaults to env-based detection.
 */
export function createAnalysisEngine(
  options: { scenarioId: string } | { seedData: AnalysisSeedData },
  provider?: AnalysisProvider,
): AnalysisEngine {
  const activeProvider = provider ?? getAnalysisProvider();

  console.log(`[DEBUG] createAnalysisEngine called — provider: ${activeProvider}, options: ${"scenarioId" in options ? `scenario=${options.scenarioId}` : "seedData"}`);

  let seed: AnalysisSeedData;

  if ("seedData" in options) {
    seed = options.seedData;
  } else {
    const scenario = getScenario(options.scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${options.scenarioId}`);
    }
    seed = extractSeedData(scenario);
  }

  if (activeProvider === "gemini") {
    console.log("[DEBUG] Instantiating GeminiAnalysisEngine");
    return new GeminiAnalysisEngine(seed);
  }

  console.log("[DEBUG] Instantiating MockAnalysisEngine");
  return new MockAnalysisEngine(seed);
}

// Re-export types for convenience
export type {
  AnalysisEngine,
  AnalysisSeedData,
  AnalysisInput,
  AnalysisOutput,
  RecommendationInput,
  SummaryInput,
  SummaryOutput,
  TimelineInput,
} from "./types";
