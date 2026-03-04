import { NextResponse } from "next/server";
import { AVAILABLE_MODELS } from "@/src/lib/server/env";

export async function GET() {
  return NextResponse.json({ models: AVAILABLE_MODELS });
}
