import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

export default async function Home() {
  const { data: parents } = await supabase
    .from("parents")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">HaalChaal</h1>
        <p className="mt-1 text-sm text-gray-400">
          Daily wellness check-ins, at a glance.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {parents && parents.length > 0 ? (
            parents.map((p) => (
              <Link
                key={p.id}
                href={`/parent/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-gray-500">{p.phone_number}</p>
                </div>
                <span className="text-sm text-gray-500">View history &rarr;</span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              No parents yet — add one to the <code>parents</code> table in Supabase.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
