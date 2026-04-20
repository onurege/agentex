import { describe, expect, it } from "vitest";
import { matchClause, locatePhrase } from "../clause-matcher";

describe("matchClause — anchor layer", () => {
  it("matches 'Madde X.Y' to a paragraph starting with the same anchor", () => {
    const paragraphs = [
      { id: "p1", text: "Madde 1 Taraflar" },
      { id: "p2", text: "Madde 4.2 Gizlilik Yükümlülüğü. Taraflar..." },
      { id: "p3", text: "Madde 5 Süre" },
    ];
    const result = matchClause("Madde 4.2", paragraphs);
    expect(result).toEqual({ kind: "anchor", paragraphId: "p2" });
  });

  it("matches 'Article X.Y' anchor format", () => {
    const paragraphs = [{ id: "p1", text: "Article 4.2 Confidentiality" }];
    const result = matchClause("Article 4.2", paragraphs);
    expect(result).toEqual({ kind: "anchor", paragraphId: "p1" });
  });

  it("matches § anchor format", () => {
    const paragraphs = [{ id: "p1", text: "§4.2 Confidentiality" }];
    const result = matchClause("§4.2", paragraphs);
    expect(result).toEqual({ kind: "anchor", paragraphId: "p1" });
  });

  it("is case-insensitive on the anchor prefix only (Madde vs MADDE)", () => {
    const paragraphs = [{ id: "p1", text: "MADDE 4.2 Gizlilik" }];
    const result = matchClause("Madde 4.2", paragraphs);
    expect(result).toEqual({ kind: "anchor", paragraphId: "p1" });
  });
});

describe("matchClause — prefix layer", () => {
  it("matches clauseRef by title when no anchor is present", () => {
    const paragraphs = [
      { id: "p1", text: "Gizlilik Yükümlülüğü. Taraflar ticari sırları..." },
    ];
    const result = matchClause("Gizlilik Yükümlülüğü", paragraphs);
    expect(result).toEqual({ kind: "prefix", paragraphId: "p1" });
  });

  it("normalizes whitespace in prefix matching", () => {
    const paragraphs = [
      { id: "p1", text: "Gizlilik  Yükümlülüğü.  Taraflar..." },
    ];
    const result = matchClause("Gizlilik Yükümlülüğü", paragraphs);
    expect(result).toEqual({ kind: "prefix", paragraphId: "p1" });
  });
});

describe("matchClause — orphan", () => {
  it("returns orphan when no paragraph matches anchor or prefix", () => {
    const paragraphs = [
      { id: "p1", text: "Madde 1 Taraflar" },
      { id: "p2", text: "Madde 5 Süre" },
    ];
    const result = matchClause("Madde 99.9", paragraphs);
    expect(result).toEqual({ kind: "orphan" });
  });

  it("returns orphan for free-form references with no matching title", () => {
    const paragraphs = [{ id: "p1", text: "Gizlilik Yükümlülüğü" }];
    const result = matchClause("sözleşmenin sonlandırılması", paragraphs);
    expect(result).toEqual({ kind: "orphan" });
  });
});

describe("locatePhrase", () => {
  it("finds exact substring match", () => {
    const range = locatePhrase("beş iş günü içinde bildirim", "beş iş günü");
    expect(range).toEqual({ start: 0, end: 11 });
  });

  it("returns null when phrase is absent and nothing close enough", () => {
    const range = locatePhrase(
      "beş iş günü içinde bildirim",
      "otuz takvim günü",
    );
    expect(range).toBeNull();
  });

  it("matches across curly-quote differences via normalized fallback", () => {
    const paragraph = "The party shall give \u201Cwritten notice\u201D.";
    const range = locatePhrase(paragraph, '"written notice"');
    // exact fails (curly vs straight); normalized should hit
    expect(range).not.toBeNull();
    if (range) {
      expect(paragraph.slice(range.start, range.end)).toContain("written notice");
    }
  });
});
