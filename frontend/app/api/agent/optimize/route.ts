import { NextResponse } from "next/server";
import { getServerConfig } from "@/src/lib/server/env";
import type { OptimizeRequest } from "@/src/lib/types";



export async function POST(request: Request) {
  try {
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

    const config = getServerConfig();
    const pythonUrl = config.pythonAgentUrl;

    
    const response = await fetch(`${pythonUrl}/optimize_campaign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: payload.campaignId,
        approvedSuggestions: payload.approvedSuggestions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Python optimization agent failed", message: errorText },
        { status: response.status }
      );
    }

    const report = await response.json();
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Optimization failed", message },
      { status: 500 }
    );
  }
}
