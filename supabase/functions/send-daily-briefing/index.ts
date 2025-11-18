import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Generating daily briefing...');

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Gather data from past 24 hours
    const [clustersData, executiveOrdersData, stateActionsData, mentionsData] = await Promise.all([
      supabase
        .from('breaking_news_clusters')
        .select('*')
        .gte('first_detected_at', yesterday)
        .order('threat_level', { ascending: false })
        .limit(5),
      
      supabase
        .from('executive_orders')
        .select('*')
        .gte('issued_date', yesterday)
        .order('issued_date', { ascending: false })
        .limit(5),
      
      supabase
        .from('state_actions')
        .select('*')
        .gte('created_at', yesterday)
        .order('relevance_score', { ascending: false })
        .limit(5),
      
      supabase
        .from('organization_mentions')
        .select('*')
        .gte('mentioned_at', yesterday)
        .order('relevance_score', { ascending: false })
        .limit(10)
    ]);

    const topThreats = (clustersData.data || []).map(c => ({
      title: c.cluster_title,
      severity: c.severity,
      threat_level: c.threat_level
    }));

    const overallThreatScore = topThreats.reduce((sum, t) => sum + t.threat_level, 0) / 
                               Math.max(topThreats.length, 1);

    // Create briefing record
    const { data: briefing } = await supabase
      .from('daily_briefings')
      .insert({
        briefing_date: today,
        overall_threat_score: Math.round(overallThreatScore),
        top_threats: topThreats,
        key_developments: (clustersData.data || []).map(c => ({
          title: c.cluster_title,
          summary: c.summary
        })),
        organization_mentions_summary: {
          total: mentionsData.data?.length || 0,
          by_sentiment: {}
        },
        executive_orders_summary: (executiveOrdersData.data || []).map(o => ({
          title: o.title,
          issued_date: o.issued_date
        })),
        state_actions_summary: (stateActionsData.data || []).map(a => ({
          state: a.state,
          title: a.title
        })),
        recommendations: overallThreatScore > 7 ? 
          ['Increased monitoring recommended', 'Alert key stakeholders'] : 
          ['Continue normal monitoring']
      })
      .select()
      .single();

    // Send email if RESEND_API_KEY is configured
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    if (resendKey) {
      const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://app.example.com';
      
      // Get admin emails
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .in('id', 
          (await supabase.from('user_roles').select('user_id').eq('role', 'admin')).data?.map(r => r.user_id) || []
        );

      if (admins && admins.length > 0) {
        const html = `
          <h1>Daily Intelligence Briefing - ${today}</h1>
          <p><strong>Overall Threat Score:</strong> ${Math.round(overallThreatScore)}/10</p>
          
          <h2>Top Threats (${topThreats.length})</h2>
          <ul>
            ${topThreats.map(t => `<li><strong>${t.severity.toUpperCase()}:</strong> ${t.title} (Level ${t.threat_level})</li>`).join('')}
          </ul>
          
          <h2>Executive Orders (${executiveOrdersData.data?.length || 0})</h2>
          <ul>
            ${(executiveOrdersData.data || []).map(o => `<li>${o.title}</li>`).join('')}
          </ul>
          
          <h2>State Actions (${stateActionsData.data?.length || 0})</h2>
          <ul>
            ${(stateActionsData.data || []).map(a => `<li><strong>${a.state}:</strong> ${a.title}</li>`).join('')}
          </ul>
          
          <p><a href="${publicSiteUrl}/admin/intelligence">View Full Briefing</a></p>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Intelligence System <intelligence@resend.dev>',
            to: admins.map(a => a.email),
            subject: `Daily Briefing: Threat Level ${Math.round(overallThreatScore)}/10`,
            html
          })
        });

        // Mark briefing as sent
        await supabase
          .from('daily_briefings')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', briefing.id);
      }
    }

    console.log('Daily briefing generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        briefing_id: briefing.id,
        threat_score: Math.round(overallThreatScore)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-daily-briefing:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
