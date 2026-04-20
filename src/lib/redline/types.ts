// ============================================================
// Redline Types
// ============================================================
//
// Shared types for the Faz 4 edit-proposal → arbitration → redline
// pipeline. Referenced by:
//   - boardroom-engine/agent-pass.ts (extended output)
//   - boardroom-engine/chief-pass.ts (arbitration output)
//   - src/lib/redline/* (renderer, matcher)
//   - API routes + DB persistence
// ============================================================

export type EditType =
  | "replace_clause"   // swap an entire paragraph/clause
  | "replace_phrase"   // swap a span inside a paragraph (needs originalText)
  | "insert_after"     // add a new paragraph after the referenced clause
  | "delete_clause";   // remove an entire paragraph/clause

export type EditSeverity = "critical" | "warning" | "info";

export interface EditProposal {
  /** Stable id per run; agent-generated or server-stamped. */
  id: string;
  agentId: string;
  /** "Madde 4.2", "Gizlilik Yükümlülüğü" — anchor for clause-matcher. */
  clauseRef: string;
  editType: EditType;
  /** Required for replace_phrase; ignored for other types. */
  originalText?: string;
  /** New text. Empty string for delete_clause. */
  proposedText: string;
  rationale: string;
  severity: EditSeverity;
}

export type ArbitrationResolution =
  | "accepted_a"
  | "accepted_b"
  | "merged"
  | "rewritten"
  | "rejected_all"
  | "orphan_unmatched";

export interface ArbitratedEdit {
  id: string;
  clauseRef: string;
  editType: EditType;
  originalText?: string;
  finalText: string;
  sourceProposals: string[]; // EditProposal IDs
  arbitrationNote: string;
  resolution: ArbitrationResolution;
  finalSeverity: EditSeverity;
}
