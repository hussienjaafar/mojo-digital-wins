import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Decay Stale Affinities
 *
 * Critical Anti-Filter-Bubble Function
 *
 * Decays affinities that haven't been reinforced recently.
 * This prevents old successes from dominating forever.
 *
 * Parameters:
 * - DECAY_RATE: 0.95 (lose 5% per week)
 * - MIN_SCORE: 0.3 (never decay below this)
 * - STALE_THRESHOLD_DAYS: 30 (consider stale after 30 days)
 *
 * Run weekly via scheduled job
 */

const DECAY_RATE = 0.95;           // Lose 5% per week
const MIN_SCORE = 0.3;             // Never decay below this
const STALE_THRESHOLD_DAYS = 30;   // Consider stale after 30 days

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!validateCronSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run || false;
    const customDecayRate = body.decay_rate || DECAY_RATE;
    const customMinScore = body.min_score || MIN_SCORE;
    const customStaleThreshold = body.stale_threshold_days || STALE_THRESHOLD_DAYS;

    console.log('🔄 Starting affinity decay process...');
    console.log(`   Decay rate: ${customDecayRate}`);
    console.log(`   Min score: ${customMinScore}`);
    console.log(`   Stale threshold: ${customStaleThreshold} days`);
    console.log(`   Dry run: ${dryRun}`);

    const staleDate = new Date(Date.now() - customStaleThreshold * 24 * 60 * 60 * 1000);

    // Find all affinities that haven't been used recently
    const { data: staleAffinities, error: fetchError } = await supabase
      .from('org_topic_affinities')
      .select('*')
      .lt('last_used_at', staleDate.toISOString())
      .gt('affinity_score', customMinScore)
      .eq('source', 'learned_outcome');  // Only decay learned, not self-declared

    if (fetchError) throw fetchError;

    console.log(`📊 Found ${staleAffinities?.length || 0} stale affinities to decay`);

    let decayedCount = 0;
    const decayedDetails: Array<{
      organization_id: string;
      topic: string;
      old_score: number;
      new_score: number;
    }> = [];

    for (const affinity of staleAffinities || []) {
      const newScore = Math.max(customMinScore, affinity.affinity_score * customDecayRate);

      decayedDetails.push({
        organization_id: affinity.organization_id,
        topic: affinity.topic,
        old_score: affinity.affinity_score,
        new_score: newScore,
      });

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from('org_topic_affinities')
          .update({
            affinity_score: newScore,
            updated_at: new Date().toISOString(),
          })
          .eq('id', affinity.id);

        if (!updateError) {
          decayedCount++;
        }
      } else {
        decayedCount++;
      }
    }

    // Log decay run
    if (!dryRun) {
      try {
        await supabase.from('job_executions').insert({
          job_name: 'decay_stale_affinities',
          status: 'success',
          records_processed: decayedCount,
          metadata: {
            decay_rate: customDecayRate,
            min_score: customMinScore,
            stale_threshold_days: customStaleThreshold,
            total_checked: staleAffinities?.length || 0,
          },
          created_at: new Date().toISOString(),
        });
      } catch { /* Don't fail if logging fails */ }
    }

    console.log(`✅ ${dryRun ? '[DRY RUN] Would decay' : 'Decayed'} ${decayedCount} affinities`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        total_stale: staleAffinities?.length || 0,
        decayed_count: decayedCount,
        decay_rate: customDecayRate,
        min_score: customMinScore,
        stale_threshold_days: customStaleThreshold,
        details: decayedDetails.slice(0, 50), // Limit details to 50 for response size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error decaying affinities:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
