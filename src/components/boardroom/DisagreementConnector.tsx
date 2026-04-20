"use client";

// ============================================================
// Disagreement Connector
// ============================================================
//
// SVG overlay that draws an animated amber line between two seats
// during a disagreement moment. Rendered inside the perspective stage
// with z-0 so the line appears behind the table and seats, matching
// the z-index hierarchy set up in commit 7.
//
// Endpoint math:
//   - Measure both seat wrappers via getBoundingClientRect.
//   - Convert viewport coords to stage-local coords using the stage's
//     rect.
//   - Offset from seat center along the line's unit vector by
//     SEAT_RING_RADIUS so the line starts at the edge of the avatar
//     ring instead of underneath it.
//
// Animation:
//   - strokeDashoffset cycles for marching-ants motion.
//   - Opacity breathes 0.35 ↔ 1 ↔ 0.35 so the base state reads as
//     "disagreement present" without shouting; the peak reads as the
//     actual conflict beat.
//
// Below STAGE_MIN_WIDTH (720px) the connector hides itself — the 2-3
// seat edge case gets too cramped to draw a clear line.
// ============================================================

import { type RefObject, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/motion/use-isomorphic-layout-effect";

interface Props {
  stageRef: RefObject<HTMLElement>;
  fromId: string | null;
  toId: string | null;
}

interface Endpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const SEAT_RING_RADIUS = 32;
const STAGE_MIN_WIDTH = 720;

export function DisagreementConnector({ stageRef, fromId, toId }: Props) {
  const [endpoints, setEndpoints] = useState<Endpoints | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!fromId || !toId || fromId === toId) {
      setEndpoints(null);
      return;
    }

    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width < STAGE_MIN_WIDTH) {
        setEndpoints(null);
        return;
      }

      const a = stage.querySelector(`[data-seat-id="${fromId}"]`) as HTMLElement | null;
      const b = stage.querySelector(`[data-seat-id="${toId}"]`) as HTMLElement | null;
      if (!a || !b) return;

      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const cx1 = ra.left + ra.width / 2 - stageRect.left;
      const cy1 = ra.top + ra.height / 2 - stageRect.top;
      const cx2 = rb.left + rb.width / 2 - stageRect.left;
      const cy2 = rb.top + rb.height / 2 - stageRect.top;

      const dx = cx2 - cx1;
      const dy = cy2 - cy1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;

      const ux = dx / len;
      const uy = dy / len;

      setEndpoints({
        x1: cx1 + ux * SEAT_RING_RADIUS,
        y1: cy1 + uy * SEAT_RING_RADIUS,
        x2: cx2 - ux * SEAT_RING_RADIUS,
        y2: cy2 - uy * SEAT_RING_RADIUS,
      });
    };

    measure();

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, [fromId, toId, stageRef]);

  if (!endpoints) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    >
      <line
        x1={endpoints.x1}
        y1={endpoints.y1}
        x2={endpoints.x2}
        y2={endpoints.y2}
        stroke="#F59E0B"
        strokeWidth={2}
        strokeDasharray="8 6"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.5))" }}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="14"
          to="0"
          dur="0.8s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.35;1;0.35"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </line>
    </svg>
  );
}
