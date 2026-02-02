#!/usr/bin/env npx tsx
/**
 * Audit Voter Impact Data Consistency
 *
 * Checks for:
 * 1. States with 0 muslim_voters but districts have voters
 * 2. Mismatch between state totals and district sums
 * 3. Missing states or districts
 * 4. Data quality issues
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx tsx scripts/audit-voter-impact-data.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface StateRecord {
  state_code: string;
  state_name: string;
  muslim_voters: number;
  registered: number;
  vote_2024: number;
  vote_2024_pct: number;
}

interface DistrictRecord {
  cd_code: string;
  state_code: string;
  muslim_voters: number;
  muslim_registered: number;
  voted_2024: number;
  didnt_vote_2024: number;
  margin_votes: number | null;
  can_impact: boolean;
}

async function main() {
  console.log('='.repeat(70));
  console.log('VOTER IMPACT DATA AUDIT');
  console.log('='.repeat(70));
  console.log(`Supabase: ${SUPABASE_URL}\n`);

  // Fetch all data
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

  console.log(`Loaded: ${states?.length || 0} states, ${districts?.length || 0} districts\n`);

  const issues: string[] = [];

  // === AUDIT 1: States with zero voters but districts have voters ===
  console.log('─'.repeat(70));
  console.log('AUDIT 1: States with zero voters but districts have data');
  console.log('─'.repeat(70));

  for (const state of (states as StateRecord[]) || []) {
    const stateDistricts = (districts as DistrictRecord[])?.filter(d => d.state_code === state.state_code) || [];
    const districtSum = stateDistricts.reduce((sum, d) => sum + (d.muslim_voters || 0), 0);

    if (state.muslim_voters === 0 && districtSum > 0) {
      const msg = `⚠️  ${state.state_code} (${state.state_name}): State has 0 voters but districts have ${districtSum.toLocaleString()}`;
      console.log(msg);
      issues.push(msg);
    }
  }

  if (!issues.length) {
    console.log('✓ No issues found');
  }

  // === AUDIT 2: Large mismatches between state and district totals ===
  console.log('\n' + '─'.repeat(70));
  console.log('AUDIT 2: State vs District total mismatches (>10% difference)');
  console.log('─'.repeat(70));

  let mismatchCount = 0;
  for (const state of (states as StateRecord[]) || []) {
    const stateDistricts = (districts as DistrictRecord[])?.filter(d => d.state_code === state.state_code) || [];
    const districtSum = stateDistricts.reduce((sum, d) => sum + (d.muslim_voters || 0), 0);

    if (state.muslim_voters > 0 && districtSum > 0) {
      const diff = Math.abs(state.muslim_voters - districtSum);
      const pctDiff = diff / Math.max(state.muslim_voters, districtSum);

      if (pctDiff > 0.1) {
        console.log(`⚠️  ${state.state_code}: State=${state.muslim_voters.toLocaleString()}, Districts=${districtSum.toLocaleString()} (${(pctDiff * 100).toFixed(1)}% diff)`);
        mismatchCount++;
      }
    }
  }

  if (mismatchCount === 0) {
    console.log('✓ No large mismatches found');
  }

  // === AUDIT 3: States with no district data ===
  console.log('\n' + '─'.repeat(70));
  console.log('AUDIT 3: States with no district data (at-large or missing)');
  console.log('─'.repeat(70));

  for (const state of (states as StateRecord[]) || []) {
    const stateDistricts = (districts as DistrictRecord[])?.filter(d => d.state_code === state.state_code) || [];

    if (stateDistricts.length === 0) {
      console.log(`ℹ️  ${state.state_code} (${state.state_name}): No district records (voters: ${state.muslim_voters.toLocaleString()})`);
    }
  }

  // === AUDIT 4: Full state-by-state summary ===
  console.log('\n' + '─'.repeat(70));
  console.log('AUDIT 4: Complete State-by-State Summary');
  console.log('─'.repeat(70));
  console.log('State | State Voters | Districts | District Sum | Match?');
  console.log('-'.repeat(70));

  for (const state of (states as StateRecord[]) || []) {
    const stateDistricts = (districts as DistrictRecord[])?.filter(d => d.state_code === state.state_code) || [];
    const districtSum = stateDistricts.reduce((sum, d) => sum + (d.muslim_voters || 0), 0);
    const match = state.muslim_voters === 0 && districtSum === 0 ? '—' :
                  Math.abs(state.muslim_voters - districtSum) < 100 ? '✓' : '✗';

    console.log(
      `${state.state_code.padEnd(5)} | ` +
      `${state.muslim_voters.toLocaleString().padStart(12)} | ` +
      `${String(stateDistricts.length).padStart(9)} | ` +
      `${districtSum.toLocaleString().padStart(12)} | ${match}`
    );
  }

  // === AUDIT 5: Colorado Deep Dive ===
  console.log('\n' + '─'.repeat(70));
  console.log('AUDIT 5: Colorado Deep Dive');
  console.log('─'.repeat(70));

  const colorado = (states as StateRecord[])?.find(s => s.state_code === 'CO');
  const coDistricts = (districts as DistrictRecord[])?.filter(d => d.state_code === 'CO') || [];

  if (colorado) {
    console.log('State Record:');
    console.log(`  muslim_voters: ${colorado.muslim_voters}`);
    console.log(`  registered: ${colorado.registered}`);
    console.log(`  vote_2024: ${colorado.vote_2024}`);
    console.log(`  vote_2024_pct: ${colorado.vote_2024_pct}`);
  } else {
    console.log('⚠️  NO STATE RECORD FOUND FOR COLORADO');
  }

  console.log(`\nDistrict Records (${coDistricts.length}):`);
  for (const d of coDistricts) {
    console.log(`  ${d.cd_code}: voters=${d.muslim_voters}, registered=${d.muslim_registered}, voted=${d.voted_2024}, didnt_vote=${d.didnt_vote_2024}`);
  }

  // === Summary ===
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total states: ${states?.length || 0}`);
  console.log(`Total districts: ${districts?.length || 0}`);
  console.log(`Critical issues found: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\nCritical Issues:');
    issues.forEach(i => console.log(`  ${i}`));
  }
}

main().catch(console.error);
