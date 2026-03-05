import { NextResponse } from "next/server";
import {
  serverGetCampaignById,
  serverUpdateCampaign,
  serverGetOptimizations,
} from "@/src/lib/server/supabase";
import { fetchCampaignReportFromCampaignX } from "@/src/lib/server/campaignx";
import { computeAnalysisFromReport } from "@/src/lib/server/analysis";
import { generateOptimizationSuggestions } from "@/src/lib/server/optimize";
import { configureLangSmithTracing } from "@/src/lib/server/langsmith";
import type { UpdateCampaignPayload, OptimizationSuggestionRow } from "@/src/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    configureLangSmithTracing();
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
        // Build a synthetic records array if needed (only used for totalSent count inside computeAnalysisFromReport)
        const records = reportRecords.length > 0
          ? reportRecords
          : Array.from({ length: totalSentCount }, (_, i) => ({ EO: "N", EC: "N", customer_id: `CUST${i}`, send_time: "", invokation_time: "" }));

        analysisReport = computeAnalysisFromReport(
          campaign.external_campaign_id || campaign.id,
          records,
          campaign
        );

        // Update cached metrics in Supabase
        try {
          await serverUpdateCampaign(params.id, {
            open_rate: analysisReport.openRate,
            click_rate: analysisReport.clickRate,
            total_opened: analysisReport.totalOpened,
            total_clicked: analysisReport.totalClicked,
          });
        } catch { /* non-critical */ }

          // Generate AI optimization suggestions if none exist
          if (optimizations.length === 0 && (analysisReport?.totalSent || 0) > 0) {
            try {
              const { serverSaveOptimizations } = await import(
                "@/src/lib/server/supabase"
              );
              const suggestions = await generateOptimizationSuggestions(
                params.id,
                analysisReport!,
                campaign.brief
              );
              optimizations = await serverSaveOptimizations(
                params.id,
                suggestions
              );
            } catch (err) {
              console.warn("[API] Failed to generate optimizations:", err);
            }
          }
      }
    } catch (err) {
      console.warn("[API] Could not compute analysis:", err);
    }

    return NextResponse.json({
      campaign,
      analysisReport,
      optimizations,
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
