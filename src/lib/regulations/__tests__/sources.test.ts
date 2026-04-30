import { describe, it, expect } from "vitest";
import { fetchResmiGazeteCandidates } from "../sources/resmi-gazete";

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
