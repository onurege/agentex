import { describe, expect, it } from "vitest";
import { NDA_TEMPLATE } from "../templates/nda";
import {
  formatAnswer,
  isClauseEnabled,
  renderDraft,
  resolveTemplate,
} from "../renderer";
import type { DraftSession } from "../types";

function buildSession(
  answers: Record<string, unknown> = {},
  overrides: Partial<DraftSession> = {},
): DraftSession {
  return {
    id: "drf_test",
    templateId: "nda",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "draft",
    answers,
    aiAccepted: {},
    disabledClauses: [],
    ...overrides,
  };
}

describe("resolveTemplate", () => {
  it("replaces simple {{var}} placeholders", () => {
    const session = buildSession({
      "partyA.name": "Univera A.Ş.",
      "partyA.type": "individual",
    });
    const out = resolveTemplate("Satıcı: {{partyA.name}}", session, NDA_TEMPLATE);
    expect(out).toBe("Satıcı: Univera A.Ş.");
  });

  it("marks missing scalars with a [ label ] placeholder", () => {
    const session = buildSession({});
    const out = resolveTemplate("Adres: {{partyA.address}}", session, NDA_TEMPLATE);
    expect(out).toMatch(/\[ .* \]/);
  });

  it("includes {{#if path}} block only when truthy", () => {
    const tmpl = "before {{#if hasPenalty}}INSIDE{{/if}} after";
    expect(resolveTemplate(tmpl, buildSession({ hasPenalty: true }), NDA_TEMPLATE)).toContain("INSIDE");
    expect(resolveTemplate(tmpl, buildSession({ hasPenalty: false }), NDA_TEMPLATE)).not.toContain("INSIDE");
    expect(resolveTemplate(tmpl, buildSession({}), NDA_TEMPLATE)).not.toContain("INSIDE");
  });

  it("includes {{#if path=value}} block only when exact match", () => {
    const tmpl = "{{#if ndaType=mutual}}M{{/if}}{{#if ndaType=one_way}}O{{/if}}";
    expect(resolveTemplate(tmpl, buildSession({ ndaType: "mutual" }), NDA_TEMPLATE)).toBe("M");
    expect(resolveTemplate(tmpl, buildSession({ ndaType: "one_way" }), NDA_TEMPLATE)).toBe("O");
    expect(resolveTemplate(tmpl, buildSession({}), NDA_TEMPLATE)).toBe("");
  });
});

describe("formatAnswer", () => {
  it("joins multiCheckbox labels", () => {
    const out = formatAnswer(NDA_TEMPLATE, "confidentialScope", ["technical", "commercial"]);
    expect(out).toMatch(/Teknik/);
    expect(out).toMatch(/Ticari/);
  });

  it("resolves radioGroup value to option label", () => {
    const out = formatAnswer(NDA_TEMPLATE, "ndaType", "mutual");
    expect(out).toMatch(/Karşılıklı/);
  });

  it("renders currency with tr-TR formatting + TL suffix", () => {
    const out = formatAnswer(NDA_TEMPLATE, "penaltyAmount", 150000);
    expect(out).toContain("TL");
    expect(out).toMatch(/150[.,]000/);
  });

  it("renders date as long Turkish format", () => {
    const out = formatAnswer(NDA_TEMPLATE, "effectiveDate", "2026-03-15");
    expect(out).toMatch(/2026/);
  });

  it("formats company names as uppercase by default", () => {
    const out = formatAnswer(NDA_TEMPLATE, "partyA.name", "Univera A.Ş.", {
      "partyA.type": "company",
    });
    expect(out).toBe("UNİVERA A.Ş.");
  });

  it("formats company names as lowercase bold when selected", () => {
    const out = formatAnswer(NDA_TEMPLATE, "partyA.name", "Univera A.Ş.", {
      "partyA.type": "company",
      "partyA.nameStyle": "lowercase_bold",
    });
    expect(out).toBe("**univera a.ş.**");
  });
});

describe("isClauseEnabled", () => {
  const penaltyClause = NDA_TEMPLATE.clauses.find((c) => c.id === "penalty")!;
  const kvkkClause = NDA_TEMPLATE.clauses.find((c) => c.id === "kvkk")!;
  const partiesClause = NDA_TEMPLATE.clauses.find((c) => c.id === "parties")!;

  it("required clause is always enabled", () => {
    expect(isClauseEnabled(partiesClause, buildSession({}), NDA_TEMPLATE)).toBe(true);
  });

  it("kvkk (defaultEnabled=true) is on unless user disables", () => {
    expect(isClauseEnabled(kvkkClause, buildSession({}), NDA_TEMPLATE)).toBe(true);
    expect(
      isClauseEnabled(
        kvkkClause,
        buildSession({}, { disabledClauses: ["kvkk"] }),
        NDA_TEMPLATE,
      ),
    ).toBe(false);
  });

  it("penalty clause is gated by hasPenalty boolean", () => {
    expect(isClauseEnabled(penaltyClause, buildSession({}), NDA_TEMPLATE)).toBe(false);
    expect(
      isClauseEnabled(penaltyClause, buildSession({ hasPenalty: true }), NDA_TEMPLATE),
    ).toBe(true);
  });
});

describe("renderDraft", () => {
  it("produces sequentially numbered clauses (Madde 1, 2, …)", () => {
    const session = buildSession({
      "partyA.name": "Alfa Ltd.",
      "partyA.address": "Kadıköy",
      "partyA.representative": "Ali Yılmaz",
      "partyB.name": "Beta Ltd.",
      "partyB.address": "Üsküdar",
      "partyB.representative": "Ayşe Kaya",
      effectiveDate: "2026-04-01",
      ndaType: "mutual",
      confidentialScope: ["technical"],
      purposeDescription: "ortak proje değerlendirmesi",
      durationYears: 3,
      jurisdictionCity: "İstanbul",
    });
    const { clauses } = renderDraft(NDA_TEMPLATE, session);
    expect(clauses.length).toBeGreaterThan(0);
    clauses.forEach((c, i) => {
      expect(c.number).toBe(`Madde ${i + 1}`);
    });
  });

  it("reports missing answers per clause", () => {
    const session = buildSession({ ndaType: "mutual" });
    const { missingByClause } = renderDraft(NDA_TEMPLATE, session);
    expect(Object.keys(missingByClause).length).toBeGreaterThan(0);
    // Parties clause expects both names + addresses + reps + effectiveDate
    expect(missingByClause.parties).toContain("partyA.name");
  });

  it("honors aiAccepted override in place of the template body", () => {
    const session = buildSession(
      {
        "partyA.name": "Alfa",
        "partyA.address": "X",
        "partyA.representative": "A",
        "partyB.name": "Beta",
        "partyB.address": "Y",
        "partyB.representative": "B",
        effectiveDate: "2026-04-01",
      },
      { aiAccepted: { parties: "CUSTOM PARTIES TEXT" } },
    );
    const { clauses } = renderDraft(NDA_TEMPLATE, session);
    const parties = clauses.find((c) => c.clauseId === "parties");
    expect(parties?.body).toBe("CUSTOM PARTIES TEXT");
  });

  it("excludes disabled optional clauses", () => {
    const session = buildSession({}, { disabledClauses: ["kvkk"] });
    const { clauses } = renderDraft(NDA_TEMPLATE, session);
    expect(clauses.find((c) => c.clauseId === "kvkk")).toBeUndefined();
  });
});
