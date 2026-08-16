"use client";

import { useState } from "react";

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
      setMessage(err instanceof Error ? err.message : "Failed to place call");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={status === "calling"}
        className="press-feedback rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        {status === "calling" ? "Calling…" : "Call now"}
      </button>
      {message && (
        <span className={`text-sm ${status === "error" ? "text-red-400" : "text-gray-400"}`}>{message}</span>
      )}
    </div>
  );
}
