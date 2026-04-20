"use client";

// ============================================================
// Fast Mode
// ============================================================
//
// Single source of truth for "reduce motion" across the app. Three
// inputs collapse into one `enabled` flag that motion primitives and
// component-local Framer transitions consult:
//
//   1. OS preference — prefers-reduced-motion: reduce
//   2. Manual toggle — localStorage "ai-boardroom-fast-mode" = "true"
//   3. Default      — off
//
// Precedence: enabled = systemReduced || manual. Manual cannot override
// the OS preference (respect accessibility settings); it only adds on
// top of the default-off state.
//
// Initial read runs via useIsomorphicLayoutEffect so the first paint
// already reflects the correct state (no flicker between animated and
// reduced render on hydration).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

const STORAGE_KEY = "ai-boardroom-fast-mode";
const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function readManual(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function readSystemReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MEDIA_QUERY).matches;
}

export interface FastModeState {
  enabled: boolean;
  manual: boolean;
  systemReduced: boolean;
  toggleManual: () => void;
}

export function useFastMode(): FastModeState {
  const [manual, setManual] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setManual(readManual());
    setSystemReduced(readSystemReduced());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(MEDIA_QUERY);
    const onMQ = (event: MediaQueryListEvent) => setSystemReduced(event.matches);
    mq.addEventListener("change", onMQ);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setManual(event.newValue === "true");
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mq.removeEventListener("change", onMQ);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggleManual = useCallback(() => {
    setManual((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // private mode / quota — ignore, state still flips in-memory
      }
      return next;
    });
  }, []);

  return {
    enabled: systemReduced || manual,
    manual,
    systemReduced,
    toggleManual,
  };
}
