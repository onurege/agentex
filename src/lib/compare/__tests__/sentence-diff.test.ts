import { describe, it, expect } from "vitest";
import { sentenceDiff, splitSentences, wordLevelDiff } from "../sentence-diff";

describe("splitSentences", () => {
  it("splits on standard sentence terminators", () => {
    expect(splitSentences("Birinci cümle. İkinci cümle. Üçüncü.")).toEqual([
      "Birinci cümle.",
      "İkinci cümle.",
      "Üçüncü.",
    ]);
  });

  it("keeps trailing fragments without final punctuation", () => {
    expect(splitSentences("Tek cümle yarım kaldı")).toEqual([
      "Tek cümle yarım kaldı",
    ]);
  });

  it("returns empty array for empty / whitespace input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   \n\n  ")).toEqual([]);
  });

  it("handles question and exclamation marks", () => {
    expect(splitSentences("Ne dedi? Bilmiyorum! Soralım.")).toEqual([
      "Ne dedi?",
      "Bilmiyorum!",
      "Soralım.",
    ]);
  });
});

describe("sentenceDiff", () => {
  it("returns all common when texts are identical", () => {
    const r = sentenceDiff(
      "Birinci cümle. İkinci cümle.",
      "Birinci cümle. İkinci cümle.",
    );
    expect(r.v1.every((p) => p.status === "common")).toBe(true);
    expect(r.v2.every((p) => p.status === "common")).toBe(true);
    expect(r.v1).toHaveLength(2);
    expect(r.v2).toHaveLength(2);
  });

  it("marks v1-only sentences as removed", () => {
    const r = sentenceDiff(
      "Ortak cümle. Silinecek cümle.",
      "Ortak cümle.",
    );
    expect(r.v1).toEqual([
      { text: "Ortak cümle.", status: "common" },
      { text: "Silinecek cümle.", status: "removed" },
    ]);
    expect(r.v2).toEqual([{ text: "Ortak cümle.", status: "common" }]);
  });

  it("marks v2-only sentences as added", () => {
    const r = sentenceDiff(
      "Ortak cümle.",
      "Ortak cümle. Yeni eklenen cümle.",
    );
    expect(r.v1).toEqual([{ text: "Ortak cümle.", status: "common" }]);
    expect(r.v2).toEqual([
      { text: "Ortak cümle.", status: "common" },
      { text: "Yeni eklenen cümle.", status: "added" },
    ]);
  });

  it("emits removed and added pair when sentences are reworded", () => {
    const r = sentenceDiff(
      "Eski formülasyon kullanılır.",
      "Yeni formülasyon uygulanır.",
    );
    expect(r.v1).toEqual([
      { text: "Eski formülasyon kullanılır.", status: "removed" },
    ]);
    expect(r.v2).toEqual([
      { text: "Yeni formülasyon uygulanır.", status: "added" },
    ]);
  });

  it("preserves original order in interleaved diffs", () => {
    const r = sentenceDiff(
      "A. B. C. D.",
      "A. X. C. Y.",
    );
    // B → removed, X → added between A and C; D → removed, Y → added after C
    expect(r.v1.map((p) => `${p.text}:${p.status}`)).toEqual([
      "A.:common",
      "B.:removed",
      "C.:common",
      "D.:removed",
    ]);
    expect(r.v2.map((p) => `${p.text}:${p.status}`)).toEqual([
      "A.:common",
      "X.:added",
      "C.:common",
      "Y.:added",
    ]);
  });

  it("treats Turkish-uppercase variants as the same sentence", () => {
    const r = sentenceDiff("İADE EDİLECEK.", "iade edilecek.");
    expect(r.v1.every((p) => p.status === "common")).toBe(true);
    expect(r.v2.every((p) => p.status === "common")).toBe(true);
  });

  it("handles empty v1 by marking all v2 as added", () => {
    const r = sentenceDiff("", "Yeni cümle. Bir tane daha.");
    expect(r.v1).toEqual([]);
    expect(r.v2).toEqual([
      { text: "Yeni cümle.", status: "added" },
      { text: "Bir tane daha.", status: "added" },
    ]);
  });

  it("handles empty v2 by marking all v1 as removed", () => {
    const r = sentenceDiff("Eski cümle. Diğer eski.", "");
    expect(r.v1).toEqual([
      { text: "Eski cümle.", status: "removed" },
      { text: "Diğer eski.", status: "removed" },
    ]);
    expect(r.v2).toEqual([]);
  });

  it("returns empty arrays for two empty inputs", () => {
    const r = sentenceDiff("", "");
    expect(r.v1).toEqual([]);
    expect(r.v2).toEqual([]);
  });
});

describe("wordLevelDiff", () => {
  it("flags only the differing word when sentences differ by punctuation", () => {
    const ops = wordLevelDiff(
      "Sözleşme aynı şartlarla uzar.",
      "Sözleşme, aynı şartlarla uzar.",
    );
    const removed = ops.filter((w) => w.status === "removed").map((w) => w.text);
    const added = ops.filter((w) => w.status === "added").map((w) => w.text);
    expect(removed).toEqual(["Sözleşme"]);
    expect(added).toEqual(["Sözleşme,"]);
  });

  it("preserves common words and reconstructs each side's original order under filtering", () => {
    const ops = wordLevelDiff("a b c d", "a x c y");
    // The merged op order is an LCS-internal interleave, but each side's
    // visible content (common + own changes) must match its original.
    const v1 = ops.filter((o) => o.status !== "added").map((o) => o.text);
    const v2 = ops.filter((o) => o.status !== "removed").map((o) => o.text);
    expect(v1).toEqual(["a", "b", "c", "d"]);
    expect(v2).toEqual(["a", "x", "c", "y"]);
  });

  it("handles empty inputs symmetrically", () => {
    expect(wordLevelDiff("", "")).toEqual([]);
    expect(wordLevelDiff("", "a b")).toEqual([
      { text: "a", status: "added" },
      { text: "b", status: "added" },
    ]);
    expect(wordLevelDiff("a b", "")).toEqual([
      { text: "a", status: "removed" },
      { text: "b", status: "removed" },
    ]);
  });
});

describe("sentenceDiff — modified pair fusion", () => {
  it("fuses near-identical sentences into a wordDiff pair instead of whole-sentence red+green", () => {
    const r = sentenceDiff(
      "Sözleşme aynı şartlarla 1 (bir) yıl süreyle kendiliğinden uzar.",
      "Sözleşme, aynı şartlarla 1 (bir) yıl süreyle kendiliğinden uzar.",
    );
    expect(r.v1).toHaveLength(1);
    expect(r.v2).toHaveLength(1);
    expect(r.v1[0].status).toBe("removed");
    expect(r.v2[0].status).toBe("added");
    expect(r.v1[0].wordDiff).toBeDefined();
    expect(r.v2[0].wordDiff).toBeDefined();
    // Both sides should share the same wordDiff content
    expect(r.v1[0].wordDiff).toEqual(r.v2[0].wordDiff);
  });

  it("keeps unrelated re-words as separate whole-sentence parts", () => {
    const r = sentenceDiff(
      "Eski formülasyon kullanılır.",
      "Yeni formülasyon uygulanır.",
    );
    expect(r.v1[0].wordDiff).toBeUndefined();
    expect(r.v2[0].wordDiff).toBeUndefined();
  });

  it("fuses one similar pair while leaving an unpaired removed sentence whole", () => {
    const r = sentenceDiff(
      "Şirket malları teslim eder. Tamamen kaldırılan bir cümle.",
      "Şirket, malları teslim eder.",
    );
    // First sentence pair is similar enough to fuse
    expect(r.v1[0].wordDiff).toBeDefined();
    expect(r.v2[0].wordDiff).toBeDefined();
    // Second v1 sentence has no v2 pair → whole-sentence removed
    expect(r.v1).toHaveLength(2);
    expect(r.v1[1].status).toBe("removed");
    expect(r.v1[1].wordDiff).toBeUndefined();
    expect(r.v2).toHaveLength(1);
  });
});
