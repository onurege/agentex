// ============================================================
// Compare Module — Zustand Store
// ============================================================
//
// Holds every compare run the user has produced plus the
// in-progress upload state for the /new flow. Persisted to
// localStorage under its own key so it can never collide with
// boardroom state. Original DOCX buffers (needed for redline
// export) are held in-memory only — they never cross into
// persistence.
// ============================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CompareDocumentMeta, CompareRun } from "./types";
import type { CompareSection } from "./parse";
import { runDiffEngine } from "./diff-engine";

export interface PendingUpload {
  meta: CompareDocumentMeta;
  sections: CompareSection[];
  /** DOCX buffer for downstream redline export. Null for PDF / TXT. */
  originalBuffer: ArrayBuffer | null;
}

/** Per-run DOCX buffers kept out of persistence. */
export interface RunBuffers {
  v1: ArrayBuffer | null;
  v2: ArrayBuffer | null;
}

interface CompareState {
  /** All compare runs the user has produced, keyed by id. */
  runs: Record<string, CompareRun>;

  /**
   * Run id → original DOCX buffers. Populated when a run is created,
   * lost on page reload. Export is unavailable until the buffer is
   * re-attached (either by starting a new run or — later — re-uploading
   * the source DOCX).
   */
  runBuffers: Record<string, RunBuffers>;

  pendingV1: PendingUpload | null;
  pendingV2: PendingUpload | null;

  setV1(upload: PendingUpload): void;
  setV2(upload: PendingUpload): void;
  clearV1(): void;
  clearV2(): void;
  clearPending(): void;

  /** Produce a new run from whatever is pending. Returns the new run id. */
  startCompareRun(): string | null;

  getRun(id: string): CompareRun | undefined;
  getRunBuffers(id: string): RunBuffers | undefined;
  listRuns(): CompareRun[];
  deleteRun(id: string): void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      runs: {},
      runBuffers: {},
      pendingV1: null,
      pendingV2: null,

      setV1: (upload) => set({ pendingV1: upload }),
      setV2: (upload) => set({ pendingV2: upload }),
      clearV1: () => set({ pendingV1: null }),
      clearV2: () => set({ pendingV2: null }),
      clearPending: () => set({ pendingV1: null, pendingV2: null }),

      startCompareRun: () => {
        const { pendingV1, pendingV2 } = get();
        if (!pendingV1 || !pendingV2) return null;

        const run = runDiffEngine({
          v1: pendingV1.meta,
          v1Sections: pendingV1.sections,
          v2: pendingV2.meta,
          v2Sections: pendingV2.sections,
        });
        set((s) => ({
          runs: { ...s.runs, [run.id]: run },
          runBuffers: {
            ...s.runBuffers,
            [run.id]: {
              v1: pendingV1.originalBuffer,
              v2: pendingV2.originalBuffer,
            },
          },
          pendingV1: null,
          pendingV2: null,
        }));
        return run.id;
      },

      getRun: (id) => get().runs[id],
      getRunBuffers: (id) => get().runBuffers[id],

      listRuns: () => {
        const runs = Object.values(get().runs);
        return runs.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      },

      deleteRun: (id) =>
        set((s) => {
          const nextRuns = { ...s.runs };
          delete nextRuns[id];
          const nextBuffers = { ...s.runBuffers };
          delete nextBuffers[id];
          return { runs: nextRuns, runBuffers: nextBuffers };
        }),
    }),
    {
      name: "agentex-compare-v1",
      // Pending uploads and runBuffers are intentionally NOT persisted —
      // ArrayBuffers can't survive localStorage and would break rehydration.
      partialize: (s) => ({ runs: s.runs }),
    },
  ),
);
