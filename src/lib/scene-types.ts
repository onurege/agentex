// ============================================================
// Discussion Scene — UI-specific types
// These are separate from domain types to keep UI concerns isolated.
// ============================================================

import { AgentId, AgentState } from "./types";

/** A fixed seat position at the conference table */
export type SeatPosition =
  | "head"          // Chief Agent — top center
  | "left-1"        // Left side, closest to Chief
  | "left-2"        // Left side, middle
  | "left-3"        // Left side, far
  | "right-1"       // Right side, closest to Chief
  | "right-2"       // Right side, middle
  | "right-3";      // Right side, far

export interface SceneSeat {
  position: SeatPosition;
  agentId: AgentId | null;   // null = empty seat
}

export type BubbleVariant =
  | "normal"       // Regular finding / reading comment
  | "disagreement" // One side of a conflict — highlighted
  | "synthesis"    // Chief Agent resolution — prominent
  | "complete";    // Done message

export interface SceneBubble {
  id: string;
  agentId: AgentId;
  text: string;
  variant: BubbleVariant;
  /** Timestamp (Date.now()) when this bubble was created — used for fade timing */
  createdAt: number;
}

export interface SceneEvent {
  /** ms delay from analysis start */
  delay: number;
  agentId: AgentId;
  text: string;
  variant: BubbleVariant;
}

// ---- Seat assignment order for expert agents ----
// Chief always gets "head". Experts fill seats in this order:
export const EXPERT_SEAT_ORDER: SeatPosition[] = [
  "left-1",
  "right-1",
  "left-2",
  "right-2",
  "left-3",
  "right-3",
];
