import { describe, expect, it } from "vitest";
import { NDA_TEMPLATE } from "../nda";
import { validateTemplate } from "../validate";

describe("NDA template", () => {
  it("passes structural validation with no errors", () => {
    const issues = validateTemplate(NDA_TEMPLATE);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("has at least one required clause", () => {
    const required = NDA_TEMPLATE.clauses.filter((c) => c.required);
    expect(required.length).toBeGreaterThan(0);
  });

  it("has unique question ids and clause ids", () => {
    const qIds = new Set(NDA_TEMPLATE.questions.map((q) => q.id));
    expect(qIds.size).toBe(NDA_TEMPLATE.questions.length);

    const cIds = new Set(NDA_TEMPLATE.clauses.map((c) => c.id));
    expect(cIds.size).toBe(NDA_TEMPLATE.clauses.length);
  });

  it("covers every conditional clause with a dependsOn or hasX flag", () => {
    // Non-required clauses must map to at least one "hasXxx" gate.
    const optional = NDA_TEMPLATE.clauses.filter((c) => !c.required);
    for (const clause of optional) {
      // KVKK stays opt-out (defaultEnabled true, no gate), others need a gate
      if (clause.id === "kvkk" || clause.id === "reverse_engineering") continue;
      expect(clause.requires.length).toBeGreaterThan(0);
    }
  });
});
