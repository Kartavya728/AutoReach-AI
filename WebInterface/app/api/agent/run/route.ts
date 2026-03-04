import { NextResponse } from "next/server";
import { runCampaignLangGraph } from "@/src/lib/server/langgraph";
import { serverCreateCampaign } from "@/src/lib/server/supabase";
import type { GeneratedEmailVariant } from "@/src/lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { brief?: string; campaignName?: string };
    const brief = payload.brief?.trim();
    if (!brief) {
      return NextResponse.json(
        { error: "Missing required field: brief" },
        { status: 400 }
      );
    }

    const result = await runCampaignLangGraph(brief);
    const contentVariants = (result.contentVariants || []) as GeneratedEmailVariant[];

    // Save campaign to Supabase
    let savedCampaign = null;
    try {
      const variants = contentVariants.map((v, i) => ({
        variant_label: v.variant || String.fromCharCode(65 + i),
        subject: v.subject || `Variant ${String.fromCharCode(65 + i)}`,
        body: v.body || "",
        tone: v.tone || "professional",
        tags: v.tags || [],
        is_selected: i === 0,
      }));

      savedCampaign = await serverCreateCampaign({
        name: payload.campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
        brief,
        subject: variants[0]?.subject || "",
        body: variants[0]?.body || "",
        target_segment: "all",
        target_customer_ids: (result as any).targetCustomerIds || [],
        strategy_reasoning: (result as any).strategyReasoning || "",
        json_output: { "strategy": result.strategy, "strategyReasoning": result.strategyReasoning },
        total_customers: Number(result.customerCount) || 0,
        temperature: 0.7,
        use_emojis: true,
        tone: "friendly",
        variants,
      });
    } catch (err) {
      console.warn("[Agent] Failed to save campaign to Supabase:", err);
    }

    return NextResponse.json({
      ...result,
      savedCampaignId: savedCampaign?.id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to execute LangGraph workflow", message },
      { status: 500 }
    );
  }
}
