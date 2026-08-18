"use client";

import { useState } from "react";
import { weeklyShareText, type WeeklyRollup } from "@/lib/insights";

export default function ShareSummaryButton({ parentName, rollup }: { parentName: string; rollup: WeeklyRollup }) {
  const [copied, setCopied] = useState(false);
  const text = weeklyShareText(parentName, rollup);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${parentName}'s week`, text });
        return;
      } catch {
        // user cancelled the share sheet — fall through to the WhatsApp link below
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the share/WhatsApp button still works
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShare}
        className="press-feedback rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        Share to family
      </button>
      <button
        onClick={handleCopy}
        className="press-feedback rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {copied ? "Copied" : "Copy text"}
      </button>
    </div>
  );
}
