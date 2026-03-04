import { createClient } from "@supabase/supabase-js";

export interface Campaign {
  id?: string;
  name: string;
  subject: string;
  body: string;
  status: string;
  target_segment: string;
  send_time: string;
  created_at?: string;
  open_rate?: number;
  click_rate?: number;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

export async function saveCampaign(campaign: Campaign) {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("campaigns")
    .insert(campaign)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

export async function getCampaigns() {
  const client = assertSupabaseClient();
  const { data, error } = await client
    .from("campaigns")
    .select("*, campaign_variants(*)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data;
}

export function getSupabaseStatus() {
  return {
    connected: Boolean(supabase),
    message: supabase
      ? "Supabase connected"
      : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect",
  };
}
