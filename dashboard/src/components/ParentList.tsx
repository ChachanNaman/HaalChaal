"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { Parent } from "@/lib/supabase";

export default function ParentList({ parents }: { parents: Parent[] }) {
  if (parents.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No parents yet — add one to the <code>parents</code> table in Supabase.
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {parents.map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 1, duration: 0.4, delay: i * 0.03 }}
        >
          <Link
            href={`/parent/${p.id}`}
            className="material-card press-feedback flex items-center justify-between px-5 py-4 hover:bg-surface-2/60"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-gray-500">{p.phone_number}</p>
            </div>
            <span className="text-sm text-accent">View history &rarr;</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
