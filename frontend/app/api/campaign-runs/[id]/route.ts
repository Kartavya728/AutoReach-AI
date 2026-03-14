import { NextResponse } from "next/server";
import {
  serverGetCampaignRunById,
  serverUpdateCampaignRun,
} from "@/src/lib/server/supabase";
import type { CreateCampaignRunPayload } from "@/src/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const run = await serverGetCampaignRunById(params.id);
    if (!run) {
      return NextResponse.json(
        { error: "Campaign run not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch campaign run", message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const input = (await request.json()) as Partial<CreateCampaignRunPayload>;

    const payload: Partial<CreateCampaignRunPayload> = {
      campaign_name: input.campaign_name?.trim(),
      prompt: input.prompt?.trim(),
      cta_link: input.cta_link?.trim() || undefined,
      phase: input.phase,
      total_rounds:
        input.total_rounds == null ? undefined : Math.max(0, Number(input.total_rounds)),
      total_sent:
        input.total_sent == null ? undefined : Math.max(0, Number(input.total_sent)),
      total_opened:
        input.total_opened == null ? undefined : Math.max(0, Number(input.total_opened)),
      total_clicked:
        input.total_clicked == null ? undefined : Math.max(0, Number(input.total_clicked)),
      open_rate: input.open_rate == null ? undefined : Number(input.open_rate),
      click_rate: input.click_rate == null ? undefined : Number(input.click_rate),
      metrics: input.metrics ?? undefined,
      round_history: input.round_history ?? undefined,
      improvements: input.improvements ?? undefined,
      agent_categories: input.agent_categories ?? undefined,
      final_mails: input.final_mails ?? undefined,
      tools_used: input.tools_used ?? undefined,
      terminal_logs: input.terminal_logs ?? undefined,
      messages: input.messages ?? undefined,
      segments: input.segments ?? undefined,
      twin_cards: input.twin_cards ?? undefined,
      raw_payload: input.raw_payload ?? undefined,
    };

    const updated = await serverUpdateCampaignRun(params.id, payload);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update campaign run", message },
      { status: 500 }
    );
  }
}
