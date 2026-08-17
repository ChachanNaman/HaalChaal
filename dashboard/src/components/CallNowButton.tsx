"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SPRING } from "@/lib/motion";

function friendlyError(raw: string): string {
  if (raw.toLowerCase().includes("verified recipient") || raw.toLowerCase().includes("unverified")) {
    return "This number isn't verified in Twilio yet. Add it as a Verified Caller ID in the Twilio Console, then try again.";
  }
  return raw;
}

export default function CallNowButton({ parentId }: { parentId: string }) {
  const [status, setStatus] = useState<"idle" | "calling" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setStatus("calling");
    setMessage(null);
    try {
      const res = await fetch("/api/trigger-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: parentId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? body.detail ?? "Failed to place call");
      setStatus("done");
      setMessage(`Calling now (SID ${body.call_sid})`);
    } catch (err) {
      setStatus("error");
      setMessage(friendlyError(err instanceof Error ? err.message : "Failed to place call"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleClick}
        disabled={status === "calling"}
        className="press-feedback rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-50"
      >
        {status === "calling" ? "Calling…" : "Call now"}
      </button>
      <AnimatePresence>
        {message && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className={`text-sm ${status === "error" ? "text-red-400" : "text-gray-400"}`}
          >
            {message}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
