import { NextResponse } from "next/server";
import { serverGetCustomers } from "@/src/lib/server/customers";

// Prevent Next.js from caching this route — always fetch fresh data from Supabase
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const customers = await serverGetCustomers();
    return NextResponse.json(
      { customers },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  } catch (error) {
    console.error("[API/customers] GET Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch customers", message },
      { status: 500 }
    );
  }
}
