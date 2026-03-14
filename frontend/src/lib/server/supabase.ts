import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getServerConfig } from "@/src/lib/server/env";
import type {
  CampaignRow,
  CampaignRunRow,
  CreateCampaignRunPayload,
  CampaignVariantRow,
  OptimizationSuggestionRow,
  OptimizationHistoryRow,
  CreateCampaignPayload,
  UpdateCampaignPayload,
} from "@/src/lib/types";

function getSupabaseAdminClient(): SupabaseClient | null {
  const config = getServerConfig();
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return null;
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function requireAdminClient(): SupabaseClient {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase not configured (missing URL or service role key)");
  }
  return client;
}

// ── Agent Trace (original) ──

export async function persistAgentTrace(trace: {
  run_id: string;
  agent_name: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  status: "success" | "error";
  latency_ms?: number;
}) {
  const client = getSupabaseAdminClient();
  if (!client) return;
  await client.from("agent_traces").insert(trace);
}

// ── Campaigns ──

export async function serverGetCampaigns(): Promise<CampaignRow[]> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaigns")
    .select("*, campaign_variants(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CampaignRow[];
}

export async function serverGetCampaignById(id: string): Promise<CampaignRow | null> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaigns")
    .select("*, campaign_variants(*)")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as CampaignRow) ?? null;
}

export async function serverCreateCampaign(payload: CreateCampaignPayload): Promise<CampaignRow> {
  const client = requireAdminClient();
  const { variants, ...campaignData } = payload;

  const { data: campaign, error } = await client
    .from("campaigns")
    .insert(campaignData)
    .select()
    .single();

  if (error) throw error;

  if (variants && variants.length > 0) {
    const variantRows = variants.map((v) => ({
      ...v,
      campaign_id: campaign.id,
    }));
    const { error: variantError } = await client
      .from("campaign_variants")
      .insert(variantRows);

    if (variantError) {
      console.warn("[Supabase] Failed to save variants:", variantError);
    }
  }

  // Re-fetch with variants joined
  const full = await serverGetCampaignById(campaign.id);
  return full ?? (campaign as CampaignRow);
}

// —— Campaign Analysis Runs ——

export async function serverGetCampaignRuns(): Promise<CampaignRunRow[]> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaign_analysis_runs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CampaignRunRow[];
}

export async function serverGetCampaignRunById(id: string): Promise<CampaignRunRow | null> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaign_analysis_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as CampaignRunRow) ?? null;
}

export async function serverCreateCampaignRun(payload: CreateCampaignRunPayload): Promise<CampaignRunRow> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaign_analysis_runs")
    .insert({
      ...payload,
      round_history: payload.round_history ?? [],
      improvements: payload.improvements ?? [],
      agent_categories: payload.agent_categories ?? [],
      final_mails: payload.final_mails ?? [],
      tools_used: payload.tools_used ?? [],
      terminal_logs: payload.terminal_logs ?? [],
      messages: payload.messages ?? [],
      segments: payload.segments ?? [],
      twin_cards: payload.twin_cards ?? [],
      raw_payload: payload.raw_payload ?? null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as CampaignRunRow;
}

export async function serverUpdateCampaignRun(
  id: string,
  payload: Partial<CreateCampaignRunPayload>
): Promise<CampaignRunRow> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaign_analysis_runs")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as CampaignRunRow;
}

export async function serverUpdateCampaign(
  id: string,
  payload: UpdateCampaignPayload
): Promise<CampaignRow> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaigns")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as CampaignRow;
}

// ── Campaign Variants ──

export async function serverSaveVariants(
  campaignId: string,
  variants: Omit<CampaignVariantRow, "id" | "campaign_id" | "created_at">[]
): Promise<CampaignVariantRow[]> {
  const client = requireAdminClient();

  // Replace variants
  await client.from("campaign_variants").delete().eq("campaign_id", campaignId);

  const rows = variants.map((v) => ({ ...v, campaign_id: campaignId }));
  const { data, error } = await client
    .from("campaign_variants")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data ?? []) as CampaignVariantRow[];
}

// ── Optimization Suggestions ──

export async function serverGetOptimizations(
  campaignId: string
): Promise<OptimizationSuggestionRow[]> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("optimization_suggestions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OptimizationSuggestionRow[];
}

export async function serverSaveOptimizations(
  campaignId: string,
  suggestions: Omit<OptimizationSuggestionRow, "id" | "campaign_id" | "created_at">[]
): Promise<OptimizationSuggestionRow[]> {
  const client = requireAdminClient();
  const rows = suggestions.map((s) => ({ ...s, campaign_id: campaignId }));
  const { data, error } = await client
    .from("optimization_suggestions")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data ?? []) as OptimizationSuggestionRow[];
}

// ── Optimization History ──

export async function serverGetOptimizationHistory(
  campaignId: string
): Promise<OptimizationHistoryRow[]> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaign_optimization_history")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("round", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OptimizationHistoryRow[];
}

export async function serverSaveOptimizationHistory(
  history: Omit<OptimizationHistoryRow, "id" | "created_at">
): Promise<OptimizationHistoryRow> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("campaign_optimization_history")
    .insert(history)
    .select()
    .single();

  if (error) throw error;
  return data as OptimizationHistoryRow;
}
