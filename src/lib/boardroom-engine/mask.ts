// ============================================================
// Mask Mappings — Sensitive Field Redaction
// ============================================================
//
// Lets the user replace sensitive strings (company names, tax IDs,
// person names) with neutral placeholders before the document goes to
// Gemini, then restore the originals on every string in the result.
//
// Alias format is fixed to [[MASK_N]] so it cannot collide with any
// natural text in the document (chosen via T-2 design decision A).
//
// Mapping is applied at the client/edge — the server never sees the
// original values for masked fields.
// ============================================================

import type { BoardroomAnalysisResult } from "./types";

export interface MaskMapping {
  /** The literal string in the user's document. */
  original: string;
  /** Auto-assigned alias of the form [[MASK_N]]. */
  alias: string;
}

/** Build a placeholder alias for the Nth mapping (1-indexed). */
export function buildAlias(index: number): string {
  return `[[MASK_${index}]]`;
}

/**
 * Sort mappings so that longer originals are replaced first. Without
 * this, "Univera" inside "Univera Bilgi" would mask before the longer
 * variant gets a chance and split the substring across two aliases.
 */
function sortMaskingOrder(mappings: MaskMapping[]): MaskMapping[] {
  return [...mappings].sort((a, b) => b.original.length - a.original.length);
}

/** Apply mask: original → alias. */
export function applyMask(text: string, mappings: MaskMapping[]): string {
  if (!text || mappings.length === 0) return text;
  let out = text;
  for (const m of sortMaskingOrder(mappings)) {
    if (!m.original) continue;
    out = out.split(m.original).join(m.alias);
  }
  return out;
}

/** Reverse mask: alias → original. */
export function reverseMask(text: string, mappings: MaskMapping[]): string {
  if (!text || mappings.length === 0) return text;
  let out = text;
  for (const m of mappings) {
    if (!m.alias) continue;
    out = out.split(m.alias).join(m.original);
  }
  return out;
}

/**
 * Walk a BoardroomAnalysisResult and reverse the mask on every string
 * field that the user will eventually read. Edit proposals and
 * arbitrated edits are the load-bearing ones for the redline pipeline.
 */
export function reverseMaskInResult(
  result: BoardroomAnalysisResult,
  mappings: MaskMapping[],
): BoardroomAnalysisResult {
  if (mappings.length === 0) return result;
  const r = (s: string): string => reverseMask(s, mappings);
  const rOpt = (s: string | undefined): string | undefined =>
    s === undefined ? undefined : reverseMask(s, mappings);

  return {
    ...result,
    observations: result.observations.map((o) => ({
      ...o,
      message: r(o.message),
      topic: r(o.topic),
    })),
    objections: result.objections.map((o) => ({
      ...o,
      message: r(o.message),
      topic: r(o.topic),
    })),
    disagreements: result.disagreements.map((d) => ({
      ...d,
      topic: r(d.topic),
      agentAPosition: r(d.agentAPosition),
      agentBPosition: r(d.agentBPosition),
    })),
    chiefSynthesis: r(result.chiefSynthesis),
    rebuttals: result.rebuttals.map((rb) => ({
      ...rb,
      topic: r(rb.topic),
      message: r(rb.message),
    })),
    verdict: {
      ...result.verdict,
      summary: r(result.verdict.summary),
      decisions: result.verdict.decisions.map(r),
      actionItems: result.verdict.actionItems.map(r),
      agentPerspectives: result.verdict.agentPerspectives.map((p) => ({
        ...p,
        position: r(p.position),
      })),
    },
    arbitratedEdits: (result.arbitratedEdits ?? []).map((e) => ({
      ...e,
      clauseRef: r(e.clauseRef),
      originalText: rOpt(e.originalText),
      finalText: r(e.finalText),
      arbitrationNote: r(e.arbitrationNote),
    })),
    pipeline: {
      ...result.pipeline,
      agentResults: result.pipeline.agentResults.map((ar) => ({
        ...ar,
        keyConcern: r(ar.keyConcern),
        suggestedAction: r(ar.suggestedAction),
        overallPosition: r(ar.overallPosition),
        observations: ar.observations.map((o) => ({
          ...o,
          message: r(o.message),
          topic: r(o.topic),
          sectionRef: rOpt(o.sectionRef),
        })),
        editProposals: ar.editProposals.map((p) => ({
          ...p,
          clauseRef: r(p.clauseRef),
          originalText: rOpt(p.originalText),
          proposedText: r(p.proposedText),
          rationale: r(p.rationale),
        })),
      })),
    },
  };
}
