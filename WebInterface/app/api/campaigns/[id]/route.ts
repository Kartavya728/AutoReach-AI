import { NextResponse } from "next/server";
import {
  serverGetCampaignById,
  serverUpdateCampaign,
  serverGetOptimizations,
  serverGetOptimizationHistory,
} from "@/src/lib/server/supabase";
import { fetchCampaignReportFromCampaignX } from "@/src/lib/server/campaignx";
import { computeAnalysisFromReport } from "@/src/lib/server/analysis";
import { serverGetCustomers } from "@/src/lib/server/customers";
import { generateOptimizationSuggestions } from "@/src/backend/optimization-agent";

import type { UpdateCampaignPayload, OptimizationSuggestionRow } from "@/src/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {

    const campaign = await serverGetCampaignById(params.id);
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Fetch optimization suggestions
    let optimizations: OptimizationSuggestionRow[] = [];
    try {
      optimizations = await serverGetOptimizations(params.id);
    } catch { /* ignore */ }

    // Fetch optimization history
    let optimizationHistory: any[] = [];
    try {
      optimizationHistory = await serverGetOptimizationHistory(params.id);
    } catch { /* ignore */ }

    // Always generate analysis — either from report data or from campaign.total_customers
    // The CampaignX sandbox never populates EO/EC so we always simulate
    let analysisReport: any = null;
    try {
      let reportRecords: any[] = [];
      if (campaign.external_campaign_id) {
        try {
          const reportResp = await fetchCampaignReportFromCampaignX(
            campaign.external_campaign_id
          );
          reportRecords = reportResp.data || [];
        } catch { /* can't fetch report — fall through to synthetic */ }
      }

      // If no records from API, create synthetic ones based on total_customers
      const totalSentCount = reportRecords.length > 0
        ? reportRecords.length
        : (campaign.total_customers || 0);

      if (totalSentCount > 0) {
        // Build a synthetic records array if needed
        const records = reportRecords.length > 0
          ? reportRecords
          : Array.from({ length: totalSentCount }, (_, i) => ({ EO: "N", EC: "N", customer_id: `CUST${i}`, send_time: "", invokation_time: "" }));

        // Fetch CRM customers for data-driven analysis breakdowns
        let crmCustomers;
        try { crmCustomers = await serverGetCustomers(); } catch { /* non-critical */ }

        analysisReport = computeAnalysisFromReport(
          campaign.external_campaign_id || campaign.id,
          records,
          campaign,
          crmCustomers
        );
      }
    } catch (err) {
      console.warn("[API] Could not compute analysis:", err);
    }

    return NextResponse.json({
      campaign,
      analysisReport,
      optimizations,
      optimizationHistory,
    });
  } catch (error) {
    console.error("[API/campaigns/[id]] GET Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch campaign", message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = (await request.json()) as UpdateCampaignPayload;
    const campaign = await serverUpdateCampaign(params.id, payload);
    return NextResponse.json(campaign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update campaign", message },
      { status: 500 }
    );
  }
}
