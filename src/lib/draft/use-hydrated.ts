"use client";

// ============================================================
// useHydrated — Zustand persist hydration guard
// ============================================================
//
// Zustand persist middleware localStorage'dan sadece istemci
// tarafında rehydrate eder. İlk SSR render'da store boş,
// rehydrate sonrası dolu — bu iki render arasındaki DOM farkı
// Next hydration mismatch hatasını tetikler. useHydrated ilk
// mount'ta false döner, effect sonrası true — tüketiciler
// aradaki sürede tutarlı bir iskelet render ederek sorunu
// ortadan kaldırır.
// ============================================================

import { useEffect, useState } from "react";

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
