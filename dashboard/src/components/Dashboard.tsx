import type { Call, Parent } from "@/lib/supabase";
import {
  baselineDelta,
  checkInStreak,
  missedMedsStreak,
  scoreWithDelta,
  weeklyRollup,
  weeklySummaryPoints,
  type SummaryTone,
} from "@/lib/insights";
import TrendChart from "./TrendChart";
import CallList from "./CallList";
import UrgentBanner from "./UrgentBanner";
import CallNowButton from "./CallNowButton";
import ShareSummaryButton from "./ShareSummaryButton";
import ExportCsvButton from "./ExportCsvButton";

type Tone = "green" | "yellow" | "red" | "gray";

function moodLabel(score: number): { label: string; tone: Tone } {
  if (score >= 4) return { label: score === 5 ? "Excellent" : "Good", tone: "green" };
  if (score === 3) return { label: "Okay", tone: "yellow" };
  return { label: "Low", tone: "red" };
}

function clarityLabel(score: number): { label: string; tone: Tone } {
  if (score >= 4) return { label: score === 5 ? "Sharp" : "Clear", tone: "green" };
  if (score === 3) return { label: "Okay", tone: "yellow" };
  return { label: "Confused", tone: "red" };
}

function medicationLabel(status: Call["medication_taken"]): { label: string; tone: Tone } {
  if (status === "yes") return { label: "Taken", tone: "green" };
  if (status === "no") return { label: "Missed", tone: "red" };
  return { label: "Unclear", tone: "gray" };
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

const TONE_TEXT: Record<Tone, string> = {
  green: "text-success",
  yellow: "text-warning",
  red: "text-danger",
  gray: "text-ivory/60",
};

const DOT_TONE: Record<SummaryTone, string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-danger",
  gray: "bg-taupe",
};

function MetricCard({ label, value, sub, tone = "gray" }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div className="material-card px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-taupe">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-taupe">{sub}</p>}
    </div>
  );
}

export default function Dashboard({ parent, calls }: { parent: Parent; calls: Call[] }) {
  const latest = calls[calls.length - 1];
  const mood = latest ? moodLabel(latest.mood_score) : null;
  const clarity = latest ? clarityLabel(latest.coherence_score) : null;
  const medicine = latest ? medicationLabel(latest.medication_taken) : null;
  const medsStreak = missedMedsStreak(calls);
  const streak = checkInStreak(calls);
  const rollup = weeklyRollup(calls);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{parent.name}</h1>
          <p className="text-sm text-taupe">{parent.phone_number}</p>
        </div>
        <CallNowButton parentId={parent.id} />
      </div>

      {latest?.flagged_urgent && (
        <UrgentBanner callId={latest.id} message={latest.new_complaint ?? "check the transcript below"} />
      )}

      {latest && mood && clarity && medicine ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              label="Mood"
              value={mood.label}
              sub={scoreWithDelta(latest.mood_score, baselineDelta(calls, "mood_score"))}
              tone={mood.tone}
            />
            <MetricCard
              label="Clarity"
              value={clarity.label}
              sub={scoreWithDelta(latest.coherence_score, baselineDelta(calls, "coherence_score"))}
              tone={clarity.tone}
            />
            <MetricCard
              label="Medicine"
              value={medicine.label}
              sub={medsStreak > 0 ? `${medsStreak} day${medsStreak > 1 ? "s" : ""} missed in a row` : "On track"}
              tone={medsStreak > 0 ? "red" : medicine.tone}
            />
            <MetricCard
              label="Check-in streak"
              value={`${streak} day${streak === 1 ? "" : "s"}`}
              sub={`Last check-in ${timeAgo(latest.timestamp)}`}
              tone={streak >= 3 ? "green" : streak > 0 ? "yellow" : "gray"}
            />
          </div>

          <section className="mt-10">
            <div className="material-card p-5">
              <h2 className="text-sm font-medium uppercase tracking-wide text-taupe">
                Mood &amp; clarity trend
              </h2>
              <div className="mt-3">
                <TrendChart calls={calls} />
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-taupe">
              Call history
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {calls.length}
              </span>
            </h2>
            <CallList calls={calls} />
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-taupe">
              Weekly summary
            </h2>
            <div className="material-card p-5">
              <ul className="space-y-2.5">
                {weeklySummaryPoints(rollup).map((point) => (
                  <li key={point.label} className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_TONE[point.tone]}`} />
                    <p className="text-sm leading-relaxed text-ivory/90">
                      <span className="font-medium text-ivory">{point.label}:</span>{" "}
                      {point.value}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <ShareSummaryButton parentName={parent.name} rollup={rollup} />
                <ExportCsvButton parent={parent} calls={calls} />
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className="mt-8 text-sm text-taupe">No check-ins yet.</p>
      )}
    </div>
  );
}
