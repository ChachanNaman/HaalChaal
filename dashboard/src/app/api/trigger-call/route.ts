import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { parent_id } = await request.json();
  if (!parent_id) {
    return NextResponse.json({ error: "parent_id is required" }, { status: 400 });
  }

  // RLS scopes this to the logged-in user's own parents -- if they don't own this parent_id,
  // this returns null and we refuse to trigger the call.
  const { data: parent } = await supabase.from("parents").select("id").eq("id", parent_id).single();
  if (!parent) {
    return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  }

  const backendUrl = process.env.BACKEND_URL;
  const backendApiKey = process.env.BACKEND_INTERNAL_API_KEY;
  if (!backendUrl || !backendApiKey) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const res = await fetch(`${backendUrl}/calls/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": backendApiKey,
    },
    body: JSON.stringify({ parent_id }),
  });

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
