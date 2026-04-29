import { describe, it, expect } from "vitest";
import {
  turkishUpper,
  expandCompanyName,
  companyNameSimilarity,
  digitsOnly,
  normalizeAddress,
} from "../normalize";

describe("turkishUpper", () => {
  it("upcases Turkish-specific letters correctly", () => {
    expect(turkishUpper("ithalat")).toBe("İTHALAT");
    expect(turkishUpper("şirket")).toBe("ŞİRKET");
    expect(turkishUpper("güzel")).toBe("GÜZEL");
    expect(turkishUpper("ığıl")).toBe("IĞIL");
  });

  it("preserves already-upper Turkish letters", () => {
    expect(turkishUpper("İSTANBUL")).toBe("İSTANBUL");
  });
});

describe("expandCompanyName", () => {
  it("expands A.Ş. to ANONİM ŞİRKETİ", () => {
    expect(expandCompanyName("Acme A.Ş.")).toBe("ACME ANONİM ŞİRKETİ");
    expect(expandCompanyName("Acme A. Ş.")).toBe("ACME ANONİM ŞİRKETİ");
    expect(expandCompanyName("Acme AŞ")).toBe("ACME ANONİM ŞİRKETİ");
  });

  it("expands LTD.ŞTİ. variants to LİMİTED ŞİRKETİ", () => {
    expect(expandCompanyName("Acme Ltd.Şti.")).toBe("ACME LİMİTED ŞİRKETİ");
    expect(expandCompanyName("Acme LTD ŞTİ")).toBe("ACME LİMİTED ŞİRKETİ");
  });

  it("expands İTH and İHR abbreviations", () => {
    expect(expandCompanyName("TURKISHCARE İTH.İHR.A.Ş.")).toBe(
      "TURKISHCARE İTHALAT İHRACAT ANONİM ŞİRKETİ",
    );
  });

  it("matches the canonical sirkü form after expansion", () => {
    const stamp = expandCompanyName("TURKISHCARE İTH.İHR.A.Ş.");
    const sirku = expandCompanyName("TURKISHCARE İTHALAT İHRACAT ANONİM ŞİRKETİ");
    expect(stamp).toBe(sirku);
  });

  it("collapses whitespace and trims", () => {
    expect(expandCompanyName("  Acme   Ltd.   Şti.  ")).toBe(
      "ACME LİMİTED ŞİRKETİ",
    );
  });

  it("matches Latin-I stamp prints (ITH/IHR/AS) to Turkish forms", () => {
    // Real-world artifact: low-resolution stamp prints render diacritics
    // as plain ASCII, so the petition text says ITH where the registry
    // says İTH. Both should resolve to the same canonical expansion.
    expect(expandCompanyName("TURKISHCARE ITH IHR A S")).toBe(
      "TURKISHCARE İTHALAT İHRACAT ANONİM ŞİRKETİ",
    );
  });
});

describe("companyNameSimilarity", () => {
  it("returns 1 when expansions match", () => {
    const score = companyNameSimilarity(
      "TURKISHCARE İTH.İHR.A.Ş.",
      "TURKISHCARE İTHALAT İHRACAT ANONİM ŞİRKETİ",
    );
    expect(score).toBe(1);
  });

  it("returns 0 for empty inputs", () => {
    expect(companyNameSimilarity("", "ACME A.Ş.")).toBe(0);
    expect(companyNameSimilarity("ACME A.Ş.", "")).toBe(0);
  });

  it("scales with overlap proportion", () => {
    // Both expand to 4 tokens; share 3 (ACME, ANONİM, ŞİRKETİ); 1 distinct each.
    // Max set size = 4, overlap = 3 → 0.75
    const score = companyNameSimilarity("ACME GIDA A.Ş.", "ACME OTOMOTİV A.Ş.");
    expect(score).toBeCloseTo(0.75, 2);
  });

  it("rejects unrelated names with only generic suffixes shared", () => {
    // Only ANONİM + ŞİRKETİ would overlap → 2/3 vs 2/3 → still moderate.
    // The non-generic tokens differ, so similarity should be well below 0.85.
    const score = companyNameSimilarity("TURKISHCARE A.Ş.", "OTHERCORP A.Ş.");
    expect(score).toBeLessThan(0.85);
  });

  it("treats identical names as 1.0 regardless of casing", () => {
    expect(companyNameSimilarity("turkishcare a.ş.", "TURKISHCARE A.Ş.")).toBe(1);
  });
});

describe("digitsOnly", () => {
  it("strips spaces and punctuation from tax-style numbers", () => {
    expect(digitsOnly("871 121 8985")).toBe("8711218985");
    expect(digitsOnly("V.D: 871-121-8985")).toBe("8711218985");
  });

  it("returns empty string for null/undefined", () => {
    expect(digitsOnly(null)).toBe("");
    expect(digitsOnly(undefined)).toBe("");
  });
});

describe("normalizeAddress", () => {
  it("normalizes whitespace and punctuation", () => {
    expect(normalizeAddress("Çakmak Mah. Selvi Cad. No:29 A")).toBe(
      "ÇAKMAK MAH SELVİ CAD NO 29 A",
    );
  });

  it("returns empty string for falsy input", () => {
    expect(normalizeAddress(null)).toBe("");
    expect(normalizeAddress("")).toBe("");
  });
});
