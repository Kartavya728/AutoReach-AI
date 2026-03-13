import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  CampaignRow,
  CampaignVariantRow,
  OptimizationSuggestionRow,
  CreateCampaignPayload,
  UpdateCampaignPayload,
  DashboardStats,
} from "@/src/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

function requireClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return supabase;
}

// ── Campaigns ──

export async function getCampaigns(): Promise<CampaignRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("campaigns")
    .select("*, campaign_variants(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CampaignRow[];
}

export async function getCampaignById(id: string): Promise<CampaignRow | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("campaigns")
    .select("*, campaign_variants(*)")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as CampaignRow) ?? null;
}

export async function getCampaignByExternalId(externalId: string): Promise<CampaignRow | null> {
  const client = requireClient();
  const { data, error } = await client
    .from("campaigns")
    .select("*, campaign_variants(*)")
    .eq("external_campaign_id", externalId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as CampaignRow) ?? null;
}

export async function saveCampaign(payload: CreateCampaignPayload): Promise<CampaignRow> {
  const client = requireClient();
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

  return campaign as CampaignRow;
}

export async function updateCampaign(
  id: string,
  payload: UpdateCampaignPayload
): Promise<CampaignRow> {
  const client = requireClient();
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

export async function saveCampaignVariants(
  campaignId: string,
  variants: Omit<CampaignVariantRow, "id" | "campaign_id" | "created_at">[]
): Promise<CampaignVariantRow[]> {
  const client = requireClient();

  // Delete existing variants first, then insert new ones
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

export async function getOptimizationSuggestions(
  campaignId: string
): Promise<OptimizationSuggestionRow[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("optimization_suggestions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as OptimizationSuggestionRow[];
}

export async function saveOptimizationSuggestions(
  campaignId: string,
  suggestions: Omit<OptimizationSuggestionRow, "id" | "campaign_id" | "created_at">[]
): Promise<OptimizationSuggestionRow[]> {
  const client = requireClient();

  const rows = suggestions.map((s) => ({ ...s, campaign_id: campaignId }));
  const { data, error } = await client
    .from("optimization_suggestions")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data ?? []) as OptimizationSuggestionRow[];
}

export async function updateOptimizationStatus(
  id: string,
  status: "approved" | "rejected"
): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from("optimization_suggestions")
    .update({
      status,
      ...(status === "approved"
        ? { approved_at: new Date().toISOString(), approved_by: "user" }
        : {}),
    })
    .eq("id", id);

  if (error) throw error;
}

// ── Dashboard Stats ──

export async function getDashboardStats(): Promise<DashboardStats> {
  const campaigns = await getCampaigns();

  const totalCampaigns = campaigns.length;
  const totalCustomersReached = campaigns.reduce(
    (sum, c) => sum + (c.total_customers || 0),
    0
  );

  const withMetrics = campaigns.filter(
    (c) => c.open_rate != null && c.click_rate != null
  );
  const avgOpenRate =
    withMetrics.length > 0
      ? Math.round(
          (withMetrics.reduce((s, c) => s + (c.open_rate ?? 0), 0) /
            withMetrics.length) *
            10
        ) / 10
      : 0;
  const avgClickRate =
    withMetrics.length > 0
      ? Math.round(
          (withMetrics.reduce((s, c) => s + (c.click_rate ?? 0), 0) /
            withMetrics.length) *
            10
        ) / 10
      : 0;

  const activeOptimizations = campaigns.filter(
    (c) => c.status === "active"
  ).length;
  const pendingApprovals = campaigns.filter(
    (c) => c.status === "pending_approval"
  ).length;

  return {
    totalCampaigns,
    totalCustomersReached,
    avgOpenRate,
    avgClickRate,
    activeOptimizations,
    pendingApprovals,
  };
}

// ── Status check ──

export function getSupabaseStatus() {
  return {
    connected: Boolean(supabase),
    message: supabase
      ? "Supabase connected"
      : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect",
  };
}
