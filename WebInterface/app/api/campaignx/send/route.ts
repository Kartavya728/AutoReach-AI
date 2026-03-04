import { NextResponse } from "next/server";
import { sendCampaignToCampaignX } from "@/src/lib/server/campaignx";
import type { SendCampaignRequest } from "@/src/lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SendCampaignRequest;
    const result = await sendCampaignToCampaignX(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to send campaign", message },
      { status: 500 }
    );
  }
}
