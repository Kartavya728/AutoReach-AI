import { NextResponse } from "next/server";
import { fetchCustomerCohortFromCampaignX } from "@/src/lib/server/campaignx";
import { serverUpsertCustomers } from "@/src/lib/server/customers";

export async function POST(request: Request) {
  try {
    const cohortResponse = await fetchCustomerCohortFromCampaignX();
    
    if (!cohortResponse.data || cohortResponse.data.length === 0) {
      return NextResponse.json({ message: "No customers returned from external API" }, { status: 404 });
    }

    const customersToUpsert = cohortResponse.data.map((raw: any) => ({
      customer_id: raw.customer_id,
      email: raw.email,
      full_name: raw.Full_name || raw.name,
      age: raw.Age ?? raw.age,
      gender: raw.Gender ?? raw.gender,
      marital_status: raw.Marital_Status,
      family_size: raw.Family_Size,
      dependent_count: raw["Dependent count"],
      occupation: raw.Occupation,
      occupation_type: raw["Occupation type"],
      monthly_income: raw.Monthly_Income,
      kyc_status: raw["KYC status"],
      city: raw.City ?? raw.region,
      kids_in_household: raw.Kids_in_Household,
      app_installed: raw.App_Installed,
      existing_customer: raw["Existing Customer"],
      credit_score: raw["Credit score"],
      social_media_active: raw.Social_Media_Active,
      
      
    }));

    await serverUpsertCustomers(customersToUpsert);

    return NextResponse.json({
      success: true,
      count: customersToUpsert.length,
      message: "Customers synced successfully",
    });
  } catch (error) {
    console.error("[API/customers/sync] Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to sync customers", message }, { status: 500 });
  }
}
