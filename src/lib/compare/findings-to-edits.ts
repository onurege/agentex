// ============================================================
// Compare Module — Findings → ArbitratedEdits
// ============================================================
//
// Translates the compare module's CompareFinding[] into the shape
// the Faz 4 redline renderer (src/lib/redline) consumes. This lets
// us export a redline DOCX without duplicating XML mutation logic.
//
// Mapping decisions:
//   - cosmetic findings are skipped — biçim düzeltmeleri redline'a
//     girdiğinde gürültü yaratır; sözleşme revizyonu amaçlı değildir.
//   - added  → insert_after (anchor = the new clause's own ref; if
//     that ref doesn't exist in v1 the renderer orphans gracefully).
//   - removed → delete_clause.
//   - reworded / numeric_change / material → replace_clause.
//   - resolution is stamped "accepted_a" so the renderer applies it
//     (the renderer skips "orphan_unmatched" / "rejected_all").
// ============================================================

import type {
  ArbitratedEdit,
  EditSeverity,
  EditType,
} from "@/lib/redline/types";
import type { CompareFinding, CompareRiskLevel } from "./types";

function mapSeverity(risk: CompareRiskLevel): EditSeverity {
  if (risk === "high") return "critical";
  if (risk === "medium") return "warning";
  return "info";
}

export interface FindingsToEditsResult {
  edits: ArbitratedEdit[];
  /** Findings deliberately skipped (e.g. cosmetic). */
  skippedCount: number;
}

export function findingsToEdits(
  findings: CompareFinding[],
): FindingsToEditsResult {
  const edits: ArbitratedEdit[] = [];
  let skipped = 0;

  for (const f of findings) {
    if (f.type === "cosmetic") {
      skipped++;
      continue;
    }

    let editType: EditType;
    let finalText: string;

    if (f.v1Text && !f.v2Text) {
      editType = "delete_clause";
      finalText = "";
    } else if (!f.v1Text && f.v2Text) {
      editType = "insert_after";
      finalText = f.v2Text;
    } else if (f.v1Text && f.v2Text) {
      editType = "replace_clause";
      finalText = f.v2Text;
    } else {
      skipped++;
      continue;
    }

    edits.push({
      id: f.id,
      clauseRef: f.clauseRef,
      editType,
      finalText,
      sourceProposals: [],
      arbitrationNote: f.summary,
      resolution: "accepted_a",
      finalSeverity: mapSeverity(f.riskLevel),
    });
  }

  return { edits, skippedCount: skipped };
}
