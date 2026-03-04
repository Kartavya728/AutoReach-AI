import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerConfig, requireServerEnv } from "@/src/lib/server/env";
import type {
  GeneratedEmailVariant,
  GeminiCampaignRequest,
} from "@/src/lib/types";

function getGeminiModel() {
  const config = getServerConfig();
  const apiKey = requireServerEnv("GEMINI_API_KEY");
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({
    model: config.geminiModel ?? "gemini-2.0-flash",
  });
}

function parseJsonBlock(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }
  const jsonStart = trimmed.indexOf("[");
  const jsonEnd = trimmed.lastIndexOf("]");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  }
  throw new Error("Gemini response did not include a valid JSON array");
}

export async function generateVariantsWithGemini(
  request: GeminiCampaignRequest
): Promise<GeneratedEmailVariant[]> {
  const model = getGeminiModel();
  const prompt = [
    "You are a BFSI email marketing expert.",
    "Generate exactly 3 campaign variants as JSON array.",
    "Each object must contain keys: subject, body, variant, tone, tags.",
    "Use concise, production-ready language.",
    `Tone preference: ${request.tone ?? "professional"}.`,
    `Emoji usage: ${request.useEmojis ? "enabled" : "disabled"}.`,
    `Temperature guidance: ${request.temperature ?? 0.7}.`,
    request.additionalParams ? `Additional constraints: ${request.additionalParams}` : "",
    `Campaign brief: ${request.brief}`,
    "Return JSON only. No markdown.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = parseJsonBlock(text);

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini returned non-array data for campaign variants");
  }

  return parsed.slice(0, 3).map((item, index) => {
    const safe = (item ?? {}) as Record<string, unknown>;
    const subject = String(safe.subject ?? `Campaign Variant ${index + 1}`);
    const body = String(safe.body ?? "");
    const variant = String(safe.variant ?? String.fromCharCode(65 + index));
    const tone = String(safe.tone ?? request.tone ?? "professional");
    const tags = Array.isArray(safe.tags)
      ? safe.tags.map((tag) => String(tag))
      : [];

    return { subject, body, variant, tone, tags };
  });
}

export async function analyzePerformanceWithGemini(
  campaignData: Record<string, unknown>
): Promise<string> {
  const model = getGeminiModel();
  const prompt = [
    "You are a campaign performance analyst for BFSI email marketing.",
    "Analyze the data below and return:",
    "1) Key findings",
    "2) Recommended actions",
    "3) Estimated uplift impact",
    JSON.stringify(campaignData, null, 2),
  ].join("\n");

  const result = await model.generateContent(prompt);
  return result.response.text();
}
