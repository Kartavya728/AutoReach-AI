import { NextResponse } from "next/server";
import { sendCampaignToCampaignX } from "@/src/lib/server/campaignx";
import { serverBulkIncrementCustomerMetrics } from "@/src/lib/server/customers";
import type { SendCampaignRequest } from "@/src/lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SendCampaignRequest;
    const result = await sendCampaignToCampaignX(payload);

    // Increment the UI metrics
    if (payload.list_customer_ids && payload.list_customer_ids.length > 0) {
      try {
        await serverBulkIncrementCustomerMetrics(
          payload.list_customer_ids.map(id => {
            // Simulate open/click probabilistically for sandbox realism
            const rand = Math.random();
            const opened = rand > 0.45 ? 1 : 0; // ~55% open rate
            const clicked = opened && Math.random() > 0.6 ? 1 : 0; // ~40% click-to-open
            return {
              customer_id: id,
              sent: 1,
              opened: opened,
              clicked: clicked
            };
          })
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
