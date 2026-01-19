#!/usr/bin/env node
/**
 * Local Phase 1 Trend Quality Audit
 *
 * Runs the audit logic directly against the database without needing
 * the edge function deployed. This is useful for local development.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/local-trend-audit.mjs
 *
 * Or if .env contains the values:
 *   node --env-file=.env scripts/local-trend-audit.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

// Try multiple env var names for flexibility
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) {
  console.error('Error: Set SUPABASE_URL environment variable');
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error('Error: Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

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

async function runAudit() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        LOCAL PHASE 1: TREND QUALITY AUDIT                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    const timestamp = new Date().toISOString();
    const lookback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    console.log('Fetching trending events from last 24 hours...\n');

    // Fetch all trending events
    const { data: trends, error } = await supabase
      .from('trend_events')
      .select('*')
      .eq('is_trending', true)
      .gte('last_seen_at', lookback)
      .order('confidence_score', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch trends: ${error.message}`);
    }

    if (!trends || trends.length === 0) {
      console.log('⚠️  No trending events found in the last 24 hours.');
      console.log('This could mean:');
      console.log('  - The trend detection job has not run recently');
      console.log('  - No topics have crossed the trending threshold');
      console.log('  - The database is empty or inaccessible');
      return;
    }

    console.log(`Found ${trends.length} trending events\n`);

    const results = [];

    // ========================================================================
    // AGENT 20: TREND QUALITY AUDIT
    // ========================================================================
    console.log('📊 Running Agent 20: Trend Quality Audit...');

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

    // ========================================================================
    // AGENT 21: DUPLICATE DETECTION AUDIT
    // ========================================================================
    console.log('📊 Running Agent 21: Duplicate Detection Audit...');

    // Check for exact duplicates
    const titleSet = new Set();
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
    const nearDupePairs = [];

    for (let i = 0; i < trends.length && i < 100; i++) { // Limit for performance
      for (let j = i + 1; j < trends.length && j < 100; j++) {
        const wordsA = new Set((trends[i].event_title || '').toLowerCase().split(/\s+/));
        const wordsB = new Set((trends[j].event_title || '').toLowerCase().split(/\s+/));
        const intersection = [...wordsA].filter(w => wordsB.has(w) && w.length > 2);
        const union = new Set([...wordsA, ...wordsB]);
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

    // ========================================================================
    // AGENT 22: EVERGREEN TOPIC AUDIT
    // ========================================================================
    console.log('📊 Running Agent 22: Evergreen Topic Audit...');

    let totalEvergreen = 0;
    let evergreenWithoutSpike = 0;
    let evergreenSingleWord = 0;
    const evergreenIssues = [];

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

    // ========================================================================
    // SUMMARY
    // ========================================================================
    const passCount = results.filter(r => r.status === 'pass').length;
    const warnCount = results.filter(r => r.status === 'warning').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    const summary = {
      timestamp,
      total_checks: results.length,
      passed: passCount,
      warnings: warnCount,
      failed: failCount,
      health_score: Math.round(100 * (passCount + warnCount * 0.5) / results.length)
    };

    // ========================================================================
    // DISPLAY RESULTS
    // ========================================================================
    console.log('\n');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ AUDIT SUMMARY                                                   │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log(`│ Health Score: ${summary.health_score}%`.padEnd(65) + '│');
    console.log(`│ Total Checks: ${summary.total_checks}`.padEnd(65) + '│');
    console.log(`│ ✅ Passed: ${summary.passed}`.padEnd(64) + '│');
    console.log(`│ ⚠️  Warnings: ${summary.warnings}`.padEnd(63) + '│');
    console.log(`│ ❌ Failed: ${summary.failed}`.padEnd(64) + '│');
    console.log('└─────────────────────────────────────────────────────────────────┘\n');

    // Display detailed results by agent
    const agents = [...new Set(results.map(r => r.agent))];

    for (const agent of agents) {
      const agentResults = results.filter(r => r.agent === agent);
      console.log(`\n📊 ${agent.toUpperCase()}`);
      console.log('─'.repeat(60));

      for (const result of agentResults) {
        const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️ ' : '❌';
        console.log(`${icon} ${result.metric}: ${result.value}`);
        if (result.recommendation) {
          console.log(`   └─ 💡 ${result.recommendation}`);
        }
      }
    }

    // Display near duplicates if found
    if (nearDupePairs.length > 0) {
      console.log('\n\n🔄 NEAR-DUPLICATE PAIRS DETECTED');
      console.log('─'.repeat(60));
      for (const pair of nearDupePairs) {
        console.log(`\n• "${pair.a}"`);
        console.log(`  ≈ "${pair.b}" (${pair.overlap}% overlap)`);
      }
    }

    // Display evergreen issues if found
    if (evergreenIssues.length > 0) {
      console.log('\n\n🌲 EVERGREEN TOPIC ISSUES');
      console.log('─'.repeat(60));
      for (const issue of evergreenIssues) {
        console.log(`\n• "${issue.title}"`);
        console.log(`  Issue: ${issue.issue} | Z-Score: ${issue.z_score?.toFixed(2) || 'N/A'}`);
      }
    }

    // Display top trends for reference
    console.log('\n\n🔝 TOP 10 CURRENT TRENDS');
    console.log('─'.repeat(60));
    for (const trend of trends.slice(0, 10)) {
      const eventTag = trend.is_event_phrase ? '📰' : '🏷️';
      console.log(`${eventTag} ${trend.event_title}`);
      console.log(`   Score: ${trend.confidence_score} | Z: ${trend.z_score_velocity?.toFixed(2) || 'N/A'} | Sources: ${trend.source_count}`);
    }

    // Display sample problematic trends
    const problematic = trends.filter(t => {
      const wordCount = (t.event_title || '').split(/\s+/).filter(Boolean).length;
      return wordCount === 1 || !t.is_event_phrase || (t.source_count || 0) < 2;
    }).slice(0, 15);

    if (problematic.length > 0) {
      console.log('\n\n📋 SAMPLE PROBLEMATIC TRENDS');
      console.log('─'.repeat(60));
      for (const t of problematic) {
        const wordCount = (t.event_title || '').split(/\s+/).filter(Boolean).length;
        let issueType = 'OK';
        if (wordCount === 1) issueType = 'SINGLE_WORD';
        else if (!t.is_event_phrase) issueType = 'NOT_EVENT_PHRASE';
        else if ((t.source_count || 0) < 3) issueType = 'LOW_SOURCES';

        console.log(`\n• "${t.event_title}"`);
        console.log(`  Issue: ${issueType} | Words: ${wordCount} | Sources: ${t.source_count} | Score: ${t.confidence_score}`);
      }
    }

    console.log('\n\n' + '═'.repeat(60));
    console.log('Audit completed at:', timestamp);
    console.log('═'.repeat(60));

    // Exit code based on failures
    if (failCount > 0) {
      console.log('\n⚠️  Audit found issues that need attention.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Audit failed:', error.message);
    process.exit(1);
  }
}

runAudit();
