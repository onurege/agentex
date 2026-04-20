"use client";

// ============================================================
// Motion Primitives
// ============================================================
//
// Thin wrappers around framer-motion that consult useFastMode() before
// animating. When fast-mode is enabled (OS reduced-motion or manual
// toggle), the primitives render plain <div>s and never touch initial/
// animate/transition props, so there is no animation work at all.
//
// Primitives:
//   <SceneIn>          — single element scene-in (opacity + y)
//   <StaggerChildren>  — parent variant container for staggered reveals
//   <StaggerItem>      — child variant; must live under StaggerChildren
//   <SpotlightFocus>   — opacity dim/restore for disagreement focus
// ============================================================

import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { DURATION, EASE } from "./tokens";
import { useFastMode } from "./fast-mode";

interface MotionWrapperProps {
  children: ReactNode;
  className?: string;
}

// ── SceneIn ─────────────────────────────────────────────
interface SceneInProps extends MotionWrapperProps {
  /** Delay in seconds before the animation starts. */
  delay?: number;
}

export function SceneIn({ children, className, delay = 0 }: SceneInProps) {
  const { enabled } = useFastMode();
  if (enabled) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: DURATION.sceneEnter,
        ease: EASE.entrance,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

// ── StaggerChildren / StaggerItem ───────────────────────
interface StaggerChildrenProps extends MotionWrapperProps {
  /** Seconds between each child's reveal. */
  stagger?: number;
  /** Seconds to wait before the first child reveals. */
  delayChildren?: number;
}

export function StaggerChildren({
  children,
  className,
  stagger = 0.06,
  delayChildren = 0,
}: StaggerChildrenProps) {
  const { enabled } = useFastMode();
  if (enabled) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren,
      },
    },
  };

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: MotionWrapperProps) {
  const { enabled } = useFastMode();
  if (enabled) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.sceneEnter, ease: EASE.entrance },
    },
  };

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

// ── SpotlightFocus ──────────────────────────────────────
interface SpotlightFocusProps extends MotionWrapperProps {
  /** True → full opacity; false → dimmed (0.4) for out-of-focus elements. */
  active: boolean;
}

export function SpotlightFocus({ active, children, className }: SpotlightFocusProps) {
  const { enabled } = useFastMode();

  if (enabled) {
    // Static opacity, no transition — preserves the visual hierarchy
    // without animating.
    return (
      <div className={className} style={{ opacity: active ? 1 : 0.4 }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      animate={{ opacity: active ? 1 : 0.4 }}
      transition={{ duration: DURATION.disagreementPulse, ease: EASE.standard }}
    >
      {children}
    </motion.div>
  );
}
