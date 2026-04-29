// Sentence-level LCS diff for the compare module's side-by-side panels.
//
// Renders v1 with common sentences neutral and removed sentences highlighted
// red; v2 with common sentences neutral and added sentences highlighted
// green. Sentences are matched by exact normalized text — small re-wordings
// produce a removed-on-v1 + added-on-v2 pair, which is the right signal
// for a "what changed" UX even if it's coarser than a word-level diff.

export type SentenceStatus = "common" | "removed" | "added";

export interface SentencePart {
  text: string;
  status: SentenceStatus;
}

export interface SentenceDiffResult {
  v1: SentencePart[];
  v2: SentencePart[];
}

// Splits text into sentences keeping the trailing punctuation. Tolerant of
// missing trailing punctuation on the last fragment so a clause that ends
// without a final period still surfaces as a sentence rather than being
// dropped. Whitespace-only chunks are filtered out.
export function splitSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const matches = text.match(/[^.!?…]+[.!?…]+(?:["')\]]*)|[^.!?…]+$/g);
  if (!matches) return [];
  const out: string[] = [];
  for (const raw of matches) {
    const s = raw.trim();
    if (s.length > 0) out.push(s);
  }
  return out;
}

// Normalize a sentence for equality comparison: collapse whitespace,
// strip leading/trailing punctuation that's not semantically meaningful.
// Used as the LCS matching key while preserving the original text for
// rendering.
function normalizeSentence(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[ ​]/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

// Standard LCS table over normalized sentence keys, then backtrack to
// emit per-side ops in original order. Removed-only on the v1 side,
// added-only on the v2 side; common sentences appear on both.
export function sentenceDiff(v1Text: string, v2Text: string): SentenceDiffResult {
  const aSentences = splitSentences(v1Text);
  const bSentences = splitSentences(v2Text);
  const aKeys = aSentences.map(normalizeSentence);
  const bKeys = bSentences.map(normalizeSentence);
  const m = aKeys.length;
  const n = bKeys.length;

  if (m === 0 && n === 0) return { v1: [], v2: [] };
  if (m === 0) {
    return {
      v1: [],
      v2: bSentences.map((text) => ({ text, status: "added" as const })),
    };
  }
  if (n === 0) {
    return {
      v1: aSentences.map((text) => ({ text, status: "removed" as const })),
      v2: [],
    };
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aKeys[i - 1] === bKeys[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const v1: SentencePart[] = [];
  const v2: SentencePart[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (aKeys[i - 1] === bKeys[j - 1]) {
      v1.unshift({ text: aSentences[i - 1], status: "common" });
      v2.unshift({ text: bSentences[j - 1], status: "common" });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      v1.unshift({ text: aSentences[i - 1], status: "removed" });
      i--;
    } else {
      v2.unshift({ text: bSentences[j - 1], status: "added" });
      j--;
    }
  }
  while (i > 0) {
    v1.unshift({ text: aSentences[i - 1], status: "removed" });
    i--;
  }
  while (j > 0) {
    v2.unshift({ text: bSentences[j - 1], status: "added" });
    j--;
  }

  return { v1, v2 };
}
