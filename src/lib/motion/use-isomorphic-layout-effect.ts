"use client";

import { useEffect, useLayoutEffect } from "react";

// useLayoutEffect warns when run during SSR (no DOM to measure). Swap
// to useEffect on the server so the hook stays silent there while
// keeping pre-paint timing in the browser.
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
