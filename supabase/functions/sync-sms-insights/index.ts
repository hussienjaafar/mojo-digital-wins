import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Syncs analyzed SMS campaigns to sms_creative_insights table
 * This bridges sms_campaigns data to the creative learnings pipeline
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id, batch_size = 50 } = await req.json().catch(() => ({}));

    console.log(`Syncing SMS insights${organization_id ? ` for org: ${organization_id}` : ' (all orgs)'}`);

    // Fetch analyzed campaigns that haven't been synced to sms_creative_insights
    let query = supabase
      .from('sms_campaigns')
      .select(`
        id, 
        organization_id,
        campaign_name,
        message_text,
        send_date,
        topic,
        topic_summary,
        tone,
        urgency_level,
        call_to_action,
        key_themes,
        donor_pain_points,
        values_appealed,
        issue_specifics,
        emotional_triggers,
        urgency_drivers,
        analyzed_at,
        messages_sent,
        messages_delivered,
        clicks,
        conversions,
        amount_raised
      `)
      .not('analyzed_at', 'is', null)
      .order('analyzed_at', { ascending: false })
      .limit(batch_size);

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: campaigns, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching campaigns:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: 'No analyzed campaigns to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let synced = 0;
    let errors = 0;

    for (const campaign of campaigns) {
      try {
        // Calculate metrics
        const clickRate = campaign.messages_sent && campaign.messages_sent > 0 
          ? (campaign.clicks || 0) / campaign.messages_sent 
          : null;
        const conversionRate = campaign.messages_sent && campaign.messages_sent > 0 
          ? (campaign.conversions || 0) / campaign.messages_sent 
          : null;

        // Extract send hour/day from send_date if available
        let sendHour: number | null = null;
        let sendDayOfWeek: number | null = null;
        if (campaign.send_date) {
          const sendDate = new Date(campaign.send_date);
          sendHour = sendDate.getHours();
          sendDayOfWeek = sendDate.getDay();
        }

        // Upsert to sms_creative_insights
        const { error: upsertError } = await supabase
          .from('sms_creative_insights')
          .upsert({
            id: campaign.id, // Use same ID as campaign
            organization_id: campaign.organization_id,
            campaign_id: campaign.id,
            campaign_name: campaign.campaign_name,
            message_text: campaign.message_text,
            topic: campaign.topic,
            tone: campaign.tone,
            urgency_level: campaign.urgency_level,
            call_to_action: campaign.call_to_action,
            key_themes: campaign.key_themes,
            donor_pain_points: campaign.donor_pain_points,
            values_appealed: campaign.values_appealed,
            issue_specifics: campaign.issue_specifics,
            emotional_triggers: campaign.emotional_triggers,
            urgency_drivers: campaign.urgency_drivers,
            send_date: campaign.send_date,
            send_hour: sendHour,
            send_day_of_week: sendDayOfWeek,
            messages_sent: campaign.messages_sent,
            messages_delivered: campaign.messages_delivered,
            clicks: campaign.clicks,
            conversions: campaign.conversions,
            amount_raised: campaign.amount_raised,
            click_rate: clickRate,
            conversion_rate: conversionRate,
            analyzed_at: campaign.analyzed_at,
            ai_model_used: 'google/gemini-2.5-flash',
            analysis_confidence: 0.85,
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error(`Error syncing campaign ${campaign.id}:`, upsertError);
          errors++;
        } else {
          synced++;
        }
      } catch (err) {
        console.error(`Error processing campaign ${campaign.id}:`, err);
        errors++;
      }
    }

    console.log(`SMS insights sync complete: ${synced} synced, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        errors,
        total_processed: campaigns.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
