"use client";

// ============================================================
// Custom Agent Hydrator
// ============================================================
//
// In db mode, fetches the user's custom agents on login and merges
// them into the control-room store so every page (panel list, agent
// gallery, stage pages) can read them synchronously from zustand.
// Local mode is a no-op — zustand + localStorage already carries the
// state.
//
// Timing matters: zustand/persist rehydrates from localStorage
// asynchronously after mount. If we push DB-sourced custom agents
// before persist finishes, its rehydrate step overwrites them. We
// gate on persist.onFinishHydration() to merge *after* localStorage
// has taken its turn.
// ============================================================

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useControlRoomStore } from "@/lib/control-room-store";
import {
  getPersistenceAdapter,
  getPersistenceMode,
} from "@/lib/persistence/factory";

async function mergeFromDB(signal: { cancelled: boolean }): Promise<void> {
  try {
    const adapter = await getPersistenceAdapter();
    const profiles = await adapter.agents.listProfiles();
    if (signal.cancelled) return;
    useControlRoomStore
      .getState()
      .hydrateCustomAgentsFromDTOs(
        profiles.filter((p) => p.isUserCreated),
      );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[agents] hydrate custom agents failed:", err);
  }
}

export function CustomAgentHydrator() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (getPersistenceMode() !== "db") return;

    const signal = { cancelled: false };

    // If persist already finished (fast localStorage, warm cache),
    // merge immediately. Otherwise wait for the rehydration event.
    // Both paths are safe — the merge is additive and idempotent.
    const persist = useControlRoomStore.persist;
    if (persist.hasHydrated()) {
      void mergeFromDB(signal);
    }
    const unsubscribe = persist.onFinishHydration(() => {
      if (!signal.cancelled) void mergeFromDB(signal);
    });

    return () => {
      signal.cancelled = true;
      unsubscribe();
    };
  }, [status]);

  return null;
}
