// ============================================================
// Motion Tokens
// ============================================================
//
// Centralized timing + easing for Faz 3 cinematic motion. Components
// reference DURATION.<key> and EASE.<key> directly; never hard-code
// milliseconds or cubic-bezier arrays in Framer Motion transitions.
//
// Duration values are in seconds (Framer Motion's native unit).
// Easing tuples are cubic-bezier control points.
// ============================================================

type Bezier = [number, number, number, number];

export const DURATION = {
  micro: 0.18,              // hover feedback, tap scale
  hover: 0.22,              // card/agent hover rings
  sceneEnter: 0.6,          // component mount (gallery, setup, verdict blocks)
  actTransition: 0.9,       // route template transitions (/app/*)
  disagreementPulse: 0.4,   // connector pulse, active speaker halo
} as const;

export const EASE = {
  standard: [0.4, 0, 0.2, 1] as Bezier,      // daily use
  entrance: [0.16, 1, 0.3, 1] as Bezier,     // scene-in (ease-out-expo)
  exit: [0.7, 0, 0.84, 0] as Bezier,         // scene-out
  emphatic: [0.22, 1, 0.36, 1] as Bezier,    // act transitions (large reveals)
};

export type DurationKey = keyof typeof DURATION;
export type EaseKey = keyof typeof EASE;
