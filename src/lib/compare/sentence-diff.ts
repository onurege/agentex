// Sentence-level LCS diff for the compare module's side-by-side panels,
// with word-level fallback when two adjacent removed/added sentences are
// similar enough that the change is really a re-wording rather than a
// brand-new sentence.
//
// Without the word-level pass, a clause that swaps a single comma in a
// 200-character sentence would render the entire sentence red on the v1
// side and green on the v2 side, hiding the actual change in noise.
// Above the SIMILARITY_THRESHOLD we run an inner LCS over whitespace-
// split tokens so only the differing words light up; below threshold the
// pair is treated as two unrelated whole-sentence changes.

export type SentenceStatus = "common" | "removed" | "added";

export interface WordPart {
  text: string;
  status: SentenceStatus;
}

export interface SentencePart {
  text: string;
  status: SentenceStatus;
  /**
   * When the engine has fused a removed/added pair into a "modified"
   * pair, both SentenceParts carry the same wordDiff array describing
   * the full word-level change (common + removed + added). Each panel
   * filters at render time: v1 keeps common+removed, v2 keeps common+
   * added. Undefined on whole-sentence-removed / whole-sentence-added
   * parts where word-level rendering is not meaningful.
   */
  wordDiff?: WordPart[];
}

export interface SentenceDiffResult {
  v1: SentencePart[];
  v2: SentencePart[];
}

// Token overlap ratio above which a removed/added pair is treated as a
// modified-in-place sentence rather than two unrelated changes. 0.5 means
// at least half the tokens are shared. Tuned for Turkish contract text
// where small phrasing tweaks are common; raise it for stricter matching.
const SIMILARITY_THRESHOLD = 0.5;

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

function normalizeSentence(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[ ​]/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function tokenizeWords(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

function sentenceSimilarity(a: string, b: string): number {
  const ta = new Set(tokenizeWords(normalizeSentence(a)));
  const tb = new Set(tokenizeWords(normalizeSentence(b)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  ta.forEach((t) => {
    if (tb.has(t)) overlap += 1;
  });
  return overlap / Math.max(ta.size, tb.size);
}

// Word-level LCS within a single re-worded sentence. Returns a single
// ops array whose entries describe each token's fate: kept on both sides,
// only on v1 (removed), or only on v2 (added). Punctuation rides along
// with whatever token it's attached to (whitespace tokenization), which
// is enough to surface comma-only changes like "Sözleşme" vs "Sözleşme,".
export function wordLevelDiff(a: string, b: string): WordPart[] {
  const aTokens = tokenizeWords(a);
  const bTokens = tokenizeWords(b);
  const aKeys = aTokens.map((t) => t.toLocaleLowerCase("tr-TR"));
  const bKeys = bTokens.map((t) => t.toLocaleLowerCase("tr-TR"));
  const m = aTokens.length;
  const n = bTokens.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) return bTokens.map((t) => ({ text: t, status: "added" as const }));
  if (n === 0) return aTokens.map((t) => ({ text: t, status: "removed" as const }));

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

  const out: WordPart[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (aKeys[i - 1] === bKeys[j - 1]) {
      out.unshift({ text: aTokens[i - 1], status: "common" });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.unshift({ text: aTokens[i - 1], status: "removed" });
      i--;
    } else {
      out.unshift({ text: bTokens[j - 1], status: "added" });
      j--;
    }
  }
  while (i > 0) {
    out.unshift({ text: aTokens[i - 1], status: "removed" });
    i--;
  }
  while (j > 0) {
    out.unshift({ text: bTokens[j - 1], status: "added" });
    j--;
  }
  return out;
}

// Op produced during sentence-level LCS backtrack — used as an
// intermediate before pairing for word-level fusion.
type SentenceOp =
  | { kind: "common"; v1Text: string; v2Text: string }
  | { kind: "removed"; v1Text: string }
  | { kind: "added"; v2Text: string };

function sentenceLcsOps(
  aSentences: string[],
  bSentences: string[],
): SentenceOp[] {
  const aKeys = aSentences.map(normalizeSentence);
  const bKeys = bSentences.map(normalizeSentence);
  const m = aKeys.length;
  const n = bKeys.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) {
    return bSentences.map((v2Text) => ({ kind: "added" as const, v2Text }));
  }
  if (n === 0) {
    return aSentences.map((v1Text) => ({ kind: "removed" as const, v1Text }));
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

  const ops: SentenceOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (aKeys[i - 1] === bKeys[j - 1]) {
      ops.unshift({
        kind: "common",
        v1Text: aSentences[i - 1],
        v2Text: bSentences[j - 1],
      });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.unshift({ kind: "removed", v1Text: aSentences[i - 1] });
      i--;
    } else {
      ops.unshift({ kind: "added", v2Text: bSentences[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    ops.unshift({ kind: "removed", v1Text: aSentences[i - 1] });
    i--;
  }
  while (j > 0) {
    ops.unshift({ kind: "added", v2Text: bSentences[j - 1] });
    j--;
  }
  return ops;
}

// Walks the sentence ops, treats each maximal run of removed+added as a
// "cluster", and inside the cluster greedily pairs the most-similar
// removed/added sentences. Pairs above SIMILARITY_THRESHOLD become
// wordDiff-fused parts that share the same wordDiff array on both sides;
// unpaired entries fall through as whole-sentence removed/added.
function fuseAndSplit(ops: SentenceOp[]): SentenceDiffResult {
  const v1: SentencePart[] = [];
  const v2: SentencePart[] = [];

  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.kind === "common") {
      v1.push({ text: op.v1Text, status: "common" });
      v2.push({ text: op.v2Text, status: "common" });
      k++;
      continue;
    }

    const removedTexts: string[] = [];
    const addedTexts: string[] = [];
    while (k < ops.length && ops[k].kind !== "common") {
      const cur = ops[k];
      if (cur.kind === "removed") removedTexts.push(cur.v1Text);
      else if (cur.kind === "added") addedTexts.push(cur.v2Text);
      k++;
    }

    const usedAdded = new Set<number>();
    const removedSlots: Array<
      | { kind: "paired"; v1Text: string; v2Text: string; wordDiff: WordPart[] }
      | { kind: "unpaired"; v1Text: string }
    > = [];

    for (const r of removedTexts) {
      let bestIdx = -1;
      let bestScore = SIMILARITY_THRESHOLD;
      for (let bi = 0; bi < addedTexts.length; bi++) {
        if (usedAdded.has(bi)) continue;
        const score = sentenceSimilarity(r, addedTexts[bi]);
        if (score >= bestScore) {
          bestScore = score;
          bestIdx = bi;
        }
      }
      if (bestIdx >= 0) {
        usedAdded.add(bestIdx);
        const v2Text = addedTexts[bestIdx];
        removedSlots.push({
          kind: "paired",
          v1Text: r,
          v2Text,
          wordDiff: wordLevelDiff(r, v2Text),
        });
      } else {
        removedSlots.push({ kind: "unpaired", v1Text: r });
      }
    }

    // Push paired-then-unpaired in original order on each side.
    for (const slot of removedSlots) {
      if (slot.kind === "paired") {
        v1.push({
          text: slot.v1Text,
          status: "removed",
          wordDiff: slot.wordDiff,
        });
        v2.push({
          text: slot.v2Text,
          status: "added",
          wordDiff: slot.wordDiff,
        });
      } else {
        v1.push({ text: slot.v1Text, status: "removed" });
      }
    }
    for (let bi = 0; bi < addedTexts.length; bi++) {
      if (!usedAdded.has(bi)) {
        v2.push({ text: addedTexts[bi], status: "added" });
      }
    }
  }

  return { v1, v2 };
}

export function sentenceDiff(v1Text: string, v2Text: string): SentenceDiffResult {
  const aSentences = splitSentences(v1Text);
  const bSentences = splitSentences(v2Text);
  const ops = sentenceLcsOps(aSentences, bSentences);
  return fuseAndSplit(ops);
}
