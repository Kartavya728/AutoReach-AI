import type {
  GeneratedEmailVariant,
  GeminiCampaignRequest,
} from "@/src/lib/types";

export type { GeminiCampaignRequest, GeneratedEmailVariant } from "@/src/lib/types";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Request failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

export async function generateCampaignContent(
  request: GeminiCampaignRequest
): Promise<GeneratedEmailVariant[]> {
  const data = await postJson<{ variants: GeneratedEmailVariant[] }>(
    "/api/gemini/generate",
    request
  );
  return data.variants;
}

export async function analyzeCampaignPerformance(
  campaignData: Record<string, unknown>
): Promise<string> {
  const data = await postJson<{ analysis: string }>("/api/gemini/analyze", {
    campaignData,
  });
  return data.analysis;
}
