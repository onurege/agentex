"use client";

// Next.js App Router template: unlike layout.tsx, template.tsx creates
// a fresh instance on every navigation. Framer Motion picks that up
// and re-fires the mount animation, giving each /app/* scene its own
// act-transition reveal.

import { motion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion/tokens";
import { useFastMode } from "@/lib/motion/fast-mode";

export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { enabled } = useFastMode();
  if (enabled) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: DURATION.actTransition, ease: EASE.emphatic }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
