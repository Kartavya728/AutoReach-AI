import { NextResponse } from "next/server";
import { analyzePerformanceWithGemini } from "@/src/lib/server/gemini";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      campaignData?: Record<string, unknown>;
    };
    const campaignData = payload.campaignData ?? {};
    const analysis = await analyzePerformanceWithGemini(campaignData);
    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to analyze campaign performance", message },
      { status: 500 }
    );
  }
}
