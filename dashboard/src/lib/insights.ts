import type { Call, Parent } from "@/lib/supabase";

export function checkInStreak(calls: Call[]): number {
  const days = [...new Set(calls.map((c) => new Date(c.timestamp).toDateString()))].sort();
  let streak = 0;
  const latest = days[days.length - 1];
  if (!latest) return 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const expected = new Date(latest);
    expected.setDate(expected.getDate() - (days.length - 1 - i));
    if (days[i] === expected.toDateString()) streak += 1;
    else break;
  }
  return streak;
}

// Mirrors the backend's missed_medication_streak (escalation.py): consecutive
// "no" answers counting back from the most recent call.
export function missedMedsStreak(calls: Call[]): number {
  let streak = 0;
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i].medication_taken === "no") streak += 1;
    else break;
  }
  return streak;
}

// Per-call context: how does the latest score compare to this parent's own
// history, not a fixed threshold. This is the dashboard surfacing the same
// "rolling baseline, not judged in isolation" idea the backend's escalation
// logic already uses for urgent flagging.
export function baselineDelta(calls: Call[], key: "mood_score" | "coherence_score"): number | null {
  if (calls.length < 2) return null;
  const latest = calls[calls.length - 1];
  const prior = calls.slice(0, -1);
  const avg = prior.reduce((sum, c) => sum + c[key], 0) / prior.length;
  return latest[key] - avg;
}

export function scoreWithDelta(score: number, delta: number | null): string {
  if (delta === null || Math.abs(delta) < 0.3) return `${score}/5 · usual`;
  const sign = delta > 0 ? "+" : "";
  return `${score}/5 · ${sign}${delta.toFixed(1)} vs usual`;
}

export interface WeeklyRollup {
  days: number;
  avgMood: number | null;
  prevAvgMood: number | null;
  medsMissed: number;
  medsTotal: number;
  urgent: number;
  complaints: string[];
}

// Mirrors the WhatsApp digest's signal fields (whatsapp.py build_digest_message):
// mood band, medication status, complaints — rolled up over the trailing 7 days,
// plus the prior 7 days so we can say whether this week is better or worse.
export function weeklyRollup(calls: Call[]): WeeklyRollup {
  const latest = calls[calls.length - 1];
  if (!latest) {
    return { days: 0, avgMood: null, prevAvgMood: null, medsMissed: 0, medsTotal: 0, urgent: 0, complaints: [] };
  }
  const latestTime = new Date(latest.timestamp).getTime();
  const weekStart = latestTime - 6 * 24 * 60 * 60 * 1000;
  const prevWeekStart = latestTime - 13 * 24 * 60 * 60 * 1000;

  const week = calls.filter((c) => new Date(c.timestamp).getTime() >= weekStart);
  const prevWeek = calls.filter((c) => {
    const t = new Date(c.timestamp).getTime();
    return t >= prevWeekStart && t < weekStart;
  });

  const days = new Set(week.map((c) => new Date(c.timestamp).toDateString())).size;
  const avgMood = week.length > 0 ? week.reduce((sum, c) => sum + c.mood_score, 0) / week.length : null;
  const prevAvgMood = prevWeek.length > 0 ? prevWeek.reduce((sum, c) => sum + c.mood_score, 0) / prevWeek.length : null;

  return {
    days,
    avgMood,
    prevAvgMood,
    medsMissed: week.filter((c) => c.medication_taken === "no").length,
    medsTotal: week.length,
    urgent: week.filter((c) => c.flagged_urgent).length,
    complaints: week.map((c) => c.new_complaint).filter((x): x is string => Boolean(x)),
  };
}

export function weeklySummaryLine(rollup: WeeklyRollup): string {
  const parts = [`${rollup.days}/7 check-ins`];
  if (rollup.avgMood !== null) {
    let moodPart = `mood averaged ${rollup.avgMood.toFixed(1)}/5`;
    if (rollup.prevAvgMood !== null) {
      const diff = rollup.avgMood - rollup.prevAvgMood;
      if (diff >= 0.3) moodPart += ", up from last week";
      else if (diff <= -0.3) moodPart += ", down from last week";
      else moodPart += ", steady vs last week";
    }
    parts.push(moodPart);
  }
  const adherence = rollup.medsTotal > 0 ? Math.round(((rollup.medsTotal - rollup.medsMissed) / rollup.medsTotal) * 100) : null;
  if (adherence !== null) parts.push(`medicine taken ${adherence}% of check-ins`);
  if (rollup.urgent > 0) parts.push(`${rollup.urgent} urgent flag${rollup.urgent > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

export type SummaryTone = "green" | "yellow" | "red" | "gray";

export interface SummaryBullet {
  label: string;
  value: string;
  tone: SummaryTone;
}

// The same signal fields as the WhatsApp digest, laid out as bullet points for
// the dashboard's "Weekly summary" card.
export function weeklySummaryPoints(rollup: WeeklyRollup): SummaryBullet[] {
  const bullets: SummaryBullet[] = [];

  const checkInTone = rollup.days >= 6 ? "green" : rollup.days >= 4 ? "yellow" : "red";
  bullets.push({ label: "Check-ins", value: `${rollup.days} of 7 days`, tone: checkInTone });

  if (rollup.avgMood !== null) {
    let moodValue = `${rollup.avgMood.toFixed(1)}/5`;
    if (rollup.prevAvgMood !== null) {
      const diff = rollup.avgMood - rollup.prevAvgMood;
      if (diff >= 0.3) moodValue += " · up vs last week";
      else if (diff <= -0.3) moodValue += " · down vs last week";
      else moodValue += " · steady vs last week";
    }
    const moodTone: SummaryTone = rollup.avgMood >= 4 ? "green" : rollup.avgMood >= 3 ? "yellow" : "red";
    bullets.push({ label: "Mood", value: moodValue, tone: moodTone });
  }

  if (rollup.medsTotal > 0) {
    const missed = rollup.medsMissed;
    const adherence = Math.round(((rollup.medsTotal - missed) / rollup.medsTotal) * 100);
    const value =
      missed === 0
        ? `Taken at every check-in (${adherence}%)`
        : `Taken ${adherence}% of check-ins · missed ${missed}×`;
    const tone: SummaryTone = missed === 0 ? "green" : missed <= 2 ? "yellow" : "red";
    bullets.push({ label: "Medicine", value, tone });
  }

  bullets.push({
    label: "Urgent flags",
    value: rollup.urgent > 0 ? `${rollup.urgent} call${rollup.urgent > 1 ? "s" : ""} flagged` : "None",
    tone: rollup.urgent > 0 ? "red" : "green",
  });

  if (rollup.complaints.length > 0) {
    bullets.push({ label: "Mentioned", value: rollup.complaints.join("; "), tone: "red" });
  }

  return bullets;
}

export function weeklyShareText(parentName: string, rollup: WeeklyRollup): string {
  const lines = [`${parentName}'s week — HaalChaal check-in summary`, weeklySummaryLine(rollup)];
  if (rollup.complaints.length > 0) lines.push(`Mentioned: ${rollup.complaints.join("; ")}`);
  return lines.join("\n");
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Plain CSV of the full call history for a parent — meant to be handed to a
// doctor alongside the PRD's framing: "signals to discuss," not a diagnosis.
export function callsToCsv(parent: Parent, calls: Call[]): string {
  const header = ["Date", "Mood (1-5)", "Clarity (1-5)", "Medicine taken", "Flagged urgent", "Notes"];
  const rows = calls.map((c) => [
    new Date(c.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    String(c.mood_score),
    String(c.coherence_score),
    c.medication_taken,
    c.flagged_urgent ? "Yes" : "No",
    c.new_complaint ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}
