import { describe, it, expect } from "vitest";
import { classifyText } from "../classifier";

describe("classifyText", () => {
  it("returns empty topics + low priority for blank input", () => {
    expect(classifyText("")).toEqual({ topics: [], priority: "low" });
    expect(classifyText("   \n\n  ")).toEqual({ topics: [], priority: "low" });
  });

  it("returns empty topics for irrelevant text", () => {
    expect(classifyText("Bahçe sulama ve gübreleme konusu")).toEqual({
      topics: [],
      priority: "low",
    });
  });

  it("matches e-para topic from 6493 keyword", () => {
    const r = classifyText("6493 sayılı Kanun kapsamında düzenleme");
    expect(r.topics).toContain("e-para-odeme");
    expect(r.priority).toBe("critical");
  });

  it("matches MASAK topic and resolves priority as critical", () => {
    const r = classifyText("MASAK Genel Tebliği şüpheli işlem bildirimi");
    expect(r.topics).toContain("masak-aml");
    expect(r.priority).toBe("critical");
  });

  it("matches KVKK topic with priority high", () => {
    const r = classifyText("KVKK Kurul Kararı 2026/567 — VERBİS güncellemesi");
    expect(r.topics).toContain("kvkk");
    expect(r.priority).toBe("high");
  });

  it("matches multiple topics on overlapping content", () => {
    const r = classifyText(
      "TCMB Ödeme Hizmetleri Tebliği — KVKK aydınlatma yükümlülüğü",
    );
    expect(r.topics).toContain("e-para-odeme");
    expect(r.topics).toContain("kvkk");
    // critical (e-para) wins over high (kvkk)
    expect(r.priority).toBe("critical");
  });

  it("escalates priority to highest matched topic", () => {
    const r = classifyText("İş Kanunu MASAK rehber güncellemesi");
    // matches both kurumsal-istihdam (low) and masak-aml (critical)
    expect(r.priority).toBe("critical");
    expect(r.topics).toEqual(
      expect.arrayContaining(["kurumsal-istihdam", "masak-aml"]),
    );
  });

  it("is case-insensitive and Turkish-locale aware", () => {
    expect(classifyText("ELEKTRONİK PARA").topics).toContain("e-para-odeme");
    expect(classifyText("elektronik para").topics).toContain("e-para-odeme");
    expect(classifyText("Elektronik Para").topics).toContain("e-para-odeme");
  });

  it("matches BDDK topic with medium priority", () => {
    const r = classifyText("BDDK kart ücret tarifesi düzenlemesi");
    expect(r.topics).toContain("bddk-bankacilik");
    expect(r.priority).toBe("medium");
  });
});
