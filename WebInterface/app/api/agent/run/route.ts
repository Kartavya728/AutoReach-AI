import { NextResponse } from "next/server";
import { runCampaignLangGraph } from "@/src/lib/server/langgraph";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { brief?: string };
    const brief = payload.brief?.trim();
    if (!brief) {
      return NextResponse.json(
        { error: "Missing required field: brief" },
        { status: 400 }
      );
    }

    const result = await runCampaignLangGraph(brief);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to execute LangGraph workflow", message },
      { status: 500 }
    );
  }
}
