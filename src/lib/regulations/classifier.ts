// Topic classifier for raw regulation candidates. Pure-text keyword
// matching against the taxonomy in topics.ts; an item that matches
// no topic is dropped at the orchestrator level (Param-irrelevant).
//
// Priority follows the highest-ranked matched topic: critical wins
// over high wins over medium wins over low. UI rendering uses the
// resolved priority directly for badge colour and the default sort
// order in the feed.

import { REGULATION_TOPICS } from "./topics";
import type { RegulationPriority } from "./types";

const PRIORITY_RANK: Record<RegulationPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export interface ClassifyResult {
  topics: string[];
  priority: RegulationPriority;
}

/**
 * Returns the matched topic ids and the resolved priority for a given
 * raw text blob (typically `${title}\n${summary}\n${bodyExcerpt}`).
 *
 * Empty topic list means "no Param-relevant signal found"; callers are
 * expected to drop such items rather than persist them with priority
 * "low" — the schema marks every row as Param-relevant by virtue of
 * being stored.
 */
export function classifyText(rawText: string): ClassifyResult {
  if (!rawText || !rawText.trim()) {
    return { topics: [], priority: "low" };
  }
  const haystack = rawText.toLocaleLowerCase("tr-TR");

  const matched: { id: string; priority: RegulationPriority }[] = [];
  for (const topic of REGULATION_TOPICS) {
    const hit = topic.keywords.some((kw) => haystack.includes(kw));
    if (hit) {
      matched.push({ id: topic.id, priority: topic.priority });
    }
  }

  if (matched.length === 0) {
    return { topics: [], priority: "low" };
  }

  let topPriority: RegulationPriority = "low";
  for (const m of matched) {
    if (PRIORITY_RANK[m.priority] > PRIORITY_RANK[topPriority]) {
      topPriority = m.priority;
    }
  }

  return {
    topics: matched.map((m) => m.id),
    priority: topPriority,
  };
}
