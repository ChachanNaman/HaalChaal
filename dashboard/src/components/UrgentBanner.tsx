"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SPRING } from "@/lib/motion";

interface Ack {
  note: string;
  at: string;
}

function ackKey(callId: string) {
  return `haalchaal:ack:${callId}`;
}

function readAck(callId: string): Ack | null {
  try {
    const raw = localStorage.getItem(ackKey(callId));
    return raw ? (JSON.parse(raw) as Ack) : null;
  } catch {
    return null;
  }
}

export default function UrgentBanner({ callId, message }: { callId: string; message: string }) {
  // undefined = "haven't checked localStorage yet" — render nothing until then,
  // so the server-rendered pass and the first client pass agree (no hydration flash).
  const [ack, setAck] = useState<Ack | null | undefined>(undefined);
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    // One-time read of browser-only localStorage after mount, so the server-rendered
    // pass and the first client pass agree (`ack` starts `undefined` either way).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAck(readAck(callId));
    setNote("");
    setAddingNote(false);
  }, [callId]);

  function acknowledge() {
    const entry: Ack = { note: note.trim(), at: new Date().toISOString() };
    try {
      localStorage.setItem(ackKey(callId), JSON.stringify(entry));
    } catch {
      // localStorage unavailable (private browsing, etc.) — dismiss for this session only.
    }
    setAck(entry);
  }

  if (ack === undefined || ack) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={SPRING}
        className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger backdrop-blur-xl"
      >
        <p>Most recent call was flagged urgent — {message}.</p>
        {addingNote ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional) — e.g. Called her, she's fine"
              className="min-w-0 flex-1 rounded-md border border-danger/30 bg-surface-0/50 px-2.5 py-1.5 text-xs text-ivory placeholder:text-danger/50 focus:outline-none"
            />
            <button
              onClick={acknowledge}
              className="press-feedback shrink-0 rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-surface-0"
            >
              Save &amp; dismiss
            </button>
          </div>
        ) : (
          <div className="mt-2 flex gap-3 text-xs">
            <button onClick={acknowledge} className="press-feedback font-medium underline underline-offset-2">
              Mark as checked
            </button>
            <button onClick={() => setAddingNote(true)} className="press-feedback text-danger/70 underline underline-offset-2">
              Add a note first
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
