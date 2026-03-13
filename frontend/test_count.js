require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCount() {
  console.log("Checking customer count in Supabase...");
  const { data, count, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error("Error fetching count:", error);
    process.exit(1);
  }
  
  console.log("Total Customers in DB:", count);
  
  // Also fetch the cohort from the live API to see how many it returns
  console.log("Fetching cohort from live API...");
  try {
    const res = await fetch("https://campaignx.inxiteout.ai/api/v1/get_customer_cohort", {
      headers: {
        "X-API-Key": process.env.CAMPAIGNX_API_KEY
      }
    });
    
    if (res.ok) {
        const body = await res.json();
        console.log("Total Customers from Live API cohort:", body.data ? body.data.length : (body.total_count || "Unknown"));
    } else {
        console.error("Failed to fetch API:", res.status, await res.text());
    }
  } catch(e) {
    console.error("Error hitting live API:", e.message);
  }
}

checkCount();
