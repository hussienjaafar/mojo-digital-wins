import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSCampaign {
  id: string;
  campaign_name: string;
  message_text: string | null;
}

interface AIAnalysisResult {
  topic: string;
  topic_summary: string;
  tone: string;
  urgency_level: string;
  call_to_action: string;
  key_themes: string[];
  // Deep donor motivation fields
  donor_pain_points: string[];
  values_appealed: string[];
  issue_specifics: string[];
  emotional_triggers: string[];
  urgency_drivers: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { organization_id, batch_size = 10, campaign_id } = await req.json().catch(() => ({}));

    // Fetch unanalyzed campaigns with message_text
    let fetchResult;
    
    if (campaign_id) {
      // Single campaign mode
      fetchResult = await supabase
        .from('sms_campaigns')
        .select('id, campaign_name, message_text')
        .eq('id', campaign_id)
        .single();
    } else {
      // Batch mode - build query step by step
      let query = supabase
        .from('sms_campaigns')
        .select('id, campaign_name, message_text')
        .is('analyzed_at', null)
        .not('message_text', 'is', null)
        .neq('message_text', '');
      
      if (organization_id) {
        query = query.eq('organization_id', organization_id);
      }
      
      fetchResult = await query
        .order('send_date', { ascending: false })
        .limit(batch_size);
    }

    const { data: campaigns, error: fetchError } = fetchResult;

    if (fetchError) {
      console.error('Error fetching campaigns:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!campaigns || (Array.isArray(campaigns) && campaigns.length === 0)) {
      return new Response(
        JSON.stringify({ success: true, analyzed: 0, message: 'No campaigns to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaignsToAnalyze: SMSCampaign[] = Array.isArray(campaigns) ? campaigns : [campaigns];
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const campaign of campaignsToAnalyze) {
      try {
        if (!campaign.message_text) {
          results.push({ id: campaign.id, success: false, error: 'No message text' });
          continue;
        }

        // Truncate message text if too long (keep first 2000 chars)
        const messageText = campaign.message_text.slice(0, 2000);

        const prompt = `You are an expert at understanding what motivates political donors to give money.

Analyze this SMS campaign message and extract SPECIFIC insights about donor psychology and motivations.

SMS Message:
"""
${messageText}
"""

Focus on:
1. DONOR_PAIN_POINTS: What specific problem, injustice, or threat is highlighted that would compel someone to donate?
   - Be SPECIFIC (not "foreign policy" but "US funding of Israeli military operations killing civilians")
   - What keeps donors up at night that this message addresses?

2. VALUES_APPEALED: What core values are being triggered to motivate action?
   - Examples: justice, community empowerment, anti-establishment, protecting vulnerable people, religious duty, patriotism, solidarity

3. ISSUE_SPECIFICS: What exact policy, event, or situation is mentioned?
   - Examples: "Gaza humanitarian crisis", "AIPAC lobbying influence", "Bronx housing affordability crisis"

4. EMOTIONAL_TRIGGERS: What emotions are being activated to drive the donation?
   - Examples: anger at corruption, fear of losing rights, hope for change, guilt about inaction, pride in community

5. URGENCY_DRIVERS: What creates the sense of "I need to act NOW"?
   - Examples: matching gift deadline, crisis moment, upcoming vote, opponent threat, end-of-quarter deadline

Also extract:
- topic: Primary topic category (Healthcare, Immigration, Elections, Endorsement, Fundraising, Policy, Economy, Environment, Civil Rights, Foreign Policy, Education, Gun Rights, Veterans, Other)
- topic_summary: 10-20 word summary of the message's main intent
- tone: Emotional tone (urgent, hopeful, angry, grateful, concerned, inspiring, alarming, celebratory)
- urgency_level: (low, medium, high, critical)
- call_to_action: Primary CTA (donate, volunteer, sign petition, vote, share, attend event, contact representative, other)
- key_themes: 2-4 key themes

Respond ONLY with valid JSON, no markdown:
{
  "topic": "string",
  "topic_summary": "string",
  "tone": "string",
  "urgency_level": "string",
  "call_to_action": "string",
  "key_themes": ["array"],
  "donor_pain_points": ["specific pain point 1", "specific pain point 2"],
  "values_appealed": ["value 1", "value 2"],
  "issue_specifics": ["specific issue 1"],
  "emotional_triggers": ["emotion 1", "emotion 2"],
  "urgency_drivers": ["urgency reason 1"]
}`;

        // Call Lovable AI gateway
        const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
        if (!lovableApiKey) {
          console.error('LOVABLE_API_KEY not configured');
          results.push({ id: campaign.id, success: false, error: 'LOVABLE_API_KEY not configured' });
          continue;
        }
        
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are an expert political campaign analyst who understands donor psychology. Your job is to identify what SPECIFICALLY motivates people to donate - not generic categories, but the exact pain points, values, and emotions that drive giving behavior. Always respond with valid JSON only.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', errorText);
          results.push({ id: campaign.id, success: false, error: `AI API error: ${aiResponse.status}` });
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          results.push({ id: campaign.id, success: false, error: 'No AI response content' });
          continue;
        }

        // Parse JSON from response (handle potential markdown code blocks)
        let analysis: AIAnalysisResult;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in response');
          }
          analysis = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error('Failed to parse AI response:', content);
          results.push({ id: campaign.id, success: false, error: 'Failed to parse AI response' });
          continue;
        }

        // Update campaign with analysis results including motivation fields
        const { error: updateError } = await supabase
          .from('sms_campaigns')
          .update({
            topic: analysis.topic || 'Other',
            topic_summary: analysis.topic_summary || null,
            tone: analysis.tone || null,
            urgency_level: analysis.urgency_level || 'medium',
            call_to_action: analysis.call_to_action || null,
            key_themes: analysis.key_themes || [],
            // Deep motivation fields
            donor_pain_points: analysis.donor_pain_points || [],
            values_appealed: analysis.values_appealed || [],
            issue_specifics: analysis.issue_specifics || [],
            emotional_triggers: analysis.emotional_triggers || [],
            urgency_drivers: analysis.urgency_drivers || [],
            analyzed_at: new Date().toISOString(),
          })
          .eq('id', campaign.id);

        if (updateError) {
          console.error('Update error for campaign', campaign.id, updateError);
          results.push({ id: campaign.id, success: false, error: updateError.message });
        } else {
          console.log(`Analyzed SMS campaign ${campaign.id}: pain_points=${analysis.donor_pain_points?.length || 0}, values=${analysis.values_appealed?.length || 0}`);
          results.push({ id: campaign.id, success: true });
        }
      } catch (campaignError) {
        console.error('Error processing campaign', campaign.id, campaignError);
        results.push({ 
          id: campaign.id, 
          success: false, 
          error: campaignError instanceof Error ? campaignError.message : 'Unknown error' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: successCount,
        errors: errorCount,
        results,
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
