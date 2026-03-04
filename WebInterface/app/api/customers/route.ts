import { NextResponse } from "next/server";
import { serverGetCustomers } from "@/src/lib/server/customers";

export async function GET() {
  try {
    const customers = await serverGetCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    console.error("[API/customers] GET Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch customers", message },
      { status: 500 }
    );
  }
}
