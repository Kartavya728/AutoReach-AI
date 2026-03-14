import { NextResponse } from "next/server";
import {
  serverGetCampaignById,
  serverUpdateCampaign,
  serverGetOptimizations,
  serverGetOptimizationHistory,
  serverSaveOptimizations,
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

    
    let optimizations: OptimizationSuggestionRow[] = [];
    try {
      optimizations = await serverGetOptimizations(params.id);
    } catch { 
 }

    
    let optimizationHistory: any[] = [];
    try {
      optimizationHistory = await serverGetOptimizationHistory(params.id);
    } catch { 
 }

    
    
    let analysisReport: any = null;
    try {
      let reportRecords: any[] = [];
      if (campaign.external_campaign_id) {
        try {
          const reportResp = await fetchCampaignReportFromCampaignX(
            campaign.external_campaign_id
          );
          reportRecords = reportResp.data || [];
        } catch { 
 }
      }

      
      const totalSentCount = reportRecords.length > 0
        ? reportRecords.length
        : (campaign.total_customers || 0);

      if (totalSentCount > 0) {
        
        const records = reportRecords.length > 0
          ? reportRecords
          : Array.from({ length: totalSentCount }, (_, i) => ({ EO: "N", EC: "N", customer_id: `CUST${i}`, send_time: "", invokation_time: "" }));

        
        let crmCustomers;
        try { crmCustomers = await serverGetCustomers(); } catch { 
 }

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

    
    if (optimizations.length === 0 && analysisReport && campaign.brief) {
      try {
        const generated = await generateOptimizationSuggestions(params.id, analysisReport, campaign.brief);
        if (generated && generated.length > 0) {
          
          const optRows = generated.map(s => ({
            ...s,
            campaign_id: params.id,
            id: crypto.randomUUID(), 
            created_at: new Date().toISOString()
          }));
          
          await serverSaveOptimizations(params.id, optRows);
          
          optimizations = optRows as OptimizationSuggestionRow[];
        }
      } catch (genErr) {
        console.warn("[API] Failed to generate initial optimizations:", genErr);
      }
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
