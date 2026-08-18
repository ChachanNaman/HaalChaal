"use client";

import { callsToCsv } from "@/lib/insights";
import type { Call, Parent } from "@/lib/supabase";

export default function ExportCsvButton({ parent, calls }: { parent: Parent; calls: Call[] }) {
  function handleExport() {
    const csv = callsToCsv(parent, calls);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${parent.name.replace(/\s+/g, "-").toLowerCase()}-checkins.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="press-feedback rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      Export for doctor (CSV)
    </button>
  );
}
