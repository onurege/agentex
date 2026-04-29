import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractSirku, extractPetition } from "../extract";

const sirkuFixture = readFileSync(
  join(__dirname, "fixtures/turkishcare-sirku.txt"),
  "utf-8",
);
const petitionFixture = readFileSync(
  join(__dirname, "fixtures/turkishcare-petition.txt"),
  "utf-8",
);

describe("extractSirku — TURKISHCARE 2022 fixture", () => {
  const result = extractSirku(sirkuFixture);

  it("captures the company name canonical form", () => {
    expect(result.companyName).toBe(
      "TURKISHCARE İTHALAT İHRACAT ANONİM ŞİRKETİ",
    );
  });

  it("captures the 10-digit tax number", () => {
    expect(result.taxNumber).toBe("8711218985");
  });

  it("captures the trade registry number", () => {
    expect(result.tradeRegistryNumber).toBe("270230-5");
  });

  it("captures the address line", () => {
    expect(result.address).toContain("Çakmak Mahallesi");
    expect(result.address).toContain("Selvi Cadde");
  });

  it("captures authority type as münferiden", () => {
    expect(result.authorityType).toBe("münferiden");
  });

  it("captures authority start date as ISO", () => {
    expect(result.authorityStart).toBe("2022-12-20");
  });

  it("captures authority duration in years", () => {
    expect(result.authorityDurationYears).toBe(3);
  });

  it("captures sirkü issue date as ISO", () => {
    expect(result.sirkuDate).toBe("2022-12-27");
  });

  it("captures the representative TC kimlik number", () => {
    expect(result.representativeIdNumber).toBe("21524412292");
  });

  it("captures the representative name", () => {
    expect(result.representativeName).toBe("SELİM FİDAN");
  });
});

describe("extractPetition — TURKISHCARE iade dilekçesi fixture", () => {
  const result = extractPetition(petitionFixture);

  it("captures the stamp block company name (Latin-I form)", () => {
    expect(result.companyName).toBe("TURKISHCARE ITH.IMR.A.S.");
  });

  it("captures the petition date as ISO", () => {
    expect(result.petitionDate).toBe("2026-04-20");
  });

  it("captures the spaced 10-digit tax number from V.D anchor", () => {
    expect(result.taxNumber).toBe("8711218985");
  });

  it("captures the trade registry number from Tic.Sic anchor", () => {
    expect(result.tradeRegistryNumber).toBe("270230-5");
  });

  it("captures the 16-digit Mersis number", () => {
    expect(result.mersisNumber).toBe("0871121898500001");
  });

  it("captures the stamp address between company line and Mersis", () => {
    expect(result.address).toContain("F.S.M. Mah");
    expect(result.address).toContain("Buyaka 2 Sitesi");
  });
});

describe("extract — defensive edge cases", () => {
  it("returns null fields for empty sirkü input", () => {
    const result = extractSirku("");
    expect(result.companyName).toBeNull();
    expect(result.taxNumber).toBeNull();
    expect(result.authorityType).toBe("belirsiz");
    expect(result.authorityStart).toBeNull();
  });

  it("returns null fields for empty petition input", () => {
    const result = extractPetition("");
    expect(result.companyName).toBeNull();
    expect(result.taxNumber).toBeNull();
    expect(result.petitionDate).toBeNull();
  });

  it("does not match prose lines mentioning A.Ş. as company name", () => {
    const text = `Yukarıda adresi yazılı Acme A.Ş. ünvanlı şirketin\nyapılan işlemleri onaylanmıştır.`;
    expect(extractSirku(text).companyName).toBeNull();
  });

  it("falls back to any 10-digit run when no VERGİ DAİRESİ anchor present", () => {
    const text = "Acme A.Ş.\nVergi: 1234567890\n";
    expect(extractSirku(text).taxNumber).toBe("1234567890");
  });

  it("rejects Müştereken authority type when sirkü says it explicitly", () => {
    const text = "ACME ANONİM ŞİRKETİ\nYetki Şekli: Müştereken Temsile Yetkilidir.";
    expect(extractSirku(text).authorityType).toBe("müştereken");
  });
});
