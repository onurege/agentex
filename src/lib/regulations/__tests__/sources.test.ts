import { describe, it, expect } from "vitest";
import { fetchResmiGazeteCandidates } from "../sources/resmi-gazete";
import { fetchGoogleNewsCandidates } from "../sources/google-news";
import { detectCompanies } from "../companies";

// Adapters do live network in normal flow; tests assert resilience —
// when the public site is unreachable or returns empty, the adapter
// must produce a structured no-content result instead of throwing,
// because the scan orchestrator depends on per-source isolation.

describe("fetchResmiGazeteCandidates — defensive shape", () => {
  it("returns a result object with candidates and error fields", async () => {
    // We don't assert specific content (depends on network + Resmî
    // Gazete uptime); we only assert the contract.
    const r = await fetchResmiGazeteCandidates({ days: 1 });
    expect(r).toHaveProperty("candidates");
    expect(r).toHaveProperty("error");
    expect(Array.isArray(r.candidates)).toBe(true);
  }, 20_000);
});

describe("fetchGoogleNewsCandidates — defensive shape", () => {
  it("returns a result object with candidates and error fields", async () => {
    const r = await fetchGoogleNewsCandidates();
    expect(r).toHaveProperty("candidates");
    expect(r).toHaveProperty("error");
    expect(Array.isArray(r.candidates)).toBe(true);
    // Eğer ağ erişimi varsa her bir kayıt en az bir company id taşımalı.
    for (const c of r.candidates) {
      expect(c.source).toBe("google-news");
      expect(c.sourceTool).toBe("google-news");
      expect(Array.isArray(c.companies)).toBe(true);
      expect((c.companies ?? []).length).toBeGreaterThan(0);
    }
  }, 60_000);
});

describe("detectCompanies", () => {
  it("matches Param via Turkish-cased aliases", () => {
    expect(detectCompanies("Param Ödeme yeni cüzdanı duyurdu")).toContain("param");
  });
  it("returns empty for unrelated text", () => {
    expect(detectCompanies("ankara büyükşehir belediyesi")).toEqual([]);
  });
  it("matches multiple companies in one text", () => {
    const matched = detectCompanies("Kredim ile Twisto işbirliği");
    expect(matched).toContain("kredim");
    expect(matched).toContain("twisto");
  });
});

describe("AI gate — disabled mode", () => {
  it("passes everything when REGULATIONS_AI_GATE_ENABLED=false", async () => {
    const prev = process.env.REGULATIONS_AI_GATE_ENABLED;
    process.env.REGULATIONS_AI_GATE_ENABLED = "false";
    const { gateOne, gateAll } = await import("../ai-gate");
    const candidate = {
      source: "google-news" as const,
      externalId: "test-1",
      title: "test",
      summary: "test",
      publishedAt: new Date(),
    };
    const single = await gateOne(candidate);
    expect(single.passed).toBe(true);
    expect(single.reason).toBe("ai_disabled");
    expect(single.verdict).toBeNull();

    const batch = await gateAll([candidate, candidate]);
    expect(batch).toHaveLength(2);
    expect(batch.every((d) => d.passed)).toBe(true);

    if (prev === undefined) {
      delete process.env.REGULATIONS_AI_GATE_ENABLED;
    } else {
      process.env.REGULATIONS_AI_GATE_ENABLED = prev;
    }
  });
});
