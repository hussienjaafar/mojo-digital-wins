import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Match Touchpoints to Donors
 * 
 * This function matches attribution touchpoints to donors by:
 * 1. Finding touchpoints with refcodes that match ActBlue transactions
 * 2. Updating touchpoints with donor_email from matched transactions
 * 3. Building the donor_identity_links table for phone-to-email matching
 */

// Simple hash function for phone normalization
function hashPhone(phone: string): string {
  const normalized = phone.replace(/\D/g, '').slice(-10);
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `ph_${Math.abs(hash).toString(36)}`;
}

// Simple hash for email
function hashEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `em_${Math.abs(hash).toString(36)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id, batch_size = 500 } = body;

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`[MATCH TOUCHPOINTS] Starting for org ${organization_id}`);

    let matchedByRefcode = 0;
    let identityLinksCreated = 0;

    // Step 1: Get all unique refcodes from ActBlue transactions with their donor emails
    const { data: refcodeDonors, error: refcodeError } = await supabase
      .from('actblue_transactions')
      .select('refcode, donor_email, phone')
      .eq('organization_id', organization_id)
      .not('refcode', 'is', null)
      .not('donor_email', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(batch_size * 2);

    if (refcodeError) {
      console.error('[MATCH TOUCHPOINTS] Error fetching refcode donors:', refcodeError);
    }

    // Build refcode -> donor email map (use most recent transaction)
    const refcodeToDonor = new Map<string, { email: string; phone: string | null }>();
    for (const tx of (refcodeDonors || [])) {
      if (tx.refcode && tx.donor_email && !refcodeToDonor.has(tx.refcode)) {
        refcodeToDonor.set(tx.refcode, { email: tx.donor_email, phone: tx.phone });
      }
    }

    console.log(`[MATCH TOUCHPOINTS] Found ${refcodeToDonor.size} unique refcodes with donors`);

    // Step 2: Find touchpoints with refcodes but no donor_email
    const { data: unmatchedTouchpoints, error: tpError } = await supabase
      .from('attribution_touchpoints')
      .select('id, refcode')
      .eq('organization_id', organization_id)
      .not('refcode', 'is', null)
      .is('donor_email', null)
      .limit(batch_size);

    if (tpError) {
      console.error('[MATCH TOUCHPOINTS] Error fetching unmatched touchpoints:', tpError);
    }

    // Step 3: Match touchpoints to donors via refcode
    const updates: { id: string; donor_email: string }[] = [];
    for (const tp of (unmatchedTouchpoints || [])) {
      if (tp.refcode && refcodeToDonor.has(tp.refcode)) {
        const donorInfo = refcodeToDonor.get(tp.refcode)!;
        updates.push({ id: tp.id, donor_email: donorInfo.email });
      }
    }

    // Batch update touchpoints with matched donor emails
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('attribution_touchpoints')
          .update({ donor_email: update.donor_email })
          .eq('id', update.id);

        if (!updateError) {
          matchedByRefcode++;
        } else {
          console.error(`[MATCH TOUCHPOINTS] Error updating touchpoint ${update.id}:`, updateError);
        }
      }
    }

    console.log(`[MATCH TOUCHPOINTS] Matched ${matchedByRefcode} touchpoints via refcode`);

    // Step 4: Build donor identity links for phone-to-email cross-reference
    // Get transactions with both phone and email
    const { data: transactionsWithPhone, error: phoneError } = await supabase
      .from('actblue_transactions')
      .select('donor_email, phone')
      .eq('organization_id', organization_id)
      .not('phone', 'is', null)
      .not('donor_email', 'is', null)
      .limit(batch_size);

    if (phoneError) {
      console.error('[MATCH TOUCHPOINTS] Error fetching transactions with phone:', phoneError);
    }

    // Create identity links
    const identityLinks: Array<{
      organization_id: string;
      email_hash: string;
      phone_hash: string;
      donor_email: string;
      source: string;
    }> = [];

    const seenLinks = new Set<string>();
    for (const tx of (transactionsWithPhone || [])) {
      if (tx.phone && tx.donor_email) {
        const emailHash = hashEmail(tx.donor_email);
        const phoneHash = hashPhone(tx.phone);
        const linkKey = `${emailHash}:${phoneHash}`;
        
        if (!seenLinks.has(linkKey)) {
          seenLinks.add(linkKey);
          identityLinks.push({
            organization_id,
            email_hash: emailHash,
            phone_hash: phoneHash,
            donor_email: tx.donor_email,
            source: 'actblue',
          });
        }
      }
    }

    // Upsert identity links
    if (identityLinks.length > 0) {
      const { error: linkError, count } = await supabase
        .from('donor_identity_links')
        .upsert(identityLinks, { 
          onConflict: 'organization_id,email_hash,phone_hash',
          ignoreDuplicates: true 
        });

      if (linkError) {
        console.error('[MATCH TOUCHPOINTS] Error creating identity links:', linkError);
      } else {
        identityLinksCreated = identityLinks.length;
      }
    }

    console.log(`[MATCH TOUCHPOINTS] Created ${identityLinksCreated} identity links`);

    const duration = Date.now() - startTime;
    console.log(`[MATCH TOUCHPOINTS] Complete in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        matched_by_refcode: matchedByRefcode,
        identity_links_created: identityLinksCreated,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MATCH TOUCHPOINTS] Error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
