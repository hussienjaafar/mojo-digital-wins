#!/usr/bin/env node
/**
 * Phase 1 Trend Quality Audit Runner
 *
 * Calls the audit-trend-quality edge function and displays results.
 *
 * Usage:
 *   node scripts/run-trend-audit.mjs
 *
 * Requires:
 *   - SUPABASE_URL environment variable
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable (for admin auth)
 *   OR
 *   - A valid admin JWT token
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Error: SUPABASE_URL or VITE_SUPABASE_URL environment variable required');
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable required for admin auth');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runAudit() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║            PHASE 1: TREND QUALITY AUDIT                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  try {
    // Call the audit function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/audit-trend-quality`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    // Display Summary
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ SUMMARY                                                         │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log(`│ Health Score: ${data.summary.health_score}%                     `);
    console.log(`│ Total Checks: ${data.summary.total_checks}                      `);
    console.log(`│ ✅ Passed: ${data.summary.passed}                                `);
    console.log(`│ ⚠️  Warnings: ${data.summary.warnings}                           `);
    console.log(`│ ❌ Failed: ${data.summary.failed}                               `);
    console.log('└─────────────────────────────────────────────────────────────────┘\n');

    // Display detailed results by agent
    const agents = [...new Set(data.results.map(r => r.agent))];

    for (const agent of agents) {
      const agentResults = data.results.filter(r => r.agent === agent);
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

    // Display critical issues
    if (data.summary.critical_issues.length > 0) {
      console.log('\n\n🚨 CRITICAL ISSUES REQUIRING ATTENTION');
      console.log('═'.repeat(60));
      for (const issue of data.summary.critical_issues) {
        console.log(`\n❌ ${issue.metric}: ${issue.value}`);
        if (issue.recommendation) {
          console.log(`   └─ Fix: ${issue.recommendation}`);
        }
      }
    }

    // Display sample issues
    if (data.sample_issues && data.sample_issues.length > 0) {
      console.log('\n\n📋 SAMPLE PROBLEMATIC TRENDS');
      console.log('─'.repeat(60));
      for (const issue of data.sample_issues.slice(0, 10)) {
        console.log(`\n• "${issue.event_title}"`);
        console.log(`  Issue: ${issue.issue_type} | Words: ${issue.word_count} | Sources: ${issue.source_count} | Confidence: ${issue.confidence_score}`);
      }
    }

    // Display near duplicates
    if (data.near_duplicate_pairs && data.near_duplicate_pairs.length > 0) {
      console.log('\n\n🔄 NEAR-DUPLICATE PAIRS DETECTED');
      console.log('─'.repeat(60));
      for (const pair of data.near_duplicate_pairs.slice(0, 5)) {
        console.log(`\n• "${pair.a}"`);
        console.log(`  ≈ "${pair.b}" (${pair.overlap}% overlap)`);
      }
    }

    // Display top trends for reference
    if (data.top_trends && data.top_trends.length > 0) {
      console.log('\n\n🔝 TOP 10 CURRENT TRENDS (For Reference)');
      console.log('─'.repeat(60));
      for (const trend of data.top_trends) {
        const eventTag = trend.is_event_phrase ? '📰' : '🏷️';
        console.log(`${eventTag} ${trend.event_title}`);
        console.log(`   Confidence: ${trend.confidence_score} | Z-Score: ${trend.z_score_velocity?.toFixed(2) || 'N/A'} | Sources: ${trend.source_count}`);
      }
    }

    console.log('\n\n' + '═'.repeat(60));
    console.log('Audit completed at:', data.timestamp);
    console.log('═'.repeat(60));

    // Return exit code based on failures
    if (data.summary.failed > 0) {
      console.log('\n⚠️  Audit found issues that need attention.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Audit failed:', error.message);
    process.exit(1);
  }
}

runAudit();
