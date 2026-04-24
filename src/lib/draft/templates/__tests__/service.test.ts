import { describe, expect, it } from "vitest";
import { SERVICE_TEMPLATE } from "../service";
import { validateTemplate } from "../validate";

describe("Service template", () => {
  it("passes structural validation with no errors", () => {
    const issues = validateTemplate(SERVICE_TEMPLATE);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("has a workType question with eser + vekâlet options", () => {
    const q = SERVICE_TEMPLATE.questions.find((q) => q.id === "workType");
    expect(q?.options?.map((o) => o.value).sort()).toEqual(["mandate", "work"]);
  });

  it("warranty is gated by workType=work", () => {
    const q = SERVICE_TEMPLATE.questions.find(
      (q) => q.id === "warrantyMonths",
    );
    expect(q?.dependsOn?.questionId).toBe("workType");
    expect(q?.dependsOn?.equals).toBe("work");
  });

  it("ip handling clause has all three variants resolvable", () => {
    const clause = SERVICE_TEMPLATE.clauses.find((c) => c.id === "ip_rights");
    expect(clause?.template).toMatch(/ipHandling=transfer/);
    expect(clause?.template).toMatch(/ipHandling=exclusive_license/);
    expect(clause?.template).toMatch(/ipHandling=non_exclusive_license/);
  });

  it("independent contractor declaration is required", () => {
    const clause = SERVICE_TEMPLATE.clauses.find(
      (c) => c.id === "independent_contractor",
    );
    expect(clause?.required).toBe(true);
  });
});
