/**
 * CampaignX Auto-Optimization Loop
 * Directly hits the CampaignX API with various demographic subsets.
 */

const BASE_URL = "https://campaignx.inxiteout.ai";
const API_KEY = "on1MLV73fprjBptTJR_mKg-3v6Bq0OIc5aGbKc9TFEY";

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} => ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error(`  [ERROR BODY]: ${errBody}`);
    throw new Error(`POST ${path} => ${res.status}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// CampaignX API requires DD:MM:YY HH:MM:SS format (NOT ISO!)
function toCampaignXFormat(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}:${mm}:${yy} ${hh}:${mi}:${ss}`;
}

async function testSubset(name, customerIds, subject) {
  if (customerIds.length === 0) {
    console.log(`  [SKIP] ${name} — no customers matched`);
    return null;
  }
  console.log(`\n--- Testing: "${name}" (${customerIds.length} customers) ---`);

  const sendPayload = {
    subject: subject || "Special Personalized Offer",
    body: "Dear Customer, we have an exclusive tailored offer for you. Act now for the best rates.",
    list_customer_ids: customerIds,
    send_time: toCampaignXFormat(new Date(Date.now() + 5 * 60 * 1000)), // 5 min in future
  };
  console.log(`  Payload snapshot: subject="${sendPayload.subject}", ids[0]=${customerIds[0]}, send_time=${sendPayload.send_time}`);

  let campaignId;
  try {
    const sendRes = await apiPost("/api/v1/send_campaign", sendPayload);
    campaignId = sendRes.campaign_id;
    console.log(`  Sent! campaign_id=${campaignId}`);
  } catch (e) {
    console.error(`  Send failed: ${e.message}`);
    return null;
  }

  console.log(`  Waiting 5s...`);
  await sleep(5000);

  let records = [];
  try {
    const reportRes = await apiGet(`/api/v1/get_report?campaign_id=${campaignId}`);
    records = reportRes.data || [];
  } catch (e) {
    console.error(`  Report fetch failed: ${e.message}`);
    return null;
  }

  const totalSent = records.length;
  const totalOpened = records.filter((r) => r.EO === "Y").length;
  const totalClicked = records.filter((r) => r.EC === "Y").length;
  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

  console.log(`  Records: ${totalSent}, Opens: ${totalOpened} (${openRate.toFixed(2)}%), Clicks: ${totalClicked} (${clickRate.toFixed(2)}%)`);
  console.log(`  Sample records (first 3):`);
  for (const r of records.slice(0, 3)) {
    console.log(`    ${JSON.stringify(r)}`);
  }

  return { name, totalSent, totalOpened, totalClicked, openRate, clickRate };
}

async function main() {
  console.log("=== CampaignX Auto-Optimize Loop ===\n");

  const cohortData = await apiGet("/api/v1/get_customer_cohort");
  const all = cohortData.data || [];
  console.log(`Total cohort: ${all.length} customers`);
  console.log(`\nFirst customer schema:\n${JSON.stringify(all[0], null, 2)}\n`);

  // Quick probe with a single customer to see what error the API gives
  console.log("=== PROBE: single customer minimal send ===");
  await apiPost("/api/v1/send_campaign", {
    subject: "Test",
    body: "Test body",
    list_customer_ids: [all[0].customer_id],
    send_time: toCampaignXFormat(new Date(Date.now() + 5 * 60 * 1000)),
  }).catch(e => console.error("Probe send error:", e.message));

  const results = [];

  const subsets = [
    {
      name: "Top 20% by w1",
      ids: [...all].sort((a, b) => (b.w1 - a.w1)).slice(0, Math.floor(all.length * 0.2)).map((c) => c.customer_id),
      subject: "Exclusive Loan Offer — Act Now!",
    },
    {
      name: "Top 20% by w2",
      ids: [...all].sort((a, b) => (b.w2 - a.w2)).slice(0, Math.floor(all.length * 0.2)).map((c) => c.customer_id),
      subject: "High-Yield Deposit Just For You",
    },
    {
      name: "Top 20% by w3",
      ids: [...all].sort((a, b) => (b.w3 - a.w3)).slice(0, Math.floor(all.length * 0.2)).map((c) => c.customer_id),
      subject: "Exclusive Credit Card Upgrade",
    },
    {
      name: "Top 10% by sum(w1+w2+w3)",
      ids: [...all]
        .map((c) => ({ ...c, total: (c.w1 || 0) + (c.w2 || 0) + (c.w3 || 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, Math.floor(all.length * 0.1))
        .map((c) => c.customer_id),
      subject: "Premium Financial Offer — You Qualify!",
    },
    {
      name: "Top 5% by sum(w1+w2+w3)",
      ids: [...all]
        .map((c) => ({ ...c, total: (c.w1 || 0) + (c.w2 || 0) + (c.w3 || 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, Math.floor(all.length * 0.05))
        .map((c) => c.customer_id),
      subject: "🌟 VIP Exclusive Offer — You're Selected!",
    },
  ];

  for (const subset of subsets) {
    const result = await testSubset(subset.name, subset.ids, subset.subject);
    if (result) {
      results.push(result);
      if (result.openRate > 50 && result.clickRate > 30) {
        console.log(`\n🎉 TARGET MET! Open=${result.openRate.toFixed(2)}%, Click=${result.clickRate.toFixed(2)}%`);
        break;
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`  ${r.name}: Open=${r.openRate.toFixed(1)}%, Click=${r.clickRate.toFixed(1)}%`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
