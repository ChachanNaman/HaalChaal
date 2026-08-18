import Link from "next/link";
import ParentList from "@/components/ParentList";
import SignOutButton from "@/components/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Call } from "@/lib/supabase";

export const revalidate = 0;

export default async function Home() {
  const supabase = await createServerSupabaseClient();

  const { data: parents } = await supabase
    .from("parents")
    .select("*")
    .order("created_at", { ascending: true });

  const parentIds = (parents ?? []).map((p) => p.id);
  const latestCall: Record<string, Call | undefined> = {};
  if (parentIds.length > 0) {
    const { data: calls } = await supabase.from("calls").select("*").in("parent_id", parentIds);
    for (const c of calls ?? []) {
      const prev = latestCall[c.parent_id];
      if (!prev || new Date(c.timestamp) > new Date(prev.timestamp)) {
        latestCall[c.parent_id] = c;
      }
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-12 text-ivory">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            <p className="mt-1 text-sm text-taupe">Daily wellness check-ins, at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/parents/new"
            className="press-feedback inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            + Register a parent
          </Link>
        </div>

        <ParentList parents={parents ?? []} latestCall={latestCall} />
      </div>
    </div>
  );
}