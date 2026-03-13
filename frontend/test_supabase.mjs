import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    console.log("Checking for a sample customer...");
    const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .limit(1)
        .single();

    if (fetchError || !customer) {
        console.error("No customers found or error:", fetchError);
        return;
    }

    console.log(`Found customer: ${customer.customer_id} (Internal ID: ${customer.id})`);
    console.log(`Current stats - Sent: ${customer.emails_sent}, Opened: ${customer.emails_opened}, Clicked: ${customer.emails_clicked}`);

    console.log("Attempting manual increment...");
    const { error: updateError } = await supabase
        .from('customers')
        .update({
            emails_sent: (customer.emails_sent || 0) + 1,
            updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

    if (updateError) {
        console.error("Update failed:", updateError);
    } else {
        const { data: refreshed } = await supabase
            .from('customers')
            .select('emails_sent')
            .eq('id', customer.id)
            .single();
        console.log("Update success! New Sent count:", refreshed.emails_sent);
    }
}

testUpdate();
