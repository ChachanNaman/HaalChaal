"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Call } from "@/lib/supabase";

type Range = "2w" | "all";

interface ChartPoint {
  date: string;
  mood: number;
  coherence: number;
  urgent: boolean;
}

function formatCalls(calls: Call[]): ChartPoint[] {
  return calls.map((c) => ({
    date: new Date(c.timestamp).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
    mood: c.mood_score,
    coherence: c.coherence_score,
    urgent: c.flagged_urgent,
  }));
}

function TrendDot(props: {
  cx?: number;
  cy?: number;
  fill?: string;
  stroke?: string;
  payload?: { urgent?: boolean };
}) {
  const { cx, cy, fill, stroke, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  const urgent = payload?.urgent === true;
  if (!urgent) {
    return <circle cx={cx} cy={cy} r={3} fill={fill ?? stroke} />;
  }
  // Flag marker: red dot with a pennant above it, so an urgent call jumps out.
  return (
    <g>
      <circle cx={cx} cy={cy} r={4.5} fill="var(--danger)" stroke="var(--danger)" strokeWidth={2} />
      <path d={`M${cx} ${cy - 7} v-8`} stroke="var(--danger)" strokeWidth={1.5} />
      <path
        d={`M${cx} ${cy - 15} h5 l-2.5 -2.5 l2.5 -2.5 h-5 z`}
        fill="var(--danger)"
      />
    </g>
  );
}

export default function TrendChart({ calls }: { calls: Call[] }) {
  const [range, setRange] = useState<Range>("2w");
  const [data, setData] = useState<ChartPoint[]>(() => formatCalls(calls));

  const rangeButton = (value: Range, label: string) => (
    <button
      type="button"
      onClick={() => {
        setRange(value);
        if (value === "all") {
          setData(formatCalls(calls));
          return;
        }
        const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const scoped = calls.filter((c) => new Date(c.timestamp).getTime() >= cutoff);
        setData(formatCalls(scoped.length > 0 ? scoped : calls));
      }}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        range === value
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-end">
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {rangeButton("2w", "2W")}
          {rangeButton("all", "All")}
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="date" stroke="var(--chart-axis)" fontSize={12} />
            <YAxis domain={[1, 5]} stroke="var(--chart-axis)" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <Line
              type="monotone"
              dataKey="mood"
              name="Mood"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={<TrendDot />}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="coherence"
              name="Coherence"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={<TrendDot />}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-taupe">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger align-middle" />
        Urgent call flagged
      </p>
    </>
  );
}