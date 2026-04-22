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
// ============================================================

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useControlRoomStore } from "@/lib/control-room-store";
import {
  getPersistenceAdapter,
  getPersistenceMode,
} from "@/lib/persistence/factory";

export function CustomAgentHydrator() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (getPersistenceMode() !== "db") return;

    let cancelled = false;
    (async () => {
      try {
        const adapter = await getPersistenceAdapter();
        const profiles = await adapter.agents.listProfiles();
        if (cancelled) return;
        useControlRoomStore
          .getState()
          .hydrateCustomAgentsFromDTOs(
            profiles.filter((p) => p.isUserCreated),
          );
      } catch (err) {
        // Non-fatal: panel will still work off whatever zustand
        // already has. Log for diagnosis.
        // eslint-disable-next-line no-console
        console.error("[agents] hydrate custom agents failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return null;
}
