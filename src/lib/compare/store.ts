// ============================================================
// Compare Module — Zustand Store
// ============================================================
//
// Holds every compare run the user has produced plus the
// in-progress upload state for the /new flow. Persisted to
// localStorage under its own key so it can never collide with
// boardroom state.
// ============================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CompareDocumentMeta, CompareRun } from "./types";
import { buildMockRun } from "./mock-engine";

interface PendingUpload {
  meta: CompareDocumentMeta;
}

interface CompareState {
  /** All compare runs the user has produced, keyed by id. */
  runs: Record<string, CompareRun>;

  /** In-progress upload for the /new flow — cleared after run is created. */
  pendingV1: PendingUpload | null;
  pendingV2: PendingUpload | null;

  setV1(meta: CompareDocumentMeta): void;
  setV2(meta: CompareDocumentMeta): void;
  clearV1(): void;
  clearV2(): void;
  clearPending(): void;

  /** Produce a new run from whatever is pending. Returns the new run id. */
  startCompareRun(): string | null;

  getRun(id: string): CompareRun | undefined;
  listRuns(): CompareRun[];
  deleteRun(id: string): void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      runs: {},
      pendingV1: null,
      pendingV2: null,

      setV1: (meta) => set({ pendingV1: { meta } }),
      setV2: (meta) => set({ pendingV2: { meta } }),
      clearV1: () => set({ pendingV1: null }),
      clearV2: () => set({ pendingV2: null }),
      clearPending: () => set({ pendingV1: null, pendingV2: null }),

      startCompareRun: () => {
        const { pendingV1, pendingV2 } = get();
        if (!pendingV1 || !pendingV2) return null;

        const run = buildMockRun(pendingV1.meta, pendingV2.meta);
        set((s) => ({
          runs: { ...s.runs, [run.id]: run },
          pendingV1: null,
          pendingV2: null,
        }));
        return run.id;
      },

      getRun: (id) => get().runs[id],

      listRuns: () => {
        const runs = Object.values(get().runs);
        // Newest first
        return runs.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      },

      deleteRun: (id) =>
        set((s) => {
          const next = { ...s.runs };
          delete next[id];
          return { runs: next };
        }),
    }),
    {
      name: "agentex-compare-v1",
      partialize: (s) => ({ runs: s.runs }), // pending never persisted
    },
  ),
);
