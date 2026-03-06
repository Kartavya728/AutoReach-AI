import type { CampaignAgentResponse, CampaignAgentStep } from "@/src/lib/types";

export interface AgentState {
  brief: string;
  strategy: string | null;
  contentVariants: unknown[];
  humanApproved: boolean;
  campaignId: string | null;
  performanceData: unknown | null;
  optimizations: unknown[];
  iteration: number;
  customerCount: number;
  savedCampaignId: string | null;
  targetCustomerIds: string[];
}

/**
 * Run the campaign AI agent with **real-time SSE streaming**.
 * Each step from the LangGraph pipeline is streamed as an SSE event so the
 * UI can show progress immediately instead of waiting for the full response.
 */
export async function runCampaignAgent(
  brief: string,
  onProgress: (step: string, agent: string) => void
): Promise<AgentState> {
  const response = await fetch("/api/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LangGraph execution failed: ${errorBody}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  // ── SSE Streaming Path ──
  if (contentType.includes("text/event-stream") && response.body) {
    return readSSEStream(response.body, onProgress);
  }

  // ── Fallback: legacy JSON response ──
  const data = (await response.json()) as CampaignAgentResponse & { savedCampaignId?: string };
  for (const item of data.steps) {
    onProgress(item.step, item.agent);
  }
  return mapResponseToState(data);
}

/**
 * Read an SSE stream from the agent API and emit progress events in real-time.
 */
async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onProgress: (step: string, agent: string) => void
): Promise<AgentState> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages (delimited by double newlines)
    const messages = buffer.split("\n\n");
    // Keep the last potentially-incomplete chunk in the buffer
    buffer = messages.pop() ?? "";

    for (const msg of messages) {
      if (!msg.trim()) continue;

      const eventMatch = msg.match(/^event:\s*(.+)$/m);
      const dataMatch = msg.match(/^data:\s*(.+)$/m);

      if (!dataMatch) continue;

      const eventType = eventMatch?.[1]?.trim() ?? "message";
      let data: any;
      try {
        data = JSON.parse(dataMatch[1]);
      } catch {
        continue;
      }

      switch (eventType) {
        case "step":
          if (data.step && data.agent) {
            onProgress(data.step, data.agent);
          }
          break;
        case "done":
          finalResult = data;
          break;
        case "error":
          throw new Error(data.message ?? data.error ?? "Agent execution failed");
        default:
          break;
      }
    }
  }

  if (!finalResult) {
    throw new Error("SSE stream ended without a 'done' event");
  }

  return mapResponseToState(finalResult);
}

/** Map the raw API response into the typed AgentState */
function mapResponseToState(data: any): AgentState {
  return {
    brief: data.brief ?? "",
    strategy: data.strategy ?? null,
    contentVariants: data.contentVariants ?? [],
    humanApproved: false,
    campaignId: null,
    performanceData: null,
    optimizations: [],
    iteration: 1,
    customerCount: data.customerCount ?? 0,
    savedCampaignId: data.savedCampaignId ?? null,
    targetCustomerIds: data.targetCustomerIds ?? [],
  };
}

export function stepsFromAgentResult(data: CampaignAgentResponse): CampaignAgentStep[] {
  return data.steps;
}
