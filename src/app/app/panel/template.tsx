"use client";

// Control Room transitions are quieter than the stage flow: no blur,
// no depth shift — just a brief opacity lift. The panel is a task
// surface, not a cinematic act, so we keep the motion language sober
// here even when fast-mode is off.

import { motion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion/tokens";
import { useFastMode } from "@/lib/motion/fast-mode";

export default function PanelTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { enabled } = useFastMode();
  if (enabled) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.sceneEnter, ease: EASE.entrance }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
