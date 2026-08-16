import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import ParentList from "@/components/ParentList";
import SignOutButton from "@/components/SignOutButton";

export const revalidate = 0;

export default async function Home() {
  const supabase = await createServerSupabaseClient();

  const { data: parents } = await supabase
    .from("parents")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">HaalChaal</h1>
            <p className="mt-1 text-sm text-gray-400">
              Daily wellness check-ins, at a glance.
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-6">
          <Link
            href="/parents/new"
            className="press-feedback inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
          >
            + Register a parent
          </Link>
        </div>

        <ParentList parents={parents ?? []} />
      </div>
    </div>
  );
}
