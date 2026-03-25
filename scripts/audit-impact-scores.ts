#!/usr/bin/env npx tsx
/**
 * Audit Impact Score Calculations
 *
 * Checks why states are showing red/gray on the map by:
 * 1. Calculating actual impact scores
 * 2. Checking margin_votes data
 * 3. Identifying flippable districts
 *
 * Usage:
 *   npx tsx scripts/audit-impact-scores.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface StateRecord {
  state_code: string;
  state_name: string;
  muslim_voters: number;
  vote_2024_pct: number;
}

interface DistrictRecord {
  cd_code: string;
  state_code: string;
  muslim_voters: number;
  didnt_vote_2024: number;
  margin_votes: number | null;
  margin_pct: number | null;
  can_impact: boolean;
}

// Replicate the exact calculation from voter-impact.ts
function calculateImpactScore(district: DistrictRecord): number {
  if (!district.muslim_voters || district.muslim_voters === 0) {
    return 0;
  }
  if (!district.margin_votes || district.margin_votes <= 0) {
    return 0;
  }
  const mobilizable = district.didnt_vote_2024 || 0;
  if (mobilizable === 0) {
    return 0;
  }
  const surplusRatio = mobilizable / district.margin_votes;
  if (surplusRatio >= 1) {
    const surplus = Math.min(surplusRatio - 1, 9);
    return Math.min(1, 0.5 + surplus * 0.055);
  } else {
    return surplusRatio * 0.5;
  }
}

function calculateStateImpactScore(state: StateRecord, districts: DistrictRecord[]): number {
  if (!state.muslim_voters || state.muslim_voters === 0) {
    return 0;
  }
  const districtsWithData = districts.filter(
    (d) => d.muslim_voters > 0 && d.margin_votes && d.margin_votes > 0
  );
  if (districtsWithData.length === 0) {
    const turnout2024 = state.vote_2024_pct || 0;
    const turnoutGap = 1 - turnout2024;
    const populationScore = Math.min(1, state.muslim_voters / 100000);
    return Math.min(1, populationScore * (0.3 + turnoutGap * 0.4));
  }
  const flippableDistricts = districtsWithData.filter((d) => {
    const mobilizable = d.didnt_vote_2024 || 0;
    return mobilizable >= (d.margin_votes || Infinity);
  });
  const flippableRatio = flippableDistricts.length / districtsWithData.length;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const district of districtsWithData) {
    const districtImpact = calculateImpactScore(district);
    const weight = district.muslim_voters;
    weightedSum += districtImpact * weight;
    totalWeight += weight;
  }
  const avgDistrictImpact = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return Math.min(1, flippableRatio * 0.4 + avgDistrictImpact * 0.6);
}

function getColorCategory(score: number): string {
  if (score >= 0.5) return '🟢 HIGH';
  if (score >= 0.25) return '🟡 MEDIUM';
  if (score >= 0.05) return '🔴 LOW';
  return '⬛ NONE';
}

async function main() {
  console.log('='.repeat(80));
  console.log('IMPACT SCORE CALCULATION AUDIT');
  console.log('='.repeat(80));

  const { data: states, error: statesError } = await supabase
    .from('voter_impact_states')
    .select('*')
    .order('state_code');

  if (statesError) {
    console.error('Error fetching states:', statesError);
    process.exit(1);
  }

  const { data: districts, error: districtsError } = await supabase
    .from('voter_impact_districts')
    .select('*')
    .order('cd_code');

  if (districtsError) {
    console.error('Error fetching districts:', districtsError);
    process.exit(1);
  }

  // === AUDIT 1: Check margin_votes data ===
  console.log('\n' + '─'.repeat(80));
  console.log('AUDIT 1: District margin_votes Data');
  console.log('─'.repeat(80));

  const districtsWithMargin = (districts as DistrictRecord[]).filter(d => d.margin_votes && d.margin_votes > 0);
  const districtsWithoutMargin = (districts as DistrictRecord[]).filter(d => !d.margin_votes || d.margin_votes <= 0);

  console.log(`Districts WITH margin_votes: ${districtsWithMargin.length}`);
  console.log(`Districts WITHOUT margin_votes: ${districtsWithoutMargin.length}`);

  if (districtsWithoutMargin.length > 0) {
    console.log('\nSample districts missing margin_votes:');
    districtsWithoutMargin.slice(0, 10).forEach(d => {
      console.log(`  ${d.cd_code}: margin_votes=${d.margin_votes}, muslim_voters=${d.muslim_voters}`);
    });
  }

  // === AUDIT 2: Check flippable districts ===
  console.log('\n' + '─'.repeat(80));
  console.log('AUDIT 2: Flippable Districts Analysis');
  console.log('─'.repeat(80));

  const flippableDistricts = districtsWithMargin.filter(d => {
    const mobilizable = d.didnt_vote_2024 || 0;
    return mobilizable >= d.margin_votes!;
  });

  console.log(`Total districts with margin data: ${districtsWithMargin.length}`);
  console.log(`Flippable districts (mobilizable >= margin): ${flippableDistricts.length}`);
  console.log(`Flippable ratio: ${(flippableDistricts.length / districtsWithMargin.length * 100).toFixed(1)}%`);

  if (flippableDistricts.length > 0) {
    console.log('\nFlippable districts:');
    flippableDistricts.slice(0, 15).forEach(d => {
      const mobilizable = d.didnt_vote_2024 || 0;
      const ratio = mobilizable / d.margin_votes!;
      console.log(`  ${d.cd_code}: mobilizable=${mobilizable.toLocaleString()}, margin=${d.margin_votes!.toLocaleString()}, ratio=${ratio.toFixed(2)}x`);
    });
  }

  // === AUDIT 3: District impact scores ===
  console.log('\n' + '─'.repeat(80));
  console.log('AUDIT 3: District Impact Scores Distribution');
  console.log('─'.repeat(80));

  const districtScores = districtsWithMargin.map(d => ({
    cd_code: d.cd_code,
    score: calculateImpactScore(d),
    mobilizable: d.didnt_vote_2024 || 0,
    margin: d.margin_votes!
  }));

  const high = districtScores.filter(d => d.score >= 0.5);
  const medium = districtScores.filter(d => d.score >= 0.25 && d.score < 0.5);
  const low = districtScores.filter(d => d.score >= 0.05 && d.score < 0.25);
  const none = districtScores.filter(d => d.score < 0.05);

  console.log(`🟢 HIGH (>=0.5):   ${high.length} districts`);
  console.log(`🟡 MEDIUM (>=0.25): ${medium.length} districts`);
  console.log(`🔴 LOW (>=0.05):   ${low.length} districts`);
  console.log(`⬛ NONE (<0.05):   ${none.length} districts`);

  if (high.length > 0) {
    console.log('\nTop HIGH impact districts:');
    high.sort((a, b) => b.score - a.score).slice(0, 10).forEach(d => {
      console.log(`  ${d.cd_code}: score=${(d.score * 100).toFixed(1)}%, mobilizable=${d.mobilizable.toLocaleString()}, margin=${d.margin.toLocaleString()}`);
    });
  }

  // === AUDIT 4: State impact scores ===
  console.log('\n' + '─'.repeat(80));
  console.log('AUDIT 4: State Impact Scores');
  console.log('─'.repeat(80));
  console.log('State | Voters   | Districts | Flippable | Score  | Color');
  console.log('-'.repeat(80));

  const stateScores: Array<{state: string, score: number, category: string}> = [];

  for (const state of (states as StateRecord[])) {
    const stateDistricts = (districts as DistrictRecord[]).filter(d => d.state_code === state.state_code);
    const districtsWithData = stateDistricts.filter(d => d.muslim_voters > 0 && d.margin_votes && d.margin_votes > 0);
    const flippable = districtsWithData.filter(d => (d.didnt_vote_2024 || 0) >= (d.margin_votes || Infinity));

    const score = calculateStateImpactScore(state, stateDistricts);
    const category = getColorCategory(score);

    stateScores.push({ state: state.state_code, score, category });

    console.log(
      `${state.state_code.padEnd(5)} | ` +
      `${state.muslim_voters.toLocaleString().padStart(8)} | ` +
      `${String(districtsWithData.length).padStart(9)} | ` +
      `${String(flippable.length).padStart(9)} | ` +
      `${(score * 100).toFixed(1).padStart(5)}% | ` +
      `${category}`
    );
  }

  // === Summary by color ===
  console.log('\n' + '─'.repeat(80));
  console.log('SUMMARY: State Distribution by Color');
  console.log('─'.repeat(80));

  const stateHigh = stateScores.filter(s => s.score >= 0.5);
  const stateMedium = stateScores.filter(s => s.score >= 0.25 && s.score < 0.5);
  const stateLow = stateScores.filter(s => s.score >= 0.05 && s.score < 0.25);
  const stateNone = stateScores.filter(s => s.score < 0.05);

  console.log(`🟢 HIGH (>=50%):   ${stateHigh.length} states ${stateHigh.length > 0 ? '- ' + stateHigh.map(s => s.state).join(', ') : ''}`);
  console.log(`🟡 MEDIUM (>=25%): ${stateMedium.length} states ${stateMedium.length > 0 ? '- ' + stateMedium.map(s => s.state).join(', ') : ''}`);
  console.log(`🔴 LOW (>=5%):     ${stateLow.length} states`);
  console.log(`⬛ NONE (<5%):     ${stateNone.length} states ${stateNone.length > 0 ? '- ' + stateNone.map(s => s.state).join(', ') : ''}`);

  // === AUDIT 5: Why no high/medium? ===
  console.log('\n' + '─'.repeat(80));
  console.log('AUDIT 5: Why No HIGH or MEDIUM States?');
  console.log('─'.repeat(80));

  // Pick a sample state with data to analyze
  const sampleState = (states as StateRecord[]).find(s => s.muslim_voters > 50000);
  if (sampleState) {
    const sampleDistricts = (districts as DistrictRecord[]).filter(d => d.state_code === sampleState.state_code);
    const sampleWithData = sampleDistricts.filter(d => d.muslim_voters > 0 && d.margin_votes && d.margin_votes > 0);

    console.log(`\nDeep dive: ${sampleState.state_name} (${sampleState.state_code})`);
    console.log(`  State muslim_voters: ${sampleState.muslim_voters.toLocaleString()}`);
    console.log(`  Districts with data: ${sampleWithData.length}`);

    if (sampleWithData.length > 0) {
      console.log('\n  District breakdown:');
      sampleWithData.forEach(d => {
        const mobilizable = d.didnt_vote_2024 || 0;
        const ratio = d.margin_votes ? mobilizable / d.margin_votes : 0;
        const districtScore = calculateImpactScore(d);
        const isFlippable = mobilizable >= (d.margin_votes || Infinity);

        console.log(`    ${d.cd_code}:`);
        console.log(`      muslim_voters: ${d.muslim_voters.toLocaleString()}`);
        console.log(`      didnt_vote_2024: ${mobilizable.toLocaleString()}`);
        console.log(`      margin_votes: ${d.margin_votes?.toLocaleString() || 'NULL'}`);
        console.log(`      ratio: ${ratio.toFixed(2)}x ${isFlippable ? '✓ FLIPPABLE' : '✗ not flippable'}`);
        console.log(`      district_score: ${(districtScore * 100).toFixed(1)}%`);
      });
    }
  }
}

main().catch(console.error);
