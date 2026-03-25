import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";

/**
 * Debug Query Function
 *
 * Runs predefined diagnostic queries against the database.
 * Secured via CRON_SECRET or admin JWT.
 *
 * Usage: POST with { "query": "query_name", "params": {...} }
 */

const corsHeaders = getCorsHeaders();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Require admin auth or cron secret
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const queryName = body.query || 'status';
    const params = body.params || {};

    let result: any = {};

    switch (queryName) {
      // =========================================================================
      // SYSTEM STATUS
      // =========================================================================
      case 'status': {
        const [trends, evidence, articles, jobs] = await Promise.all([
          supabase.from('trend_events').select('*', { count: 'exact', head: true }),
          supabase.from('trend_evidence').select('*', { count: 'exact', head: true }),
          supabase.from('google_news_articles').select('*', { count: 'exact', head: true }),
          supabase.from('scheduled_jobs').select('job_name, job_type, is_active, last_run_at, last_run_status').eq('is_active', true),
        ]);

        const { count: trendingCount } = await supabase
          .from('trend_events')
          .select('*', { count: 'exact', head: true })
          .eq('is_trending', true);

        const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: recentArticles } = await supabase
          .from('google_news_articles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', cutoff);

        result = {
          counts: {
            trend_events: trends.count,
            trending: trendingCount,
            trend_evidence: evidence.count,
            google_news_articles: articles.count,
            articles_last_hour: recentArticles,
          },
          jobs: jobs.data,
        };
        break;
      }

      // =========================================================================
      // TRENDING TOPICS
      // =========================================================================
      case 'trending': {
        const limit = params.limit || 30;
        const { data, error } = await supabase
          .from('trend_events')
          .select('event_title, canonical_label, confidence_score, is_event_phrase, label_quality, label_source, source_count, z_score_velocity, is_breaking, first_seen_at, last_seen_at')
          .eq('is_trending', true)
          .order('confidence_score', { ascending: false })
          .limit(limit);

        if (error) throw error;
        result = { trends: data, count: data?.length };
        break;
      }

      // =========================================================================
      // TREND DETAIL
      // =========================================================================
      case 'trend_detail': {
        const eventTitle = params.event_title;
        if (!eventTitle) {
          result = { error: 'event_title parameter required' };
          break;
        }

        const { data: trend } = await supabase
          .from('trend_events')
          .select('*')
          .ilike('event_title', `%${eventTitle}%`)
          .limit(1)
          .single();

        if (!trend) {
          result = { error: 'Trend not found' };
          break;
        }

        const { data: evidence } = await supabase
          .from('trend_evidence')
          .select('headline, source_domain, source_type, source_tier, published_at')
          .eq('event_id', trend.id)
          .order('published_at', { ascending: false })
          .limit(20);

        result = { trend, evidence };
        break;
      }

      // =========================================================================
      // EVENT PHRASE METRICS
      // =========================================================================
      case 'event_phrase_metrics': {
        const { data: allTrending } = await supabase
          .from('trend_events')
          .select('is_event_phrase, label_source, event_title')
          .eq('is_trending', true);

        const total = allTrending?.length || 0;
        const eventPhrases = allTrending?.filter(t => t.is_event_phrase).length || 0;
        const singleWord = allTrending?.filter(t => (t.event_title || '').split(/\s+/).filter(Boolean).length === 1).length || 0;

        // Group by label_source
        const bySource: Record<string, { total: number; eventPhrase: number }> = {};
        for (const t of allTrending || []) {
          const src = t.label_source || 'null';
          if (!bySource[src]) bySource[src] = { total: 0, eventPhrase: 0 };
          bySource[src].total++;
          if (t.is_event_phrase) bySource[src].eventPhrase++;
        }

        result = {
          total,
          event_phrases: eventPhrases,
          event_phrase_rate: total > 0 ? Math.round(1000 * eventPhrases / total) / 10 : 0,
          single_word_count: singleWord,
          single_word_rate: total > 0 ? Math.round(1000 * singleWord / total) / 10 : 0,
          by_label_source: bySource,
        };
        break;
      }

      // =========================================================================
      // SOURCE METRICS
      // =========================================================================
      case 'source_metrics': {
        const { data: trending } = await supabase
          .from('trend_events')
          .select('source_count, news_source_count, social_source_count')
          .eq('is_trending', true);

        const total = trending?.length || 0;
        const multiSource = trending?.filter(t => (t.source_count || 0) >= 3).length || 0;

        const distribution: Record<string, number> = {};
        for (const t of trending || []) {
          const sc = t.source_count || 0;
          const key = sc >= 5 ? '5+' : sc.toString();
          distribution[key] = (distribution[key] || 0) + 1;
        }

        result = {
          total,
          multi_source_count: multiSource,
          multi_source_rate: total > 0 ? Math.round(1000 * multiSource / total) / 10 : 0,
          distribution,
        };
        break;
      }

      // =========================================================================
      // SCHEDULED JOBS
      // =========================================================================
      case 'jobs': {
        const { data: jobs } = await supabase
          .from('scheduled_jobs')
          .select('*')
          .order('job_name');

        const { data: recentExecs } = await supabase
          .from('job_executions')
          .select('job_id, status, started_at, completed_at, error_message, duration_ms')
          .order('started_at', { ascending: false })
          .limit(50);

        result = { jobs, recent_executions: recentExecs };
        break;
      }

      // =========================================================================
      // LABEL SOURCE ANALYSIS
      // =========================================================================
      case 'label_analysis': {
        const { data: samples } = await supabase
          .from('trend_events')
          .select('event_title, canonical_label, is_event_phrase, label_source, label_quality')
          .eq('is_trending', true)
          .order('confidence_score', { ascending: false })
          .limit(50);

        // Find examples where canonical_label is richer than event_title
        const richContext = samples?.filter(s =>
          s.canonical_label &&
          s.canonical_label.length > (s.event_title?.length || 0) + 10
        ).slice(0, 20);

        // Find fallback_attempted failures
        const fallbackFailed = samples?.filter(s =>
          s.label_source === 'fallback_attempted' && !s.is_event_phrase
        ).slice(0, 10);

        // Find downgraded phrases
        const downgraded = samples?.filter(s =>
          s.label_source === 'event_phrase_downgraded'
        ).slice(0, 10);

        result = {
          samples_with_rich_context: richContext,
          fallback_failures: fallbackFailed,
          downgraded_phrases: downgraded,
        };
        break;
      }

      // =========================================================================
      // RAW SQL (admin only, be careful)
      // =========================================================================
      case 'sql': {
        const sql = params.sql;
        if (!sql) {
          result = { error: 'sql parameter required' };
          break;
        }
        // Only allow SELECT queries
        if (!sql.trim().toLowerCase().startsWith('select')) {
          result = { error: 'Only SELECT queries allowed' };
          break;
        }
        const { data, error } = await supabase.rpc('exec_sql', { query: sql });
        if (error) {
          result = { error: error.message };
        } else {
          result = { data };
        }
        break;
      }

      default:
        result = {
          error: 'Unknown query',
          available_queries: [
            'status - System overview',
            'trending - List trending topics',
            'trend_detail - Get trend with evidence (params: event_title)',
            'event_phrase_metrics - Event phrase rate breakdown',
            'source_metrics - Multi-source rate breakdown',
            'jobs - Scheduled jobs and recent executions',
            'label_analysis - Analyze label quality issues',
          ],
        };
    }

    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Debug query error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
