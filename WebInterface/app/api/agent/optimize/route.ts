import { NextResponse } from "next/server";
import { runOptimizationAgent } from "@/src/lib/server/optimize";
import { configureLangSmithTracing } from "@/src/lib/server/langsmith";
import type { OptimizeRequest } from "@/src/lib/types";

export async function POST(request: Request) {
  try {
    configureLangSmithTracing();
    const payload = (await request.json()) as OptimizeRequest;

    if (!payload.campaignId) {
      return NextResponse.json(
        { error: "Missing required field: campaignId" },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(payload.approvedSuggestions) ||
      payload.approvedSuggestions.length === 0
    ) {
      return NextResponse.json(
        { error: "At least one approved suggestion is required" },
        { status: 400 }
      );
    }

    const report = await runOptimizationAgent(
      payload.campaignId,
      payload.approvedSuggestions
    );

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Optimization failed", message },
      { status: 500 }
    );
  }
}
