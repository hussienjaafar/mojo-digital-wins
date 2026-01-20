#!/usr/bin/env node
/**
 * Diagnose source distribution in trend_events
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: Set SUPABASE_URL and key environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function diagnose() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         SOURCE DISTRIBUTION DIAGNOSTIC                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Get trending events with source counts
  const { data: trends, error } = await supabase
    .from('trend_events')
    .select('event_title, source_count, news_source_count, social_source_count, evidence_count, is_event_phrase, label_quality')
    .eq('is_trending', true)
    .gte('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('confidence_score', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Total trending: ${trends.length}\n`);

  // Source count distribution
  const sourceDistribution = {};
  for (const t of trends) {
    const sc = t.source_count || 0;
    const key = sc >= 5 ? '5+' : sc.toString();
    sourceDistribution[key] = (sourceDistribution[key] || 0) + 1;
  }

  console.log('📊 SOURCE COUNT DISTRIBUTION');
  console.log('─'.repeat(40));
  for (const [count, num] of Object.entries(sourceDistribution).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    const pct = ((num / trends.length) * 100).toFixed(1);
    console.log(`  ${count} sources: ${num} trends (${pct}%)`);
  }

  // Evidence count distribution
  console.log('\n📊 EVIDENCE COUNT DISTRIBUTION');
  console.log('─'.repeat(40));
  const evidenceRanges = { '1': 0, '2-5': 0, '6-10': 0, '11-20': 0, '21+': 0 };
  for (const t of trends) {
    const ec = t.evidence_count || 0;
    if (ec === 1) evidenceRanges['1']++;
    else if (ec <= 5) evidenceRanges['2-5']++;
    else if (ec <= 10) evidenceRanges['6-10']++;
    else if (ec <= 20) evidenceRanges['11-20']++;
    else evidenceRanges['21+']++;
  }
  for (const [range, num] of Object.entries(evidenceRanges)) {
    const pct = ((num / trends.length) * 100).toFixed(1);
    console.log(`  ${range} mentions: ${num} trends (${pct}%)`);
  }

  // News vs Social distribution
  console.log('\n📊 NEWS vs SOCIAL SOURCES');
  console.log('─'.repeat(40));
  let newsOnly = 0, socialOnly = 0, both = 0, neither = 0;
  for (const t of trends) {
    const hasNews = (t.news_source_count || 0) > 0;
    const hasSocial = (t.social_source_count || 0) > 0;
    if (hasNews && hasSocial) both++;
    else if (hasNews) newsOnly++;
    else if (hasSocial) socialOnly++;
    else neither++;
  }
  console.log(`  News only: ${newsOnly} (${((newsOnly/trends.length)*100).toFixed(1)}%)`);
  console.log(`  Social only: ${socialOnly} (${((socialOnly/trends.length)*100).toFixed(1)}%)`);
  console.log(`  Both: ${both} (${((both/trends.length)*100).toFixed(1)}%)`);
  console.log(`  Neither: ${neither} (${((neither/trends.length)*100).toFixed(1)}%)`);

  // Label quality distribution
  console.log('\n📊 LABEL QUALITY DISTRIBUTION');
  console.log('─'.repeat(40));
  const labelQuality = {};
  for (const t of trends) {
    const lq = t.label_quality || 'unknown';
    labelQuality[lq] = (labelQuality[lq] || 0) + 1;
  }
  for (const [quality, num] of Object.entries(labelQuality)) {
    const pct = ((num / trends.length) * 100).toFixed(1);
    console.log(`  ${quality}: ${num} (${pct}%)`);
  }

  // Event phrase distribution
  console.log('\n📊 EVENT PHRASE STATUS');
  console.log('─'.repeat(40));
  const eventPhrases = trends.filter(t => t.is_event_phrase).length;
  const entities = trends.length - eventPhrases;
  console.log(`  Event phrases: ${eventPhrases} (${((eventPhrases/trends.length)*100).toFixed(1)}%)`);
  console.log(`  Entity-only: ${entities} (${((entities/trends.length)*100).toFixed(1)}%)`);

  // Sample trends with high vs low source counts
  console.log('\n📋 SAMPLE: HIGH SOURCE COUNT TRENDS (3+)');
  console.log('─'.repeat(60));
  const highSource = trends.filter(t => (t.source_count || 0) >= 3).slice(0, 10);
  if (highSource.length === 0) {
    console.log('  (No trends with 3+ sources)');
  } else {
    for (const t of highSource) {
      console.log(`  • "${t.event_title}" - ${t.source_count} sources, ${t.evidence_count} mentions`);
    }
  }

  console.log('\n📋 SAMPLE: LOW SOURCE COUNT TRENDS (1)');
  console.log('─'.repeat(60));
  const lowSource = trends.filter(t => (t.source_count || 0) === 1).slice(0, 10);
  for (const t of lowSource) {
    console.log(`  • "${t.event_title}" - ${t.source_count} source, ${t.evidence_count} mentions`);
  }

  // Check trend_evidence for domain diversity
  console.log('\n📋 CHECKING EVIDENCE TABLE FOR DOMAIN DATA');
  console.log('─'.repeat(60));

  const { data: evidence, error: evidenceError } = await supabase
    .from('trend_evidence')
    .select('event_id, source_domain, source_type')
    .limit(500);

  if (evidenceError) {
    console.log('  Error:', evidenceError.message);
  } else if (evidence && evidence.length > 0) {
    const domains = new Set(evidence.map(e => e.source_domain).filter(Boolean));
    const sourceTypes = {};
    for (const e of evidence) {
      sourceTypes[e.source_type] = (sourceTypes[e.source_type] || 0) + 1;
    }
    console.log(`  Total evidence records: ${evidence.length}`);
    console.log(`  Unique domains in evidence: ${domains.size}`);
    console.log(`  Source types: ${JSON.stringify(sourceTypes)}`);
    console.log(`  Sample domains: ${[...domains].slice(0, 20).join(', ')}`);

    // Check domain-per-event distribution
    const eventDomains = new Map();
    for (const e of evidence) {
      if (!eventDomains.has(e.event_id)) {
        eventDomains.set(e.event_id, new Set());
      }
      if (e.source_domain) {
        eventDomains.get(e.event_id).add(e.source_domain);
      }
    }

    const domainCounts = {};
    for (const [_, domains] of eventDomains) {
      const count = domains.size;
      const key = count >= 5 ? '5+' : count.toString();
      domainCounts[key] = (domainCounts[key] || 0) + 1;
    }
    console.log(`\n  Domains per event distribution: ${JSON.stringify(domainCounts)}`);
  } else {
    console.log('  No evidence data found');
  }

  // Check Google News for canonical_url presence
  console.log('\n📋 CHECKING GOOGLE NEWS CANONICAL URLs');
  console.log('─'.repeat(60));

  const { data: gnSample, error: gnError } = await supabase
    .from('google_news_articles')
    .select('url, canonical_url')
    .eq('ai_processed', true)
    .limit(20);

  if (gnError) {
    console.log('  Error:', gnError.message);
  } else if (gnSample && gnSample.length > 0) {
    let hasCanonical = 0;
    let googleUrls = 0;
    for (const gn of gnSample) {
      if (gn.canonical_url) hasCanonical++;
      if (gn.url?.includes('news.google.com')) googleUrls++;
    }
    console.log(`  Sample size: ${gnSample.length}`);
    console.log(`  With canonical_url: ${hasCanonical} (${(hasCanonical/gnSample.length*100).toFixed(0)}%)`);
    console.log(`  URLs containing news.google.com: ${googleUrls}`);
    console.log(`  Sample URLs:`);
    for (const gn of gnSample.slice(0, 5)) {
      console.log(`    URL: ${gn.url?.substring(0, 60)}...`);
      console.log(`    Canonical: ${gn.canonical_url?.substring(0, 60) || 'NONE'}...`);
      console.log('');
    }
  }
}

diagnose();
