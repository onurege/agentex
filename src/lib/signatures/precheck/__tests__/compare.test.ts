import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractSirku, extractPetition } from "../extract";
import { comparePrecheck, computeOverallStatus } from "../compare";
import type {
  SirkuExtraction,
  PetitionExtraction,
  PrecheckCheck,
  PrecheckCheckId,
} from "../types";

function findCheck(checks: PrecheckCheck[], id: PrecheckCheckId): PrecheckCheck {
  const c = checks.find((x) => x.id === id);
  if (!c) throw new Error(`Check ${id} not found`);
  return c;
}

function makeSirku(overrides: Partial<SirkuExtraction> = {}): SirkuExtraction {
  return {
    companyName: "ACME ANONİM ŞİRKETİ",
    taxNumber: "1234567890",
    tradeRegistryNumber: "100000-1",
    mersisNumber: "1234567890123456",
    address: "Çakmak Mahallesi Selvi Cadde No: 1 Ümraniye İSTANBUL",
    representativeName: "AHMET YILMAZ",
    representativeIdNumber: "12345678901",
    authorityType: "münferiden",
    authorityStart: "2024-01-01",
    authorityDurationYears: 3,
    sirkuDate: "2024-01-15",
    rawText: "",
    ...overrides,
  };
}

function makePetition(
  overrides: Partial<PetitionExtraction> = {},
): PetitionExtraction {
  return {
    companyName: "ACME A.Ş.",
    taxNumber: "1234567890",
    tradeRegistryNumber: "100000-1",
    mersisNumber: "1234567890123456",
    address: "Çakmak Mahallesi Selvi Cadde No: 1 Ümraniye İSTANBUL",
    petitionDate: "2025-06-01",
    signatureCount: 1,
    rawText: "",
    ...overrides,
  };
}

describe("comparePrecheck — TURKISHCARE end-to-end fixture", () => {
  // The shipping motivator: this real document pair must produce a
  // failed status because the münferit yetki süresi expired four months
  // before the petition was issued.
  const sirku = extractSirku(
    readFileSync(
      join(__dirname, "fixtures/turkishcare-sirku.txt"),
      "utf-8",
    ),
  );
  const petition = extractPetition(
    readFileSync(
      join(__dirname, "fixtures/turkishcare-petition.txt"),
      "utf-8",
    ),
  );
  const checks = comparePrecheck(sirku, petition);
  const status = computeOverallStatus(checks);

  it("emits exactly six checks with stable ids", () => {
    expect(checks.map((c) => c.id)).toEqual([
      "company_identity",
      "company_name",
      "authority_type",
      "authority_duration",
      "address_match",
      "sirku_freshness",
    ]);
  });

  it("matches company identity by VKN", () => {
    expect(findCheck(checks, "company_identity").severity).toBe("ok");
  });

  it("flags company name as warning due to stamp abbreviation drift", () => {
    // ITH vs İTHALAT, IMR vs İHRACAT (OCR misread on stamp). Token-overlap
    // similarity sits in the [0.7, 0.85) band, which is the warning lane.
    expect(findCheck(checks, "company_name").severity).toBe("warning");
  });

  it("flags authority duration as critical (yetki süresi dolmuş)", () => {
    const c = findCheck(checks, "authority_duration");
    expect(c.severity).toBe("critical");
    expect(c.message).toMatch(/dolmuş|sonra/i);
  });

  it("emits address_match as warning (company has moved)", () => {
    expect(findCheck(checks, "address_match").severity).toBe("warning");
  });

  it("emits sirku_freshness as warning (>24 months apart)", () => {
    expect(findCheck(checks, "sirku_freshness").severity).toBe("warning");
  });

  it("computes overall status as failed", () => {
    expect(status).toBe("failed");
  });
});

describe("comparePrecheck — synthetic happy path", () => {
  const checks = comparePrecheck(makeSirku(), makePetition());
  const status = computeOverallStatus(checks);

  it("computes overall status as passed when every check is ok", () => {
    expect(status).toBe("passed");
    expect(checks.every((c) => c.severity === "ok")).toBe(true);
  });
});

describe("checkCompanyIdentity branches", () => {
  it("returns critical when VKNs differ", () => {
    const checks = comparePrecheck(
      makeSirku({ taxNumber: "1111111111" }),
      makePetition({ taxNumber: "9999999999" }),
    );
    expect(findCheck(checks, "company_identity").severity).toBe("critical");
  });

  it("returns warning when one side missing VKN", () => {
    const checks = comparePrecheck(
      makeSirku(),
      makePetition({ taxNumber: null }),
    );
    expect(findCheck(checks, "company_identity").severity).toBe("warning");
  });
});

describe("checkAuthorityType branches", () => {
  it("returns ok when müştereken sirkü meets petition signature count", () => {
    const checks = comparePrecheck(
      makeSirku({ authorityType: "müştereken" }),
      makePetition({ signatureCount: 2 }),
    );
    expect(findCheck(checks, "authority_type").severity).toBe("ok");
  });

  it("returns critical when müştereken sirkü has only one signature", () => {
    const checks = comparePrecheck(
      makeSirku({ authorityType: "müştereken" }),
      makePetition({ signatureCount: 1 }),
    );
    expect(findCheck(checks, "authority_type").severity).toBe("critical");
  });

  it("returns warning when authority type is belirsiz", () => {
    const checks = comparePrecheck(
      makeSirku({ authorityType: "belirsiz" }),
      makePetition(),
    );
    expect(findCheck(checks, "authority_type").severity).toBe("warning");
  });
});

describe("checkAuthorityDuration branches", () => {
  it("returns ok when petition date inside the authority window", () => {
    const checks = comparePrecheck(
      makeSirku({ authorityStart: "2024-01-01", authorityDurationYears: 3 }),
      makePetition({ petitionDate: "2025-06-01" }),
    );
    expect(findCheck(checks, "authority_duration").severity).toBe("ok");
  });

  it("returns critical when petition date is after expiry", () => {
    const checks = comparePrecheck(
      makeSirku({ authorityStart: "2022-12-20", authorityDurationYears: 3 }),
      makePetition({ petitionDate: "2026-04-20" }),
    );
    expect(findCheck(checks, "authority_duration").severity).toBe("critical");
  });

  it("returns critical when petition pre-dates the authority start", () => {
    const checks = comparePrecheck(
      makeSirku({ authorityStart: "2025-01-01", authorityDurationYears: 3 }),
      makePetition({ petitionDate: "2024-06-01" }),
    );
    expect(findCheck(checks, "authority_duration").severity).toBe("critical");
  });

  it("returns warning when start or duration missing", () => {
    const checks = comparePrecheck(
      makeSirku({ authorityStart: null, authorityDurationYears: null }),
      makePetition(),
    );
    expect(findCheck(checks, "authority_duration").severity).toBe("warning");
  });
});

describe("soft checks — address_match + sirku_freshness", () => {
  it("never escalates address mismatch above warning", () => {
    const checks = comparePrecheck(
      makeSirku({ address: "Tamamen farklı bir adres içeriği" }),
      makePetition({ address: "Hiç ortak token içermeyen başka bir adres" }),
    );
    expect(findCheck(checks, "address_match").severity).not.toBe("critical");
  });

  it("flags sirku_freshness when documents are >24 months apart", () => {
    const checks = comparePrecheck(
      makeSirku({ sirkuDate: "2020-01-01" }),
      makePetition({ petitionDate: "2025-06-01" }),
    );
    expect(findCheck(checks, "sirku_freshness").severity).toBe("warning");
  });

  it("returns ok for sirku_freshness within 24 months", () => {
    const checks = comparePrecheck(
      makeSirku({ sirkuDate: "2024-06-01" }),
      makePetition({ petitionDate: "2025-06-01" }),
    );
    expect(findCheck(checks, "sirku_freshness").severity).toBe("ok");
  });
});

describe("computeOverallStatus", () => {
  it("returns failed when any check is critical", () => {
    const checks = comparePrecheck(
      makeSirku({ taxNumber: "1111111111" }),
      makePetition({ taxNumber: "2222222222" }),
    );
    expect(computeOverallStatus(checks)).toBe("failed");
  });

  it("returns warned when no critical but at least one warning", () => {
    const checks = comparePrecheck(
      makeSirku(),
      makePetition({ address: "Tamamen farklı bir adres" }),
    );
    expect(computeOverallStatus(checks)).toBe("warned");
  });

  it("returns passed only when every check is ok", () => {
    const checks = comparePrecheck(makeSirku(), makePetition());
    expect(computeOverallStatus(checks)).toBe("passed");
  });
});
