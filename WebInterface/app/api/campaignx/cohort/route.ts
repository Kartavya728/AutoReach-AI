import { NextResponse } from "next/server";
import { fetchCustomerCohortFromCampaignX } from "@/src/lib/server/campaignx";

export async function GET() {
  try {
    const cohort = await fetchCustomerCohortFromCampaignX();
    return NextResponse.json(cohort);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch customer cohort", message },
      { status: 500 }
    );
  }
}
