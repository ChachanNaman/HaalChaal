import Link from "next/link";
import { notFound } from "next/navigation";
import TrendChart from "@/components/TrendChart";
import CallList from "@/components/CallList";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

export default async function ParentPage(props: PageProps<"/parent/[id]">) {
  const { id } = await props.params;

  const [{ data: parent }, { data: calls }] = await Promise.all([
    supabase.from("parents").select("*").eq("id", id).single(),
    supabase.from("calls").select("*").eq("parent_id", id).order("timestamp", { ascending: true }),
  ]);

  if (!parent) notFound();

  const allCalls = calls ?? [];
  const latest = allCalls[allCalls.length - 1];

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
          &larr; All parents
        </Link>

        <div className="mt-3 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{parent.name}</h1>
          <span className="text-sm text-gray-500">{parent.phone_number}</span>
        </div>

        {latest?.flagged_urgent && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Most recent call was flagged urgent — {latest.new_complaint ?? "check the transcript below"}.
          </div>
        )}

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">
            Mood &amp; clarity trend
          </h2>
          {allCalls.length > 0 ? (
            <TrendChart calls={allCalls} />
          ) : (
            <p className="text-sm text-gray-500">No calls yet.</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">
            Call history
          </h2>
          <CallList calls={allCalls} />
        </section>
      </div>
    </div>
  );
}
