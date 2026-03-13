import { requireAdminClient } from "@/src/lib/server/supabase";
import type { CustomerCRMRecord } from "@/src/lib/types";

export async function serverUpsertCustomers(customers: Partial<CustomerCRMRecord>[]) {
  const client = requireAdminClient();
  const CHUNK_SIZE = 1000;

  for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
    const chunk = customers.slice(i, i + CHUNK_SIZE);

    // Upsert by customer_id
    const { error } = await client
      .from("customers")
      .upsert(chunk, { onConflict: "customer_id" });

    if (error) {
      console.error("[Supabase] Failed to upsert customers chunk:", error);
      throw error;
    }
  }

  return customers;
}

export async function serverGetCustomers(): Promise<CustomerCRMRecord[]> {
  const client = requireAdminClient();

  let allData: any[] = [];
  let from = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await client
      .from("customers")
      .select("*")
      .order("customer_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[Supabase] Failed to fetch customers:", error);
      throw error;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) {
        break; // Reached the end
      }
      from += PAGE_SIZE;
    } else {
      break; // No more data
    }
  }

  return allData as CustomerCRMRecord[];
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

export async function serverBulkIncrementCustomerMetrics(
  updates: { customer_id: string; sent: number; opened: number; clicked: number }[]
) {
  if (updates.length === 0) return;
  const client = requireAdminClient();
  const CHUNK_SIZE = 1000;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map((u) => u.customer_id);

    // Fetch existing metrics and all other non-null columns to satisfy constraints
    const { data: existingCustomers, error: fetchError } = await client
      .from("customers")
      .select("*")
      .in("customer_id", ids);

    if (fetchError || !existingCustomers) {
      console.error("[Supabase] Failed to fetch customers for bulk update:", fetchError);
      continue;
    }

    const updatesMap = new Map(chunk.map((u) => [u.customer_id, u]));

    const upsertPayload = existingCustomers.map((c: any) => {
      const u = updatesMap.get(c.customer_id);
      return {
        ...c, // Preserve all existing columns
        emails_sent: (c.emails_sent || 0) + (u?.sent || 0),
        emails_opened: (c.emails_opened || 0) + (u?.opened || 0),
        emails_clicked: (c.emails_clicked || 0) + (u?.clicked || 0),
        updated_at: new Date().toISOString(),
      };
    });

    if (upsertPayload.length > 0) {
      const { error: upsertError } = await client
        .from("customers")
        .upsert(upsertPayload, { onConflict: "id" });

      if (upsertError) {
        console.error("[Supabase] Failed to bulk update metrics:", upsertError);
      }
    }
  }
}
