import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import Dashboard from "@/components/Dashboard";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const revalidate = 0;

export default async function ParentPage(props: PageProps<"/parent/[id]">) {
  const { id } = await props.params;
  const supabase = await createServerSupabaseClient();

  const [{ data: parent }, { data: calls }] = await Promise.all([
    supabase.from("parents").select("*").eq("id", id).single(),
    supabase.from("calls").select("*").eq("parent_id", id).order("timestamp", { ascending: true }),
  ]);

  if (!parent) notFound();

  return (
    <AppShell>
      <Dashboard parent={parent} calls={calls ?? []} />
    </AppShell>
  );
}