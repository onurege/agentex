import { describe, expect, it } from "vitest";
import { DISTRIBUTOR_TEMPLATE } from "../distributor";
import { validateTemplate } from "../validate";

describe("Distributor template", () => {
  it("passes structural validation with no errors", () => {
    const issues = validateTemplate(DISTRIBUTOR_TEMPLATE);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("has 20+ required clauses", () => {
    expect(DISTRIBUTOR_TEMPLATE.clauses.length).toBeGreaterThanOrEqual(20);
  });

  it("has an exclusivity question with three options", () => {
    const q = DISTRIBUTOR_TEMPLATE.questions.find(
      (q) => q.id === "exclusivity",
    );
    expect(q).toBeDefined();
    expect(q?.options?.length).toBe(3);
  });

  it("has a non-compete duration dependent on hasNonCompete", () => {
    const q = DISTRIBUTOR_TEMPLATE.questions.find(
      (q) => q.id === "nonCompeteDuration",
    );
    expect(q?.dependsOn?.questionId).toBe("hasNonCompete");
  });

  it("has a portfolio-exclusion warning when excludePortfolioCompensation is off", () => {
    const w = DISTRIBUTOR_TEMPLATE.warnings.find(
      (w) => w.id === "portfolio_compensation",
    );
    expect(w?.shownWhen.equals).toBe(false);
  });
});
