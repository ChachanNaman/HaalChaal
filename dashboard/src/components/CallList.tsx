"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Call } from "@/lib/supabase";
import { SPRING } from "@/lib/motion";
import TranscriptView from "./TranscriptView";

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "yellow" | "red" | "gray" }) {
  const tones: Record<string, string> = {
    green: "bg-success/15 text-success border-success/30",
    yellow: "bg-warning/15 text-warning border-warning/30",
    red: "bg-danger/15 text-danger border-danger/30",
    gray: "bg-surface-2 text-taupe border-border",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  );
}

function CallRow({ call }: { call: Call }) {
  const [open, setOpen] = useState(false);
  const date = new Date(call.timestamp).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const isSeeded = call.transcript?.startsWith("Seeded historical check-in");

  return (
    <div className="material-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="press-feedback flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left"
      >
        <span className="text-sm text-ivory/80">{date}</span>
        {call.flagged_urgent && <Badge tone="red">Urgent</Badge>}
        <Badge tone={call.mood_score >= 4 ? "green" : call.mood_score === 3 ? "yellow" : "red"}>
          Mood {call.mood_score}/5
        </Badge>
        <Badge tone={call.coherence_score >= 4 ? "green" : call.coherence_score === 3 ? "yellow" : "red"}>
          Clarity {call.coherence_score}/5
        </Badge>
        <Badge tone={call.medication_taken === "yes" ? "green" : call.medication_taken === "no" ? "red" : "gray"}>
          Medicine: {call.medication_taken}
        </Badge>
        {call.new_complaint && <Badge tone="yellow">{call.new_complaint}</Badge>}
        <span className="ml-auto flex items-center gap-1 text-xs text-taupe">
          {open ? "Hide" : "View"} transcript
          <motion.svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            animate={{ rotate: open ? 180 : 0 }}
            transition={SPRING}
          >
            <path
              d="M2 3.5L5 6.5L8 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="border-t border-border"
          >
            <div className="px-5 py-4">
              {call.audio_url ? (
                <audio controls src={call.audio_url} className="mb-3 w-full" />
              ) : (
                <p className="mb-3 text-xs italic text-taupe">
                  {isSeeded ? "Seeded demo entry — no audio recording." : "Audio recording not available for this call."}
                </p>
              )}
              {call.transcript && <TranscriptView transcript={call.transcript} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CallList({ calls }: { calls: Call[] }) {
  const sorted = [...calls].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((c) => (
        <CallRow key={c.id} call={c} />
      ))}
    </div>
  );
}
