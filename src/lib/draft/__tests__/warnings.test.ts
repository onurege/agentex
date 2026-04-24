import { describe, expect, it } from "vitest";
import { NDA_TEMPLATE } from "../templates/nda";
import { DISTRIBUTOR_TEMPLATE } from "../templates/distributor";
import { evaluateWarnings } from "../warnings";

describe("evaluateWarnings", () => {
  it("returns no warnings for empty answers", () => {
    expect(evaluateWarnings(NDA_TEMPLATE, {})).toEqual([]);
  });

  it("triggers NDA one_way warning when ndaType is one_way", () => {
    const result = evaluateWarnings(NDA_TEMPLATE, { ndaType: "one_way" });
    expect(result.some((w) => w.id === "one_way_two_way_data")).toBe(true);
  });

  it("does not trigger NDA one_way warning for mutual", () => {
    const result = evaluateWarnings(NDA_TEMPLATE, { ndaType: "mutual" });
    expect(result.some((w) => w.id === "one_way_two_way_data")).toBe(false);
  });

  it("triggers personal_data warning when scope includes personal_data (anyOf + array)", () => {
    const result = evaluateWarnings(NDA_TEMPLATE, {
      confidentialScope: ["technical", "personal_data"],
    });
    expect(result.some((w) => w.id === "personal_data_kvkk")).toBe(true);
  });

  it("triggers distributor mutual_exclusivity warning on mutual", () => {
    const result = evaluateWarnings(DISTRIBUTOR_TEMPLATE, {
      exclusivity: "mutual",
    });
    expect(result.some((w) => w.id === "mutual_exclusivity")).toBe(true);
  });

  it("triggers portfolio_compensation warning when excludePortfolioCompensation=false", () => {
    const result = evaluateWarnings(DISTRIBUTOR_TEMPLATE, {
      excludePortfolioCompensation: false,
    });
    expect(result.some((w) => w.id === "portfolio_compensation")).toBe(true);
  });
});
