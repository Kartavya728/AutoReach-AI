import { requireAdminClient } from "@/src/lib/server/supabase";
import type { CustomerCRMRecord } from "@/src/lib/types";

export async function serverUpsertCustomers(customers: Partial<CustomerCRMRecord>[]) {
  const client = requireAdminClient();

  // Upsert by customer_id
  const { data, error } = await client
    .from("customers")
    .upsert(customers, { onConflict: "customer_id" })
    .select();

  if (error) {
    console.error("[Supabase] Failed to upsert customers:", error);
    throw error;
  }
  return data;
}

export async function serverGetCustomers(): Promise<CustomerCRMRecord[]> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("customers")
    .select("*")
    .order("customer_id", { ascending: true });

  if (error) {
    console.error("[Supabase] Failed to fetch customers:", error);
    throw error;
  }
  return data as CustomerCRMRecord[];
}

export async function serverUpdateCustomerWeights(
  customerId: string,
  w1: number,
  w2: number,
  w3: number
) {
  const client = requireAdminClient();
  const { error } = await client
    .from("customers")
    .update({ w1, w2, w3, updated_at: new Date().toISOString() })
    .eq("customer_id", customerId);

  if (error) {
    console.error(`[Supabase] Failed to update weights for ${customerId}:`, error);
    throw error;
  }
}

export async function serverIncrementCustomerMetrics(
  customerId: string,
  metrics: { sent?: number; opened?: number; clicked?: number; topic?: string }
) {
  const client = requireAdminClient();
  const { data: customer } = await client
    .from("customers")
    .select("emails_sent, emails_opened, emails_clicked, topics_list")
    .eq("customer_id", customerId)
    .single();

  if (!customer) return;

  const newTopics = metrics.topic
    ? Array.from(new Set([...(customer.topics_list || []), metrics.topic]))
    : customer.topics_list;

  const { error } = await client
    .from("customers")
    .update({
      emails_sent: customer.emails_sent + (metrics.sent || 0),
      emails_opened: customer.emails_opened + (metrics.opened || 0),
      emails_clicked: customer.emails_clicked + (metrics.clicked || 0),
      topics_list: newTopics,
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", customerId);

  if (error) {
    console.error(`[Supabase] Failed to update metrics for ${customerId}:`, error);
  }
}
