// ============================================================
// Scenario Registry — declarative demo scenario data
// ============================================================
//
// Scenarios are pure data objects with no logic.
// They represent pre-seeded contract review examples.
// In a real AI integration, scenarios would be replaced by
// actual document analysis from the AnalysisEngine.
// ============================================================

import type { DemoScenario } from "../types";
import { DISTRIBUTOR_SCENARIO } from "./distributor";
import { SAAS_MASTER_SCENARIO } from "./saas-master";
import { CONSULTING_SCENARIO } from "./consulting";

/** All available demo scenarios */
export const DEMO_SCENARIOS: DemoScenario[] = [
  DISTRIBUTOR_SCENARIO,
  SAAS_MASTER_SCENARIO,
  CONSULTING_SCENARIO,
];

/** Look up a scenario by ID */
export function getScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}

// Re-export individual scenarios for direct access
export { DISTRIBUTOR_SCENARIO } from "./distributor";
export { SAAS_MASTER_SCENARIO } from "./saas-master";
export { CONSULTING_SCENARIO } from "./consulting";
