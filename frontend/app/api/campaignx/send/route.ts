import { NextResponse } from "next/server";
import { sendCampaignToCampaignX } from "@/src/lib/server/campaignx";
import { serverBulkIncrementCustomerMetrics } from "@/src/lib/server/customers";
import type { SendCampaignRequest } from "@/src/lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SendCampaignRequest;
    const result = await sendCampaignToCampaignX(payload);

   
    if (payload.list_customer_ids && payload.list_customer_ids.length > 0) {
      try {
        await serverBulkIncrementCustomerMetrics(
          payload.list_customer_ids.map(id => ({
            customer_id: id,
            sent: 1,
            opened: 0,
            clicked: 0
          }))
        );
      } catch (err) {
        console.error("Failed to increment metrics:", err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to send campaign", message },
      { status: 500 }
    );
  }
}
