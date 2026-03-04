import { createClient } from "@supabase/supabase-js";
import { getServerConfig } from "@/src/lib/server/env";

function getSupabaseAdminClient() {
  const config = getServerConfig();
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    return null;
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function persistAgentTrace(trace: {
  run_id: string;
  agent_name: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  status: "success" | "error";
  latency_ms?: number;
}) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return;
  }

  await client.from("agent_traces").insert(trace);
}
