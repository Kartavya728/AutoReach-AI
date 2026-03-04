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
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const data = (await response.json()) as CampaignAgentResponse;

  for (const item of data.steps) {
    await wait(450);
    onProgress(item.step, item.agent);
  }

  return {
    brief: data.brief,
    strategy: data.strategy,
    contentVariants: data.contentVariants,
    humanApproved: false,
    campaignId: null,
    performanceData: null,
    optimizations: [],
    iteration: 1,
  };
}

export function stepsFromAgentResult(data: CampaignAgentResponse): CampaignAgentStep[] {
  return data.steps;
}
