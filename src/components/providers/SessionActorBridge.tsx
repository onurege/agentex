"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { setCurrentActor } from "@/lib/audit-log";

/**
 * Mirrors the NextAuth session into audit-log's module-level actor slot.
 * Zustand actions that call saveAuditEvent (e.g. control-room-store)
 * live outside React context and cannot call useSession themselves, so
 * this bridge is the only way they learn who the current user is.
 *
 * In db mode saveAuditEvent is a no-op (the server stamps actorId from
 * its own session), so this primarily serves the local mode path.
 */
export function SessionActorBridge() {
  const { data: session } = useSession();

  useEffect(() => {
    setCurrentActor(session?.user?.id ?? null);
  }, [session?.user?.id]);

  return null;
}
