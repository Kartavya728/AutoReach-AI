import { fetchCustomerCohortFromCampaignX, sendCampaignToCampaignX, fetchCampaignReportFromCampaignX } from "./WebInterface/src/lib/server/campaignx.js";
import dotenv from "dotenv";

dotenv.config({ path: "./WebInterface/.env" });

async function autoOptimizeLoop() {
  console.log("Fetching cohort from CampaignX...");
  const cohortResponse = await fetchCustomerCohortFromCampaignX();
  const allCustomers = cohortResponse.data;

  console.log(`Loaded ${allCustomers.length} customers. Generating test segments...`);
  
  // Filter for subset segment (the user was hitting 'all' because the fallback didn't work)
  // Let's test the 'South India + Female' insight that the UI suggested earlier since that might be the key.
  
  const testSubsets = [
    {
       name: "Region: South India, Gender: Female, Age: 26-45",
       ids: allCustomers.filter(c => c.region === "South India" && c.gender === "Female" && c.age >= 26 && c.age <= 45).map(c => c.customer_id)
    },
    {
       name: "High Income Professionals",
       ids: allCustomers.filter(c => c.income_level === "High" && c.occupation === "Professional").map(c => c.customer_id)
    },
    {
       name: "Top w1 Scorer (30%)",
       ids: allCustomers.sort((a,b) => b.w1 - a.w1).slice(0, Math.floor(allCustomers.length * 0.3)).map(c => c.customer_id)
    },
    {
       name: "Top w2 Scorer (20%)",
       ids: allCustomers.sort((a,b) => b.w2 - a.w2).slice(0, Math.floor(allCustomers.length * 0.2)).map(c => c.customer_id)
    },
    {
       name: "Top w3 Scorer (15%)",
       ids: allCustomers.sort((a,b) => b.w3 - a.w3).slice(0, Math.floor(allCustomers.length * 0.15)).map(c => c.customer_id)
    }
  ];

  for (const subset of testSubsets) {
     console.log(`\nTesting Subset: ${subset.name} (Count: ${subset.ids.length})`);
     if (subset.ids.length === 0) continue;

     try {
       const sendRes = await sendCampaignToCampaignX({
         subject: "Exclusive Offer Tailored For You",
         body: "Check out this amazing opportunity designed for your profile.",
         list_customer_ids: subset.ids,
         send_time: new Date().toISOString()
       });

       console.log(`  -> Sent! External ID: ${sendRes.campaign_id}`);
       console.log(`  -> Waiting 3 seconds for CampaignX data to populate...`);
       await new Promise(resolve => setTimeout(resolve, 3000));

       const reportRes = await fetchCampaignReportFromCampaignX(sendRes.campaign_id);
       const records = reportRes.data || [];
       
       const totalSent = records.length;
       const opens = records.filter(r => r.EO === "Y").length;
       const clicks = records.filter(r => r.EC === "Y").length;

       const openRate = totalSent > 0 ? (opens / totalSent) * 100 : 0;
       const clickRate = totalSent > 0 ? (clicks / totalSent) * 100 : 0;

       console.log(`  ========== RESULTS ==========`);
       console.log(`  Total Sent: ${totalSent}`);
       console.log(`  Opened: ${opens} (${openRate.toFixed(2)}%)`);
       console.log(`  Clicked: ${clicks} (${clickRate.toFixed(2)}%)`);
       
       if (openRate > 50 && clickRate > 30) {
         console.log(`\n🎉 TARGET MET! 🎉`);
         console.log(`The optimal targeting vector is: ${subset.name}`);
         return;
       }

     } catch(e) {
       console.error(`  -> Failed: ${e.message}`);
     }
  }
}

autoOptimizeLoop().catch(console.error);
