"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AddParentState = { error: string | null };

export async function addParent(_prevState: AddParentState, formData: FormData): Promise<AddParentState> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phone_number") ?? "").trim();
  const preferredLanguage = String(formData.get("preferred_language") ?? "hi-en");
  const whatsappNumber = String(formData.get("whatsapp_number") ?? "").trim();
  const customQuestions = String(formData.get("custom_questions") ?? "").trim();

  if (!name || !phoneNumber || !whatsappNumber) {
    return { error: "Name, phone number, and WhatsApp number are all required." };
  }

  const { data: parent, error: parentError } = await supabase
    .from("parents")
    .insert({
      name,
      phone_number: phoneNumber,
      preferred_language: preferredLanguage,
      custom_questions: customQuestions || null,
      user_id: user.id,
    })
    .select()
    .single();

  if (parentError) return { error: parentError.message };

  const { error: contactError } = await supabase
    .from("family_contacts")
    .insert({ parent_id: parent.id, whatsapp_number: whatsappNumber, name: user.email ?? "Family" });

  if (contactError) return { error: contactError.message };

  redirect(`/parent/${parent.id}`);
}
