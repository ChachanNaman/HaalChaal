"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { Call, Parent } from "@/lib/supabase";
import { SPRING } from "@/lib/motion";
import { StatusIndicator } from "@/components/ui/status-indicator";

function moodTone(score: number) {
  if (score >= 4) return "bg-success/15 text-success border-success/30";
  if (score === 3) return "bg-warning/15 text-warning border-warning/30";
  return "bg-danger/15 text-danger border-danger/30";
}

export default function ParentList({
  parents,
  latestCall,
}: {
  parents: Parent[];
  latestCall: Record<string, Call | undefined>;
}) {
  if (parents.length === 0) {
    return (
      <p className="mt-8 text-sm text-taupe">
        No parents registered yet — use "Register a parent" above to add one.
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {parents.map((p, i) => {
        const latest = latestCall[p.id];
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * 0.03 }}
          >
            <Link
              href={`/parent/${p.id}`}
              className="material-card press-feedback flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-2/60"
            >
              <div className="min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-taupe">{p.phone_number}</p>
                <p className="mt-1 text-xs text-taupe/70">
                  Registered{" "}
                  {new Date(p.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {latest ? (
                  <>
                    {latest.flagged_urgent && (
                      <span className="rounded-full border border-danger/30 bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
                        Urgent
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${moodTone(latest.mood_score)}`}
                    >
                      Mood {latest.mood_score}/5
                    </span>
                  </>
                ) : (
                  <StatusIndicator
                    state="idle"
                    label="No check-ins yet"
                    size="sm"
                    labelClassName="hidden sm:block"
                  />
                )}
                <span className="hidden text-sm text-accent sm:block">View history &rarr;</span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}