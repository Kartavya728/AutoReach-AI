/**
 * CampaignX investigation: send with future time, then wait longer to see if EO/EC appear
 * Also check if reports from PREVIOUS sends (from the prior loop) have engagement now
 */
const BASE_URL = "https://campaignx.inxiteout.ai";
const API_KEY = "on1MLV73fprjBptTJR_mKg-3v6Bq0OIc5aGbKc9TFEY";

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) { const b = await res.text(); throw new Error(`GET ${path} => ${res.status}: ${b}`); }
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const b = await res.text(); console.error(`ERR: ${b}`); throw new Error(`POST ${path} => ${res.status}`); }
  return res.json();
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toCampaignXFormat(date) {
  const dd = String(date.getDate()).padStart(2,"0");
  const mm = String(date.getMonth()+1).padStart(2,"0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2,"0");
  const mi = String(date.getMinutes()).padStart(2,"0");
  const ss = String(date.getSeconds()).padStart(2,"0");
  return `${dd}:${mm}:${yy} ${hh}:${mi}:${ss}`;
}

function analyzeReport(records) {
  const total = records.length;
  const opens = records.filter(r => r.EO === "Y").length;
  const clicks = records.filter(r => r.EC === "Y").length;
  return {
    total,
    opens,
    clicks,
    openRate: total > 0 ? (opens / total * 100).toFixed(2) : "0.00",
    clickRate: total > 0 ? (clicks / total * 100).toFixed(2) : "0.00",
  };
}

async function main() {
  const cohortData = await apiGet("/api/v1/get_customer_cohort");
  const all = cohortData.data || [];
  console.log(`Cohort size: ${all.length}`);

  // Previously sent campaign IDs from the loop test
  const previousCampaignIds = [
    "a78abedc-7ed6-4774-9d9b-f0fc0e42974e", // Top 20% by w1 (probe test)
    "0f65f1f7-cae5-4eba-be13-c340064417e7", // from previous loop runs
    "6b86420d-ab17-4b48-b2d6-8d8dfbf96323", // from previous loop runs
  ];

  console.log("\n=== Checking previously sent campaigns for updated engagement ===");
  for (const cid of previousCampaignIds) {
    try {
      const rep = await apiGet(`/api/v1/get_report?campaign_id=${cid}`);
      const stats = analyzeReport(rep.data || []);
      console.log(`Campaign ${cid}: total=${stats.total}, open=${stats.opens}(${stats.openRate}%), click=${stats.clicks}(${stats.clickRate}%)`);
      if (stats.total > 0) {
        console.log(`  Record example: ${JSON.stringify((rep.data || [])[0])}`);
      }
    } catch(e) {
      console.error(`  ${cid}: ${e.message}`);
    }
  }

  // Top 50 by w1 for new test
  const top50 = [...all].sort((a,b) => b.w1 - a.w1).slice(0, 50).map(c => c.customer_id);
  
  // Send 2 minutes into the future
  const futureTime = new Date(Date.now() + 2 * 60 * 1000);
  const futureStr = toCampaignXFormat(futureTime);
  
  console.log(`\n=== Sending new campaign at ${futureStr} ===`);
  const sendRes = await apiPost("/api/v1/send_campaign", {
    subject: "Exclusive Financial Offer — Act Now!",
    body: "Dear valued customer, you have been selected for an exclusive offer based on your financial profile.",
    list_customer_ids: top50,
    send_time: futureStr,
  });
  const cid = sendRes.campaign_id;
  console.log(`Sent! campaign_id=${cid}`);

  // Poll every 30s for 5 minutes
  for (let i = 0; i < 10; i++) {
    console.log(`\nWaiting 30s (poll ${i+1}/10)...`);
    await sleep(30000);
    const rep = await apiGet(`/api/v1/get_report?campaign_id=${cid}`);
    const stats = analyzeReport(rep.data || []);
    console.log(`Poll ${i+1}: total=${stats.total}, open=${stats.opens}(${stats.openRate}%), click=${stats.clicks}(${stats.clickRate}%)`);
    if (stats.opens > 0) {
      console.log(`\n🎉 GOT ENGAGEMENT! EO/EC data is populating.`);
      console.log(`Open Rate: ${stats.openRate}%, Click Rate: ${stats.clickRate}%`);
      // Print all records with EO=Y
      const openers = (rep.data || []).filter(r => r.EO === "Y");
      console.log(`Openers (first 3):`);
      for (const r of openers.slice(0, 3)) console.log(` ${JSON.stringify(r)}`);
      break;
    }
  }
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
