import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// PHASE 6: Alert throttling window
const ALERT_THROTTLE_HOURS = 4;

// Generate AI executive summary and key takeaways
async function generateAISummary(briefingData: {
  critical_count: number;
  high_count: number;
  total_articles: number;
  total_bills: number;
  top_critical_items: any[];
  orgSummary: Record<string, any>;
}): Promise<{ executive_summary: string; key_takeaways: string[] }> {
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, skipping AI summary generation');
    return {
      executive_summary: '',
      key_takeaways: []
    };
  }

  const topItems = briefingData.top_critical_items.slice(0, 10);
  const orgMentions = Object.entries(briefingData.orgSummary)
    .map(([org, data]: [string, any]) => `${org}: ${data.total} mentions (${data.critical} critical)`)
    .join(', ');

  const prompt = `You are an intelligence analyst providing a daily briefing for advocacy organizations focused on Arab American, Muslim American, and civil rights issues.

TODAY'S DATA:
- Critical alerts: ${briefingData.critical_count}
- High priority alerts: ${briefingData.high_count}
- Total articles analyzed: ${briefingData.total_articles}
- Bills tracked: ${briefingData.total_bills}
- Organization mentions: ${orgMentions || 'None today'}

TOP ITEMS:
${topItems.map((item, i) => `${i + 1}. [${item.threat_level?.toUpperCase()}] ${item.title} (${item.type})`).join('\n')}

Generate:
1. A 2-3 sentence executive summary highlighting the most important developments and their implications
2. 3-5 key takeaways as bullet points (actionable insights for advocacy staff)

Respond in JSON format:
{
  "executive_summary": "...",
  "key_takeaways": ["...", "...", "..."]
}`;

  try {
    const response = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a concise intelligence analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status, await response.text());
      return { executive_summary: '', key_takeaways: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        executive_summary: parsed.executive_summary || '',
        key_takeaways: Array.isArray(parsed.key_takeaways) ? parsed.key_takeaways : []
      };
    }

    return { executive_summary: '', key_takeaways: [] };
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return { executive_summary: '', key_takeaways: [] };
  }
}

// Organizations to track
const TRACKED_ORGANIZATIONS = [
  { abbrev: 'CAIR', full: 'Council on American-Islamic Relations', variants: ['cair', 'council on american-islamic relations'] },
  { abbrev: 'MPAC', full: 'Muslim Public Affairs Council', variants: ['mpac', 'muslim public affairs council'] },
  { abbrev: 'ISNA', full: 'Islamic Society of North America', variants: ['isna', 'islamic society of north america'] },
  { abbrev: 'ADC', full: 'American-Arab Anti-Discrimination Committee', variants: ['adc', 'american-arab anti-discrimination'] },
  { abbrev: 'AAI', full: 'Arab American Institute', variants: ['aai', 'arab american institute'] },
  { abbrev: 'MAS', full: 'Muslim American Society', variants: ['mas', 'muslim american society'] },
  { abbrev: 'ICNA', full: 'Islamic Circle of North America', variants: ['icna', 'islamic circle of north america'] },
  { abbrev: 'ACLU', full: 'American Civil Liberties Union', variants: ['aclu', 'american civil liberties union'] },
  { abbrev: 'NAIT', full: 'North American Islamic Trust', variants: ['nait', 'north american islamic trust'] },
];

// Simple similarity function for breaking news detection
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// Extract context around organization mention
function extractMentionContext(text: string, orgName: string): string {
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(orgName.toLowerCase());

  if (index === -1) return '';

  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + orgName.length + 100);

  return '...' + text.substring(start, end) + '...';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'full';
    const localDate = body.localDate; // Client's local date to avoid timezone mismatch

    console.log(`Smart Alerting: Running action "${action}", localDate: ${localDate}`);

    // PHASE 6: Pre-fetch recent alerts for throttling
    const throttleCutoff = new Date(Date.now() - ALERT_THROTTLE_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
      .from('alert_queue')
      .select('title, alert_type')
      .gte('created_at', throttleCutoff);
    
    const recentAlertKeys = new Set(
      (recentAlerts || []).map(a => `${a.alert_type}-${a.title}`)
    );

    const results: any = {};

    // =================================================================
    // 1. DETECT BREAKING NEWS (Multiple sources reporting same story)
    // OPTIMIZED: Limited to 50 articles and early exit to prevent CPU timeout
    // =================================================================
    if (action === 'full' || action === 'breaking_news') {
      console.log('Detecting breaking news clusters...');

      // OPTIMIZED: Only get critical/high articles from last 3 hours, limit to 50
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data: recentArticles } = await supabase
        .from('articles')
        .select('id, title, description, source_name, threat_level, affected_organizations, published_date')
        .gte('published_date', threeHoursAgo)
        .in('threat_level', ['critical', 'high'])
        .order('published_date', { ascending: false })
        .limit(50);

      const clusters: Map<string, any> = new Map();
      const processed = new Set<string>();
      const maxClusters = 10; // Early exit after finding enough clusters

      for (const article of recentArticles || []) {
        if (processed.has(article.id)) continue;
        if (clusters.size >= maxClusters) break; // Early exit

        const clusterArticles = [article];
        const clusterSources = new Set([article.source_name]);

        // Find similar articles - OPTIMIZED: Only compare with unprocessed
        for (const other of recentArticles || []) {
          if (other.id === article.id || processed.has(other.id)) continue;

          const similarity = calculateSimilarity(
            `${article.title} ${article.description || ''}`,
            `${other.title} ${other.description || ''}`
          );

          if (similarity > 0.4) {
            clusterArticles.push(other);
            clusterSources.add(other.source_name);
            processed.add(other.id);
          }
        }

        // Breaking news = 3+ sources reporting
        if (clusterSources.size >= 3) {
          const clusterKey = article.title.substring(0, 50);

          // Determine cluster threat level (highest of all articles)
          const threatLevels = ['critical', 'high', 'medium', 'low'];
          let clusterThreat = 'low';
          for (const level of threatLevels) {
            if (clusterArticles.some(a => a.threat_level === level)) {
              clusterThreat = level;
              break;
            }
          }

          // Collect affected organizations
          const affectedOrgs = new Set<string>();
          clusterArticles.forEach(a => {
            (a.affected_organizations || []).forEach((org: string) => affectedOrgs.add(org));
          });

          clusters.set(clusterKey, {
            topic: article.title,
            articles: clusterArticles,
            sources: Array.from(clusterSources),
            threatLevel: clusterThreat,
            affectedOrgs: Array.from(affectedOrgs),
            primaryArticleId: article.id,
          });
        }

        processed.add(article.id);
      }

      // Save breaking news clusters
      let clustersCreated = 0;
      for (const [key, cluster] of clusters) {
        // Get earliest article publish time for first_detected_at
        const earliestTime = new Date(Math.min(...cluster.articles.map((a: any) => new Date(a.published_date).getTime())));

        const { error } = await supabase
          .from('breaking_news_clusters')
          .upsert({
            cluster_topic: cluster.topic,
            article_count: cluster.articles.length,
            source_names: cluster.sources,
            threat_level: cluster.threatLevel,
            affected_organizations: cluster.affectedOrgs,
            primary_article_id: cluster.primaryArticleId,
            first_detected_at: earliestTime.toISOString(),
            is_active: true,
            is_resolved: false,
            last_updated_at: new Date().toISOString(),
          }, {
            onConflict: 'cluster_topic'
          });

        if (!error) clustersCreated++;

        // Create alert for breaking news - WITH THROTTLING
        if (cluster.sources.length >= 3) {
          const alertTitle = `🔴 Breaking: ${cluster.sources.length} sources reporting`;
          const alertKey = `breaking_news-${alertTitle}`;
          
          if (!recentAlertKeys.has(alertKey)) {
            await supabase.from('alert_queue').insert({
              alert_type: 'breaking_news',
              priority: cluster.threatLevel,
              source_type: 'breaking_news_cluster',
              source_id: cluster.primaryArticleId,
              title: alertTitle,
              message: cluster.topic,
              metadata: {
                sources: cluster.sources,
                article_count: cluster.articles.length,
                affected_organizations: cluster.affectedOrgs,
              },
            });
          }
        }
      }

      results.breaking_news = { clustersFound: clusters.size, clustersCreated };
      console.log(`Found ${clusters.size} breaking news clusters`);
    }

    // =================================================================
    // 2. TRACK ORGANIZATION MENTIONS
    // OPTIMIZED: Skip if action is 'daily_briefing' to speed up briefing generation
    // =================================================================
    if (action === 'org_mentions' || (action === 'full' && !localDate)) {
      console.log('Tracking organization mentions...');

      let mentionsFound = 0;
      // Use client's local date if provided, otherwise use server date
      const today = localDate || (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      })();

      // OPTIMIZED: Batch check and limit to 20 articles to prevent CPU timeout
      const { data: todayArticles } = await supabase
        .from('articles')
        .select('id, title, description, threat_level')
        .gte('published_date', today)
        .order('published_date', { ascending: false })
        .limit(20);

      // Build org mention batch inserts
      const mentionsToInsert: any[] = [];
      const alertsToInsert: any[] = [];
      
      // OPTIMIZED: Batch check existing mentions ONCE before processing
      const articleIds = (todayArticles || []).map(a => a.id);
      const { data: existingMentions } = await supabase
        .from('organization_mentions')
        .select('source_id, organization_abbrev')
        .eq('source_type', 'article')
        .in('source_id', articleIds);
      
      // Create lookup set for O(1) existence checks
      const existingSet = new Set(
        (existingMentions || []).map(m => `${m.source_id}_${m.organization_abbrev}`)
      );

      for (const article of todayArticles || []) {
        const text = `${article.title} ${article.description || ''}`.toLowerCase();

        for (const org of TRACKED_ORGANIZATIONS) {
          const matched = org.variants.some(v => text.includes(v));
          if (matched) {
            // O(1) existence check using Set
            const key = `${article.id}_${org.abbrev}`;
            if (!existingSet.has(key)) {
              mentionsToInsert.push({
                organization_name: org.full,
                organization_abbrev: org.abbrev,
                source_type: 'article',
                source_id: article.id,
                source_title: article.title,
                mention_context: extractMentionContext(article.title, org.full),
                mentioned_at: new Date().toISOString(),
              });

              if (article.threat_level === 'critical' || article.threat_level === 'high') {
                alertsToInsert.push({
                  alert_type: 'org_mention',
                  priority: article.threat_level,
                  source_type: 'article',
                  source_id: article.id,
                  title: `${org.abbrev} mentioned in ${article.threat_level} alert`,
                  message: article.title,
                  metadata: { organization: org.abbrev },
                });
              }
            }
            break;
          }
        }
      }

      // Batch insert mentions and alerts - WITH THROTTLING
      if (mentionsToInsert.length > 0) {
        await supabase.from('organization_mentions').insert(mentionsToInsert);
        mentionsFound += mentionsToInsert.length;
      }
      if (alertsToInsert.length > 0) {
        // Filter out throttled alerts
        const filteredAlerts = alertsToInsert.filter(
          alert => !recentAlertKeys.has(`${alert.alert_type}-${alert.title}`)
        );
        if (filteredAlerts.length > 0) {
          await supabase.from('alert_queue').insert(filteredAlerts);
        }
        console.log(`Org mention alerts: ${filteredAlerts.length} created, ${alertsToInsert.length - filteredAlerts.length} throttled`);
      }

      // OPTIMIZED: Skip state actions check to prevent timeout
      // State actions are less frequent and can be checked separately

      results.org_mentions = { mentionsFound };
      console.log(`Tracked ${mentionsFound} organization mentions`);
    }

    // =================================================================
    // 3. GENERATE DAILY BRIEFING
    // =================================================================
    if (action === 'full' || action === 'daily_briefing') {
      console.log('Generating daily briefing...');

      // Use client's local date if provided, otherwise use server date
      const today = localDate || (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      })();
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Get briefing stats - use direct queries as fallback if RPC returns empty
      const { data: stats, error: statsError } = await supabase.rpc('get_briefing_stats', { target_date: today });
      
      // CRITICAL FIX: If stats are all zeros, query directly
      let effectiveStats = stats;
      if (!stats || (stats?.articles?.total === 0 && stats?.bills?.total === 0)) {
        console.log('RPC returned empty stats, querying directly...');
        
        // Direct query for articles
        const { count: articleTotal } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .gte('published_date', last24Hours);
        
        const { count: articleCritical } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .gte('published_date', last24Hours)
          .eq('threat_level', 'critical');
          
        const { count: articleHigh } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .gte('published_date', last24Hours)
          .eq('threat_level', 'high');
        
        // Direct query for bills
        const { count: billTotal } = await supabase
          .from('bills')
          .select('*', { count: 'exact', head: true })
          .or(`latest_action_date.gte.${last24Hours},introduced_date.gte.${last24Hours}`);
        
        effectiveStats = {
          articles: { total: articleTotal || 0, critical: articleCritical || 0, high: articleHigh || 0, medium: 0, low: 0 },
          bills: { total: billTotal || 0, critical: 0, high: 0, medium: 0, low: 0 },
          executive_orders: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
          state_actions: { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
        };
        console.log('Direct query stats:', JSON.stringify(effectiveStats));
      }

      // Get top critical/high/medium items from last 24 hours
      const { data: criticalArticles } = await supabase
        .from('articles')
        .select('id, title, threat_level, source_name, url')
        .in('threat_level', ['critical', 'high', 'medium'])
        .gte('published_date', last24Hours)
        .order('threat_level', { ascending: true })
        .limit(20);

      const { data: criticalBills } = await supabase
        .from('bills')
        .select('id, title, threat_level, bill_number')
        .in('threat_level', ['critical', 'high', 'medium'])
        .gte('latest_action_date', last24Hours)
        .order('threat_level', { ascending: true })
        .limit(20);

      const { data: criticalStateActions } = await supabase
        .from('state_actions')
        .select('id, title, threat_level, state_code')
        .in('threat_level', ['critical', 'high', 'medium'])
        .gte('action_date', last24Hours)
        .order('threat_level', { ascending: true })
        .limit(20);

      // Get breaking news clusters from last 24 hours
      const { data: breakingNews } = await supabase
        .from('breaking_news_clusters')
        .select('id')
        .eq('is_active', true)
        .gte('first_detected_at', last24Hours);

      // Get organization mentions from last 24 hours
      const { data: orgMentions } = await supabase
        .from('organization_mentions')
        .select('organization_abbrev, threat_level')
        .gte('mentioned_at', last24Hours);

      const orgSummary: Record<string, { total: number; critical: number; high: number }> = {};
      for (const mention of orgMentions || []) {
        if (!orgSummary[mention.organization_abbrev]) {
          orgSummary[mention.organization_abbrev] = { total: 0, critical: 0, high: 0 };
        }
        orgSummary[mention.organization_abbrev].total++;
        if (mention.threat_level === 'critical') orgSummary[mention.organization_abbrev].critical++;
        if (mention.threat_level === 'high') orgSummary[mention.organization_abbrev].high++;
      }

      // Calculate totals - FIXED: Use effectiveStats instead of stats
      const totalCritical =
        (effectiveStats?.articles?.critical || 0) +
        (effectiveStats?.bills?.critical || 0) +
        (effectiveStats?.executive_orders?.critical || 0) +
        (effectiveStats?.state_actions?.critical || 0);

      const totalHigh =
        (effectiveStats?.articles?.high || 0) +
        (effectiveStats?.bills?.high || 0) +
        (effectiveStats?.executive_orders?.high || 0) +
        (effectiveStats?.state_actions?.high || 0);

      // Log what we found
      console.log(`Found ${criticalArticles?.length || 0} articles, ${criticalBills?.length || 0} bills, ${criticalStateActions?.length || 0} state actions`);
      console.log(`Stats:`, JSON.stringify(effectiveStats));

      // Prepare top critical items
      const topCriticalItems = [
        ...(criticalArticles || []).map(a => ({ type: 'article', ...a })),
        ...(criticalBills || []).map(b => ({ type: 'bill', ...b })),
        ...(criticalStateActions || []).map(s => ({ type: 'state_action', ...s })),
      ];

      // Generate AI executive summary and key takeaways
      console.log('Generating AI executive summary...');
      const aiSummary = await generateAISummary({
        critical_count: totalCritical,
        high_count: totalHigh,
        total_articles: effectiveStats?.articles?.total || 0,
        total_bills: effectiveStats?.bills?.total || 0,
        top_critical_items: topCriticalItems,
        orgSummary,
      });
      console.log(`AI summary generated: ${aiSummary.executive_summary ? 'yes' : 'no'}, takeaways: ${aiSummary.key_takeaways.length}`);

      // Prepare briefing data - FIXED: Use effectiveStats + AI summary
      const briefingData = {
        briefing_date: today,
        total_articles: effectiveStats?.articles?.total || 0,
        total_bills: effectiveStats?.bills?.total || 0,
        total_executive_orders: effectiveStats?.executive_orders?.total || 0,
        total_state_actions: effectiveStats?.state_actions?.total || 0,
        critical_count: totalCritical,
        high_count: totalHigh,
        medium_count: 0,
        top_critical_items: topCriticalItems,
        breaking_news_clusters: (breakingNews || []).map(b => b.id),
        organization_mentions: orgSummary,
        executive_summary: aiSummary.executive_summary || null,
        key_takeaways: aiSummary.key_takeaways.length > 0 ? aiSummary.key_takeaways : null,
        updated_at: new Date().toISOString(),
      };

      console.log(`Upserting briefing for date: ${today}`);
      console.log(`Briefing data:`, JSON.stringify(briefingData));

      // Upsert daily briefing
      const { error: briefingError } = await supabase
        .from('daily_briefings')
        .upsert(briefingData, {
          onConflict: 'briefing_date'
        });

      if (briefingError) {
        console.error('ERROR inserting daily briefing:', briefingError);
      } else {
        console.log('✅ Daily briefing upserted successfully');
      }

      results.daily_briefing = {
        date: today,
        critical: totalCritical,
        high: totalHigh,
        breaking_news: breakingNews?.length || 0,
        organizations_mentioned: Object.keys(orgSummary).length,
        insertSuccess: !briefingError,
        error: briefingError?.message || null,
      };

      console.log(`Daily briefing generated: ${totalCritical} critical, ${totalHigh} high`);
    }

    // =================================================================
    // 4. PROCESS ALERT QUEUE
    // =================================================================
    if (action === 'full' || action === 'process_queue') {
      console.log('Processing alert queue...');

      // Get pending alerts (status = 'pending')
      const { data: alerts } = await supabase
        .from('alert_queue')
        .select('*')
        .eq('status', 'pending')
        .order('severity', { ascending: true }) // critical first
        .order('created_at', { ascending: true })
        .limit(50);

      let notificationsSent = 0;

      for (const alert of alerts || []) {
        // Get users who should receive this alert
        let userQuery = supabase
          .from('user_article_preferences')
          .select('user_id, alert_threshold, immediate_critical_alerts, watched_organizations');

        // Filter by threshold
        if (alert.severity === 'critical') {
          userQuery = userQuery.eq('immediate_critical_alerts', true);
        }

        const { data: users } = await userQuery;

        // Create notifications
        const notifications = [];
        for (const user of users || []) {
          // Check if user's threshold allows this alert
          const thresholds = ['critical', 'high', 'medium', 'low'];
          const userThresholdIndex = thresholds.indexOf(user.alert_threshold);
          const alertIndex = thresholds.indexOf(alert.severity);

          if (alertIndex <= userThresholdIndex) {
            notifications.push({
              user_id: user.user_id,
              title: alert.title,
              message: alert.message,
              priority: alert.severity,
              source_type: alert.alert_type,
              source_id: alert.id,
              link: alert.data?.url || null,
            });
          }
        }

        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications);
          notificationsSent += notifications.length;
        }

        // Mark alert as sent
        await supabase
          .from('alert_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', alert.id);
      }

      results.process_queue = {
        alertsProcessed: alerts?.length || 0,
        notificationsSent,
      };

      console.log(`Processed ${alerts?.length || 0} alerts, sent ${notificationsSent} notifications`);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in smart-alerting:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
