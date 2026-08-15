"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Call } from "@/lib/supabase";

export default function TrendChart({ calls }: { calls: Call[] }) {
  const data = calls.map((c) => ({
    date: new Date(c.timestamp).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
    mood: c.mood_score,
    coherence: c.coherence_score,
    urgent: c.flagged_urgent,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="date" stroke="#888" fontSize={12} />
          <YAxis domain={[1, 5]} stroke="#888" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
            labelStyle={{ color: "#ddd" }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="mood"
            name="Mood"
            stroke="#5eb1ff"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="coherence"
            name="Coherence"
            stroke="#8ee08e"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
