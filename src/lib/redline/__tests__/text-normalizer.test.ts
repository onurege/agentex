import { describe, expect, it } from "vitest";
import { normalizeForMatch } from "../text-normalizer";

describe("normalizeForMatch", () => {
  it("collapses runs of whitespace to a single space", () => {
    expect(normalizeForMatch("a    b")).toBe("a b");
  });

  it("preserves case", () => {
    expect(normalizeForMatch("Madde 4.2")).toBe("Madde 4.2");
  });

  it("straightens curly double quotes", () => {
    expect(normalizeForMatch("\u201Chello\u201D")).toBe('"hello"');
  });

  it("straightens curly single quotes", () => {
    expect(normalizeForMatch("it\u2019s")).toBe("it's");
  });

  it("converts non-breaking space to normal space", () => {
    expect(normalizeForMatch("a\u00A0b")).toBe("a b");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeForMatch("  hello  ")).toBe("hello");
  });

  it("handles mixed whitespace including tabs and newlines", () => {
    expect(normalizeForMatch("line1\n\tline2")).toBe("line1 line2");
  });

  it("handles a clean input unchanged", () => {
    expect(normalizeForMatch("Gizlilik Yükümlülüğü")).toBe(
      "Gizlilik Yükümlülüğü",
    );
  });
});
