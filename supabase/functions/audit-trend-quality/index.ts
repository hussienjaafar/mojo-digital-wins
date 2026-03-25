import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";

/**
 * Trend Quality Audit Function
 *
 * Runs comprehensive audits on trend quality:
 * - Agent 20: Trend Quality (label quality, noise, actionability)
 * - Agent 21: Duplicate Detection
 * - Agent 22: Evergreen Topic Handling
 *
 * Returns detailed audit results with recommendations.
 */

const corsHeaders = getCorsHeaders();

interface AuditResult {
  agent: string;
  category: string;
  metric: string;
  value: string | number;
  status: 'pass' | 'warning' | 'fail';
  recommendation?: string;
}

// Evergreen entity list
const EVERGREEN_ENTITIES = [
  'trump', 'biden', 'harris', 'gaza', 'israel', 'ukraine', 'russia', 'musk',
  'china', 'iran', 'netanyahu', 'zelensky', 'putin'
];

// Action verbs for event phrase detection
const ACTION_VERBS = [
  'passes', 'blocks', 'signs', 'announces', 'launches', 'faces',
  'wins', 'loses', 'approves', 'rejects', 'fires', 'nominates',
  'confirms', 'denies', 'vetoes', 'introduces', 'proposes'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Require admin auth
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: AuditResult[] = [];
    const timestamp = new Date().toISOString();
    const lookback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // =========================================================================
    // FETCH ALL TRENDING EVENTS
    // =========================================================================

    const { data: trendingEvents, error: fetchError } = await supabase
      .from('trend_events')
      .select('*')
      .eq('is_trending', true)
      .gte('last_seen_at', lookback)
      .order('confidence_score', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch trends: ${fetchError.message}`);
    }

    const trends = trendingEvents || [];

    // =========================================================================
    // AGENT 20: TREND QUALITY AUDIT
    // =========================================================================

    // Analyze label quality
    let eventPhrases = 0;
    let actionPhrases = 0;
    let singleWordEntities = 0;
    let twoWordPhrases = 0;
    let multiWordGeneric = 0;

    for (const trend of trends) {
      const wordCount = (trend.event_title || '').split(/\s+/).filter(Boolean).length;
      const hasActionVerb = ACTION_VERBS.some(v =>
        (trend.event_title || '').toLowerCase().includes(v)
      );

      if (trend.is_event_phrase) {
        eventPhrases++;
      } else if (wordCount === 1) {
        singleWordEntities++;
      } else if (wordCount === 2) {
        twoWordPhrases++;
      } else if (hasActionVerb) {
        actionPhrases++;
      } else {
        multiWordGeneric++;
      }
    }

    const totalTrends = trends.length;

    const eventPhrasePct = totalTrends > 0 ? Math.round(100 * (eventPhrases + actionPhrases) / totalTrends) : 0;
    const singleWordPct = totalTrends > 0 ? Math.round(100 * singleWordEntities / totalTrends) : 0;

    results.push({
      agent: '20-trend-quality',
      category: 'Label Quality',
      metric: 'Total Trending Topics',
      value: totalTrends,
      status: totalTrends > 10 ? 'pass' : totalTrends > 0 ? 'warning' : 'fail'
    });

    results.push({
      agent: '20-trend-quality',
      category: 'Label Quality',
      metric: 'Event Phrase Rate (%)',
      value: eventPhrasePct,
      status: eventPhrasePct >= 50 ? 'pass' : eventPhrasePct >= 30 ? 'warning' : 'fail',
      recommendation: eventPhrasePct < 50 ? 'Improve event phrase extraction - target >50%' : undefined
    });

    results.push({
      agent: '20-trend-quality',
      category: 'Label Quality',
      metric: 'Single-Word Entity Rate (%)',
      value: singleWordPct,
      status: singleWordPct <= 15 ? 'pass' : singleWordPct <= 25 ? 'warning' : 'fail',
      recommendation: singleWordPct > 15 ? 'Increase evergreen penalties - target <15%' : undefined
    });

    // Source Count Analysis
    const singleSourceTrends = trends.filter(t => (t.source_count || 0) === 1).length;
    const multiSourceTrends = trends.filter(t => (t.source_count || 0) >= 3).length;
    const avgSources = totalTrends > 0
      ? Math.round(10 * trends.reduce((sum, t) => sum + (t.source_count || 0), 0) / totalTrends) / 10
      : 0;
    const multiSourcePct = totalTrends > 0 ? Math.round(100 * multiSourceTrends / totalTrends) : 0;

    results.push({
      agent: '20-trend-quality',
      category: 'Source Quality',
      metric: 'Multi-Source Rate (3+) (%)',
      value: multiSourcePct,
      status: multiSourcePct >= 70 ? 'pass' : multiSourcePct >= 50 ? 'warning' : 'fail',
      recommendation: multiSourcePct < 70 ? 'Require more corroboration - target >70%' : undefined
    });

    results.push({
      agent: '20-trend-quality',
      category: 'Source Quality',
      metric: 'Avg Sources per Trend',
      value: avgSources,
      status: avgSources >= 3 ? 'pass' : 'warning'
    });

    // Confidence Score Analysis
    const avgConfidence = totalTrends > 0
      ? Math.round(10 * trends.reduce((sum, t) => sum + (t.confidence_score || 0), 0) / totalTrends) / 10
      : 0;
    const highConfidenceCount = trends.filter(t => (t.confidence_score || 0) >= 70).length;

    results.push({
      agent: '20-trend-quality',
      category: 'Confidence',
      metric: 'Avg Confidence Score',
      value: avgConfidence,
      status: avgConfidence >= 50 ? 'pass' : 'warning'
    });

    results.push({
      agent: '20-trend-quality',
      category: 'Confidence',
      metric: 'High Confidence (>=70) Count',
      value: highConfidenceCount,
      status: highConfidenceCount >= 5 ? 'pass' : 'warning'
    });

    // =========================================================================
    // AGENT 21: DUPLICATE DETECTION AUDIT
    // =========================================================================

    // Check for exact duplicates
    const titleSet = new Set<string>();
    let exactDupeCount = 0;
    for (const trend of trends) {
      const normalizedTitle = (trend.event_title || '').toLowerCase().trim();
      if (titleSet.has(normalizedTitle)) {
        exactDupeCount++;
      } else {
        titleSet.add(normalizedTitle);
      }
    }

    results.push({
      agent: '21-duplicate-detector',
      category: 'Exact Duplicates',
      metric: 'Exact Title Duplicates',
      value: exactDupeCount,
      status: exactDupeCount === 0 ? 'pass' : 'fail',
      recommendation: exactDupeCount > 0 ? 'Implement deduplication in trend detection' : undefined
    });

    // Check for near-duplicates using simple word overlap
    let nearDupeCount = 0;
    const nearDupePairs: Array<{ a: string; b: string; overlap: number }> = [];

    for (let i = 0; i < trends.length; i++) {
      for (let j = i + 1; j < trends.length; j++) {
        const wordsA: Set<string> = new Set((trends[i].event_title || '').toLowerCase().split(/\s+/));
        const wordsB: Set<string> = new Set((trends[j].event_title || '').toLowerCase().split(/\s+/));
        const intersection = [...wordsA].filter((w: string) => wordsB.has(w) && w.length > 2);
        const union: Set<string> = new Set([...wordsA, ...wordsB]);
        const overlap = intersection.length / union.size;

        if (overlap > 0.6) {
          nearDupeCount++;
          if (nearDupePairs.length < 10) {
            nearDupePairs.push({
              a: trends[i].event_title,
              b: trends[j].event_title,
              overlap: Math.round(overlap * 100)
            });
          }
        }
      }
    }

    results.push({
      agent: '21-duplicate-detector',
      category: 'Near Duplicates',
      metric: 'Similar Title Pairs (>60% word overlap)',
      value: nearDupeCount,
      status: nearDupeCount <= 5 ? 'pass' : nearDupeCount <= 15 ? 'warning' : 'fail',
      recommendation: nearDupeCount > 5 ? 'Implement semantic deduplication' : undefined
    });

    // =========================================================================
    // AGENT 22: EVERGREEN TOPIC AUDIT
    // =========================================================================

    // Check evergreen entities trending
    let totalEvergreen = 0;
    let evergreenWithoutSpike = 0;
    let evergreenSingleWord = 0;
    const evergreenIssues: Array<{ title: string; z_score: number; issue: string }> = [];

    for (const trend of trends) {
      const titleLower = (trend.event_title || '').toLowerCase();
      const isEvergreen = EVERGREEN_ENTITIES.some(e => titleLower.includes(e));

      if (isEvergreen) {
        totalEvergreen++;
        const wordCount = (trend.event_title || '').split(/\s+/).filter(Boolean).length;
        const zScore = trend.z_score_velocity || 0;

        if (zScore < 2) {
          evergreenWithoutSpike++;
          if (evergreenIssues.length < 10) {
            evergreenIssues.push({
              title: trend.event_title,
              z_score: zScore,
              issue: 'LOW_VELOCITY'
            });
          }
        }

        if (wordCount === 1) {
          evergreenSingleWord++;
          if (evergreenIssues.length < 10) {
            evergreenIssues.push({
              title: trend.event_title,
              z_score: zScore,
              issue: 'SINGLE_WORD_ENTITY'
            });
          }
        }
      }
    }

    results.push({
      agent: '22-evergreen-topic',
      category: 'Evergreen Handling',
      metric: 'Evergreen Topics Trending',
      value: totalEvergreen,
      status: 'pass' // Informational
    });

    results.push({
      agent: '22-evergreen-topic',
      category: 'Evergreen Handling',
      metric: 'Without Spike (z<2)',
      value: evergreenWithoutSpike,
      status: evergreenWithoutSpike === 0 ? 'pass' : evergreenWithoutSpike <= 3 ? 'warning' : 'fail',
      recommendation: evergreenWithoutSpike > 0 ? 'Increase z-score threshold for evergreen topics' : undefined
    });

    results.push({
      agent: '22-evergreen-topic',
      category: 'Evergreen Handling',
      metric: 'Single-Word Evergreen',
      value: evergreenSingleWord,
      status: evergreenSingleWord === 0 ? 'pass' : 'fail',
      recommendation: evergreenSingleWord > 0 ? 'Single-word evergreen entities should not trend' : undefined
    });

    // =========================================================================
    // SUMMARY
    // =========================================================================

    const passCount = results.filter(r => r.status === 'pass').length;
    const warnCount = results.filter(r => r.status === 'warning').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    const summary = {
      timestamp,
      total_checks: results.length,
      passed: passCount,
      warnings: warnCount,
      failed: failCount,
      health_score: Math.round(100 * (passCount + warnCount * 0.5) / results.length),
      critical_issues: results.filter(r => r.status === 'fail').map(r => ({
        metric: r.metric,
        value: r.value,
        recommendation: r.recommendation
      }))
    };

    // Get sample problematic trends
    const sampleIssues = trends
      .filter(t => {
        const wordCount = (t.event_title || '').split(/\s+/).filter(Boolean).length;
        return wordCount === 1 || !t.is_event_phrase || (t.source_count || 0) < 2;
      })
      .slice(0, 15)
      .map(t => {
        const wordCount = (t.event_title || '').split(/\s+/).filter(Boolean).length;
        let issueType = 'OK';
        if (wordCount === 1) issueType = 'SINGLE_WORD';
        else if (!t.is_event_phrase) issueType = 'NOT_EVENT_PHRASE';
        else if ((t.source_count || 0) < 3) issueType = 'LOW_SOURCES';
        else if ((t.z_score_velocity || 0) < 2) issueType = 'LOW_VELOCITY';

        return {
          event_title: t.event_title,
          confidence_score: t.confidence_score,
          z_score_velocity: t.z_score_velocity,
          source_count: t.source_count,
          is_event_phrase: t.is_event_phrase,
          word_count: wordCount,
          issue_type: issueType
        };
      });

    // Top 10 trends for reference
    const topTrends = trends.slice(0, 10).map(t => ({
      event_title: t.event_title,
      confidence_score: t.confidence_score,
      z_score_velocity: t.z_score_velocity,
      source_count: t.source_count,
      is_event_phrase: t.is_event_phrase
    }));

    return new Response(
      JSON.stringify({
        audit_type: 'trend_quality_phase1',
        timestamp,
        summary,
        results,
        sample_issues: sampleIssues,
        near_duplicate_pairs: nearDupePairs,
        evergreen_issues: evergreenIssues,
        top_trends: topTrends
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Audit error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
