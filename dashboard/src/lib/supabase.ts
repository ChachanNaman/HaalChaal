import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Parent = {
  id: string;
  name: string;
  phone_number: string;
  preferred_language: string;
  custom_questions: string | null;
  created_at: string;
};

export type Call = {
  id: string;
  parent_id: string;
  timestamp: string;
  transcript: string | null;
  audio_url: string | null;
  mood_score: number;
  coherence_score: number;
  medication_taken: "yes" | "no" | "unclear";
  new_complaint: string | null;
  flagged_urgent: boolean;
};
