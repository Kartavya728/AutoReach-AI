import { NextResponse } from "next/server";
import {
  serverGetCampaigns,
  serverCreateCampaign,
} from "@/src/lib/server/supabase";
import type { CreateCampaignPayload } from "@/src/lib/types";

export async function GET() {
  try {
    const campaigns = await serverGetCampaigns();
    return NextResponse.json(campaigns);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch campaigns", message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateCampaignPayload;
    if (!payload.name || !payload.brief) {
      return NextResponse.json(
        { error: "Missing required fields: name, brief" },
        { status: 400 }
      );
    }

    const campaign = await serverCreateCampaign(payload);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create campaign", message },
      { status: 500 }
    );
  }
}
