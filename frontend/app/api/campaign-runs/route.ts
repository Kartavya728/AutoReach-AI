import { NextResponse } from "next/server";
import {
  serverCreateCampaignRun,
  serverGetCampaignRuns,
} from "@/src/lib/server/supabase";
import type { CreateCampaignRunPayload } from "@/src/lib/types";

export async function GET() {
  try {
    const runs = await serverGetCampaignRuns();
    return NextResponse.json(runs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch campaign runs", message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Partial<CreateCampaignRunPayload>;
    if (!input.prompt || !input.prompt.trim()) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }

    const campaignName =
      input.campaign_name?.trim() ||
      input.prompt.trim().split("\n")[0].slice(0, 80) ||
      "Untitled Campaign";

    const payload: CreateCampaignRunPayload = {
      campaign_name: campaignName,
      prompt: input.prompt.trim(),
      cta_link: input.cta_link?.trim() || undefined,
      phase: input.phase || "complete",
      total_rounds: Math.max(0, Number(input.total_rounds ?? 0)),
      total_sent: Math.max(0, Number(input.total_sent ?? 0)),
      total_opened: Math.max(0, Number(input.total_opened ?? 0)),
      total_clicked: Math.max(0, Number(input.total_clicked ?? 0)),
      open_rate: Number(input.open_rate ?? 0),
      click_rate: Number(input.click_rate ?? 0),
      metrics: input.metrics ?? null,
      round_history: input.round_history ?? [],
      improvements: input.improvements ?? [],
      agent_categories: input.agent_categories ?? [],
      final_mails: input.final_mails ?? [],
      tools_used: input.tools_used ?? [],
      terminal_logs: input.terminal_logs ?? [],
      messages: input.messages ?? [],
      segments: input.segments ?? [],
      twin_cards: input.twin_cards ?? [],
      raw_payload: input.raw_payload ?? null,
    };

    const created = await serverCreateCampaignRun(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to save campaign run", message },
      { status: 500 }
    );
  }
}
