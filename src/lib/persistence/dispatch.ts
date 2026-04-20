// ============================================================
// Persistence Dispatch
// ============================================================
//
// Fire-and-forget adapter writes called from legacy sync store
// functions (run-history, audit-log, control-room-store).
//
// - Local mode: no-op. The sync localStorage / Zustand write that
//   happened just before has already persisted the change; routing
//   through LocalStorageAdapter here would just re-invoke the same
//   sync code (infinite recursion risk, or double-write on audit).
// - DB mode: dispatches to PostgresAdapter (HTTP). Errors are logged
//   but not thrown — callers keep their sync signature and UX.
//
// Callers stay sync → no spinner flash in local mode. Server sync in
// db mode happens in the background; UI already reflects the change
// from the local write-through cache.
// ============================================================

import { getPersistenceAdapter, getPersistenceMode } from "./factory";
import type { PersistenceAdapter } from "./types";

export function dispatchToAdapter(
  fn: (adapter: PersistenceAdapter) => Promise<unknown>,
): void {
  if (getPersistenceMode() !== "db") return;
  getPersistenceAdapter()
    .then(fn)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[persistence] adapter dispatch failed:", err);
    });
}
