import { NextResponse } from "next/server";
import { generateVariantsWithGemini } from "@/src/lib/server/gemini";
import type { GeminiCampaignRequest } from "@/src/lib/types";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GeminiCampaignRequest;
    if (!payload.brief?.trim()) {
      return NextResponse.json(
        { error: "Missing required field: brief" },
        { status: 400 }
      );
    }

    const variants = await generateVariantsWithGemini(payload);
    return NextResponse.json({ variants });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate campaign content", message },
      { status: 500 }
    );
  }
}
