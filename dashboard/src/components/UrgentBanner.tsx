"use client";

import { motion } from "motion/react";
import { SPRING } from "@/lib/motion";

export default function UrgentBanner({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={SPRING}
      className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur-xl"
    >
      Most recent call was flagged urgent — {message}.
    </motion.div>
  );
}
