import { supabase } from "@/lib/supabase";
import ParentList from "@/components/ParentList";

export const revalidate = 0;

export default async function Home() {
  const { data: parents } = await supabase
    .from("parents")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">HaalChaal</h1>
        <p className="mt-1 text-sm text-gray-400">
          Daily wellness check-ins, at a glance.
        </p>

        <ParentList parents={parents ?? []} />
      </div>
    </div>
  );
}
