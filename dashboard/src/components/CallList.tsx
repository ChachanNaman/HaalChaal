"use client";

import { useState } from "react";
import type { Call } from "@/lib/supabase";

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "yellow" | "red" | "gray" }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
    gray: "bg-white/10 text-gray-300 border-white/15",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm text-gray-300">{date}</span>
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
        <span className="ml-auto text-xs text-gray-500">{open ? "Hide" : "View"} transcript</span>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 py-3">
          {call.audio_url ? (
            <audio controls src={call.audio_url} className="mb-3 w-full" />
          ) : (
            <p className="mb-3 text-xs italic text-gray-500">
              {isSeeded ? "Seeded demo entry — no audio recording." : "Audio recording not available for this call."}
            </p>
          )}
          <pre className="whitespace-pre-wrap text-sm text-gray-300">{call.transcript}</pre>
        </div>
      )}
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
