// ============================================================
// Dashboard Metrics — Computed from run history + control room
// ============================================================

import { getBoardroomRuns, type BoardroomRunSnapshot } from "./run-history";
import { useControlRoomStore } from "./control-room-store";
import { BOARDROOM_AGENTS } from "./boardroom-agents";

export interface DashboardMetrics {
  totalRuns: number;
  customizedAgents: number;
  publishedPrompts: number;
  lastRunDate: string | null;
  aiRuns: number;
  fallbackRuns: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

export function getDashboardMetrics(): DashboardMetrics {
  const runs = getBoardroomRuns();
  const profiles = useControlRoomStore.getState().profiles;

  // Count customized agents
  const allAgentIds = ["chief-agent", ...BOARDROOM_AGENTS.map((a) => a.id)];
  let customizedAgents = 0;
  let publishedPrompts = 0;

  for (const id of allAgentIds) {
    const p = profiles[id];
    if (p?.cvPublished) customizedAgents++;
    if (p?.promptPublished) publishedPrompts++;
  }

  // Compute run stats
  let aiRuns = 0;
  let fallbackRuns = 0;
  let highConf = 0;
  let medConf = 0;
  let lowConf = 0;

  for (const run of runs) {
    if (run.analysisMode === "ai" || run.analysisMode === "ai-partial") aiRuns++;
    else fallbackRuns++;

    const conf = run.verdictSeed?.confidenceLevel;
    if (conf === "high") highConf++;
    else if (conf === "low") lowConf++;
    else medConf++;
  }

  return {
    totalRuns: runs.length,
    customizedAgents,
    publishedPrompts,
    lastRunDate: runs.length > 0 ? runs[0].createdAt : null,
    aiRuns,
    fallbackRuns,
    highConfidence: highConf,
    mediumConfidence: medConf,
    lowConfidence: lowConf,
  };
}

export function getFilteredRuns(params: {
  search?: string;
  analysisMode?: string;
  riskLevel?: string;
  confidenceLevel?: string;
}): BoardroomRunSnapshot[] {
  let runs = getBoardroomRuns();

  if (params.search) {
    const q = params.search.toLowerCase();
    runs = runs.filter((r) => r.documentName.toLowerCase().includes(q));
  }

  if (params.analysisMode && params.analysisMode !== "all") {
    runs = runs.filter((r) => (r.analysisMode ?? "fallback") === params.analysisMode);
  }

  if (params.riskLevel && params.riskLevel !== "all") {
    runs = runs.filter((r) => r.verdictSeed.riskLevel === params.riskLevel);
  }

  if (params.confidenceLevel && params.confidenceLevel !== "all") {
    runs = runs.filter((r) => (r.verdictSeed as any).confidenceLevel === params.confidenceLevel);
  }

  return runs;
}
