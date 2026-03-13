import { NextResponse } from "next/server";
import { fetchCampaignReportFromCampaignX } from "@/src/lib/server/campaignx";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");

    if (!campaignId) {
      return NextResponse.json(
        { error: "Missing required query parameter: campaign_id" },
        { status: 400 }
      );
    }

    const report = await fetchCampaignReportFromCampaignX(campaignId);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch campaign report", message },
      { status: 500 }
    );
  }
}
