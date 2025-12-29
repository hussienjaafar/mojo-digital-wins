import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Test Attribution
 * 
 * Validates attribution accuracy by:
 * 1. Checking refcode mappings exist for top refcodes
 * 2. Verifying attribution method distribution
 * 3. Testing specific refcode->campaign mappings
 * 4. Identifying unmapped refcodes that should be mapped
 */

interface TestResult {
  test_name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6' } = body;

    const results: TestResult[] = [];

    // Test 1: Check refcode_mappings table has data
    const { data: mappingsCount, error: mappingsError } = await supabase
      .from('refcode_mappings')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    if (mappingsError) {
      results.push({
        test_name: 'refcode_mappings_exists',
        status: 'fail',
        message: `Error querying refcode_mappings: ${mappingsError.message}`
      });
    } else {
      const count = mappingsCount?.length || 0;
      results.push({
        test_name: 'refcode_mappings_exists',
        status: count > 0 ? 'pass' : 'fail',
        message: `Found ${count} refcode mappings`,
        details: { count }
      });
    }

    // Test 2: Get top refcodes from transactions
    const { data: topRefcodes } = await supabase
      .from('actblue_transactions')
      .select('refcode')
      .eq('organization_id', organization_id)
      .not('refcode', 'is', null)
      .gte('transaction_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Count refcodes
    const refcodeCounts: Record<string, number> = {};
    for (const tx of topRefcodes || []) {
      if (tx.refcode) {
        refcodeCounts[tx.refcode] = (refcodeCounts[tx.refcode] || 0) + 1;
      }
    }
    
    const sortedRefcodes = Object.entries(refcodeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    results.push({
      test_name: 'top_refcodes',
      status: 'pass',
      message: `Found ${sortedRefcodes.length} unique refcodes in last 30 days`,
      details: { top_10: sortedRefcodes.slice(0, 10) }
    });

    // Test 3: Check which top refcodes have mappings
    const { data: allMappings } = await supabase
      .from('refcode_mappings')
      .select('refcode, campaign_id, campaign_name, platform')
      .eq('organization_id', organization_id);

    const mappedRefcodes = new Set(allMappings?.map(m => m.refcode) || []);
    const unmappedTopRefcodes = sortedRefcodes.filter(([refcode]) => !mappedRefcodes.has(refcode));
    const mappedTopRefcodes = sortedRefcodes.filter(([refcode]) => mappedRefcodes.has(refcode));

    results.push({
      test_name: 'refcode_coverage',
      status: unmappedTopRefcodes.length === 0 ? 'pass' : unmappedTopRefcodes.length <= 5 ? 'warn' : 'fail',
      message: `${mappedTopRefcodes.length}/${sortedRefcodes.length} top refcodes have mappings`,
      details: { 
        mapped: mappedTopRefcodes.map(([r, c]) => `${r} (${c} txs)`),
        unmapped: unmappedTopRefcodes.map(([r, c]) => `${r} (${c} txs)`)
      }
    });

    // Test 4: Check attribution distribution
    const { data: attributions } = await supabase
      .from('transaction_attribution')
      .select('attribution_method')
      .eq('organization_id', organization_id);

    const methodCounts: Record<string, number> = {};
    for (const attr of attributions || []) {
      methodCounts[attr.attribution_method] = (methodCounts[attr.attribution_method] || 0) + 1;
    }

    const total = attributions?.length || 0;
    const organicPct = total > 0 ? ((methodCounts['organic'] || 0) / total * 100).toFixed(1) : '0';

    results.push({
      test_name: 'attribution_distribution',
      status: parseFloat(organicPct) < 50 ? 'pass' : parseFloat(organicPct) < 75 ? 'warn' : 'fail',
      message: `Attribution method distribution - ${organicPct}% organic`,
      details: { 
        total_attributions: total,
        by_method: methodCounts 
      }
    });

    // Test 5: Verify specific known mappings
    const testMappings = [
      { refcode: 'jp421', expected_campaign: '120237582650380651' },
      { refcode: 'jpmn', expected_campaign: '120235300335720651' },
      { refcode: 'thpgtr', expected_campaign: '120237582650380651' },
    ];

    for (const test of testMappings) {
      const { data: mapping } = await supabase
        .from('refcode_mappings')
        .select('campaign_id, campaign_name')
        .eq('organization_id', organization_id)
        .eq('refcode', test.refcode)
        .maybeSingle();

      if (!mapping) {
        results.push({
          test_name: `mapping_${test.refcode}`,
          status: 'fail',
          message: `No mapping found for refcode: ${test.refcode}`
        });
      } else if (mapping.campaign_id === test.expected_campaign) {
        results.push({
          test_name: `mapping_${test.refcode}`,
          status: 'pass',
          message: `Refcode ${test.refcode} correctly maps to campaign ${mapping.campaign_name || mapping.campaign_id}`
        });
      } else {
        results.push({
          test_name: `mapping_${test.refcode}`,
          status: 'warn',
          message: `Refcode ${test.refcode} maps to ${mapping.campaign_id}, expected ${test.expected_campaign}`,
          details: { actual: mapping.campaign_id, expected: test.expected_campaign }
        });
      }
    }

    // Test 6: Check for transactions that should have attribution but don't
    const { data: txWithRefcodeNoAttr } = await supabase
      .rpc('get_transactions_missing_attribution', { org_id: organization_id })
      .limit(10);

    // If RPC doesn't exist, do manual query
    if (!txWithRefcodeNoAttr) {
      const { data: recentTxs } = await supabase
        .from('actblue_transactions')
        .select('transaction_id, refcode, transaction_date')
        .eq('organization_id', organization_id)
        .not('refcode', 'is', null)
        .gte('transaction_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(50);

      const { data: recentAttrs } = await supabase
        .from('transaction_attribution')
        .select('transaction_id')
        .eq('organization_id', organization_id);

      const attrSet = new Set(recentAttrs?.map(a => a.transaction_id) || []);
      const missing = recentTxs?.filter(tx => !attrSet.has(tx.transaction_id)) || [];

      results.push({
        test_name: 'attribution_completeness',
        status: missing.length === 0 ? 'pass' : missing.length < 10 ? 'warn' : 'fail',
        message: `${missing.length} recent transactions with refcodes missing attribution`,
        details: { missing_count: missing.length, sample: missing.slice(0, 5) }
      });
    }

    // Summary
    const passCount = results.filter(r => r.status === 'pass').length;
    const warnCount = results.filter(r => r.status === 'warn').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    return new Response(
      JSON.stringify({ 
        success: failCount === 0,
        summary: {
          total_tests: results.length,
          passed: passCount,
          warnings: warnCount,
          failed: failCount,
          health_score: Math.round((passCount / results.length) * 100)
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TEST-ATTRIBUTION] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
