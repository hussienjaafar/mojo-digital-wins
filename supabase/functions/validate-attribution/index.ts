import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Validate Attribution Health
 * 
 * Checks for:
 * 1. Orphaned touchpoints (no donor email linked)
 * 2. Donations without prior touchpoints
 * 3. SMS events without identity links
 * 4. Overall attribution coverage
 */

interface AttributionHealth {
  total_touchpoints: number;
  touchpoints_with_donor: number;
  touchpoints_without_donor: number;
  touchpoint_coverage_percent: number;
  
  total_donations: number;
  donations_with_prior_touchpoint: number;
  donations_without_touchpoint: number;
  donation_attribution_percent: number;
  
  total_sms_events: number;
  sms_with_identity_link: number;
  sms_without_link: number;
  sms_identity_percent: number;
  
  unique_refcodes: number;
  refcodes_mapped_to_campaigns: number;
  
  health_score: number;
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id, days_back = 90 } = body;

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`[VALIDATE ATTRIBUTION] Starting for org ${organization_id}`);

    const cutoffDate = new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString();

    // 1. Check touchpoint donor linkage
    const { count: totalTouchpoints } = await supabase
      .from('attribution_touchpoints')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .gte('occurred_at', cutoffDate);

    const { count: touchpointsWithDonor } = await supabase
      .from('attribution_touchpoints')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .gte('occurred_at', cutoffDate)
      .not('donor_email', 'is', null);

    // 2. Check donations with attribution
    const { data: recentDonations } = await supabase
      .from('actblue_transactions')
      .select('donor_email, transaction_date')
      .eq('organization_id', organization_id)
      .gte('transaction_date', cutoffDate)
      .neq('transaction_type', 'refund')
      .limit(500);

    const donorEmails = new Set((recentDonations || []).map(d => d.donor_email));
    
    // Check which donors have touchpoints
    const { data: touchpointDonors } = await supabase
      .from('attribution_touchpoints')
      .select('donor_email')
      .eq('organization_id', organization_id)
      .in('donor_email', Array.from(donorEmails).filter(Boolean));

    const donorsWithTouchpoints = new Set((touchpointDonors || []).map(t => t.donor_email));
    const donationsWithTouchpoint = (recentDonations || []).filter(d => 
      donorsWithTouchpoints.has(d.donor_email)
    ).length;

    // 3. Check SMS identity linkage
    const { count: totalSmsEvents } = await supabase
      .from('sms_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .gte('occurred_at', cutoffDate);

    const { data: smsPhoneHashes } = await supabase
      .from('sms_events')
      .select('phone_hash')
      .eq('organization_id', organization_id)
      .gte('occurred_at', cutoffDate)
      .not('phone_hash', 'is', null)
      .limit(500);

    const uniquePhones = new Set((smsPhoneHashes || []).map(s => s.phone_hash));
    
    const { data: identityLinks } = await supabase
      .from('donor_identity_links')
      .select('phone_hash')
      .eq('organization_id', organization_id)
      .in('phone_hash', Array.from(uniquePhones).filter(Boolean));

    const linkedPhones = new Set((identityLinks || []).map(l => l.phone_hash));
    const smsWithLink = (smsPhoneHashes || []).filter(s => linkedPhones.has(s.phone_hash)).length;

    // 4. Check refcode coverage
    const { data: uniqueRefcodes } = await supabase
      .from('actblue_transactions')
      .select('refcode')
      .eq('organization_id', organization_id)
      .not('refcode', 'is', null);

    const refcodeSet = new Set((uniqueRefcodes || []).map(r => r.refcode));

    const { count: mappedRefcodes } = await supabase
      .from('campaign_attribution')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .not('refcode', 'is', null);

    // Calculate health metrics
    const totalTP = totalTouchpoints || 0;
    const tpWithDonor = touchpointsWithDonor || 0;
    const tpCoverage = totalTP > 0 ? Math.round((tpWithDonor / totalTP) * 100) : 0;

    const totalDonations = recentDonations?.length || 0;
    const donationAttr = totalDonations > 0 ? Math.round((donationsWithTouchpoint / totalDonations) * 100) : 0;

    const totalSms = totalSmsEvents || 0;
    const smsIdentity = uniquePhones.size > 0 ? Math.round((smsWithLink / uniquePhones.size) * 100) : 0;

    // Calculate overall health score (weighted average)
    const healthScore = Math.round(
      (tpCoverage * 0.3) + 
      (donationAttr * 0.5) + 
      (smsIdentity * 0.2)
    );

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (tpCoverage < 50) {
      recommendations.push('Run the touchpoint matching job to link touchpoints to donors via refcode');
    }
    if (donationAttr < 30) {
      recommendations.push('Ensure Meta ads have refcodes in destination URLs for proper attribution');
    }
    if (totalSms > 0 && smsIdentity < 50) {
      recommendations.push('Collect phone numbers with email via ActBlue to enable SMS-to-donor matching');
    }
    if ((mappedRefcodes || 0) < refcodeSet.size * 0.5) {
      recommendations.push('Create campaign attribution mappings to link refcodes to Meta campaigns');
    }

    const health: AttributionHealth = {
      total_touchpoints: totalTP,
      touchpoints_with_donor: tpWithDonor,
      touchpoints_without_donor: totalTP - tpWithDonor,
      touchpoint_coverage_percent: tpCoverage,
      
      total_donations: totalDonations,
      donations_with_prior_touchpoint: donationsWithTouchpoint,
      donations_without_touchpoint: totalDonations - donationsWithTouchpoint,
      donation_attribution_percent: donationAttr,
      
      total_sms_events: totalSms,
      sms_with_identity_link: smsWithLink,
      sms_without_link: totalSms > 0 ? uniquePhones.size - linkedPhones.size : 0,
      sms_identity_percent: smsIdentity,
      
      unique_refcodes: refcodeSet.size,
      refcodes_mapped_to_campaigns: mappedRefcodes || 0,
      
      health_score: healthScore,
      recommendations,
    };

    console.log(`[VALIDATE ATTRIBUTION] Health score: ${healthScore}%`);

    return new Response(
      JSON.stringify({
        success: true,
        health,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[VALIDATE ATTRIBUTION] Error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
