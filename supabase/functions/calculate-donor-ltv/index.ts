import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Calculate Donor LTV (Lifetime Value) - Political Fundraising Model v2.0
 * 
 * Recalibrated for political giving patterns:
 * - Episodic giving (election cycles, not monthly subscriptions)
 * - Longer recency thresholds (365+ days is normal)
 * - Campaign-aware frequency scoring
 * - Tenure and recurring donor bonuses
 */

/**
 * Generate donor_key using MD5 hash (first 6 chars)
 * IMPORTANT: This must match the SQL formula: 'donor_' || substr(md5(lower(trim(email))), 1, 6)
 * This enables joins with donor_demographics and other tables
 */
async function generateDonorKey(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `donor_${hashHex.substring(0, 6)}`;
}

interface LTVPrediction {
  organization_id: string;
  donor_key: string;
  predicted_ltv_30: number;
  predicted_ltv_90: number;
  predicted_ltv_180: number;
  predicted_ltv_365: number;
  churn_risk: number;
  churn_risk_label: string;
  recency_days: number;
  frequency: number;
  monetary_avg: number;
  monetary_total: number;
  rfm_score: number;
  segment: string;
  model_version: string;
  confidence_score: number;
  calculated_at: string;
}

// =============================================================================
// POLITICAL FUNDRAISING RFM SCORING (v2.0)
// =============================================================================

/**
 * Recency Score - Political Fundraising Thresholds
 * 
 * Key insight: Political donors give episodically (election cycles),
 * not monthly like subscription services. A donor who gave 6 months ago
 * is still engaged; one who gave 2+ years ago is truly dormant.
 */
function calculateRecencyScore(daysSinceLast: number): number {
  if (daysSinceLast <= 30) return 5;    // Active campaign donor
  if (daysSinceLast <= 90) return 4;    // Recent quarter donor
  if (daysSinceLast <= 365) return 3;   // Within election cycle (normal!)
  if (daysSinceLast <= 730) return 2;   // Previous cycle donor
  return 1;                              // Dormant (2+ years)
}

/**
 * Frequency Score - Political Fundraising Thresholds
 * 
 * Most political donors give 1-3 times per cycle. High frequency
 * is 4+ donations, indicating a sustainer-level engagement.
 */
function calculateFrequencyScore(donationCount: number, daysSinceLast: number): number {
  if (donationCount >= 6) return 5;   // Super engaged (sustainer-level)
  if (donationCount >= 4) return 4;   // Highly engaged
  if (donationCount >= 2) return 3;   // Multiple-time donor (good!)
  // Single donation - differentiate recent vs old
  if (donationCount === 1 && daysSinceLast <= 365) return 2; // Recent first-timer
  return 1;                            // One-time dormant
}

/**
 * Monetary Score - Thresholds for political giving
 */
function calculateMonetaryScore(avgAmount: number): number {
  if (avgAmount >= 500) return 5;    // Major donor
  if (avgAmount >= 100) return 4;    // Strong donor
  if (avgAmount >= 50) return 3;     // Solid donor
  if (avgAmount >= 25) return 2;     // Entry-level donor
  return 1;                           // Micro donor
}

/**
 * Churn Risk - Political-Aware Formula
 * 
 * Key changes from e-commerce model:
 * - Reduced recency weight (0.10 vs 0.15) - gaps are normal
 * - Reduced frequency weight (0.08 vs 0.10)
 * - Significant recurring donor discount (0.25)
 * - Long-tenure donor bonus (0.10 for 2+ year relationship)
 * - Multi-time donor bonus (0.10)
 */
function calculateChurnRisk(
  recencyScore: number, 
  frequencyScore: number, 
  isRecurring: boolean,
  tenureDays: number
): number {
  // Base risk from RFM (weighted less aggressively for political)
  let risk = (6 - recencyScore) * 0.10 + (6 - frequencyScore) * 0.08;
  
  // Recurring donors are much more stable
  if (isRecurring) risk -= 0.25;
  
  // Long-tenure donors get benefit of the doubt
  if (tenureDays > 730) risk -= 0.10; // 2+ year relationship
  
  // Multi-time donors are inherently more loyal
  if (frequencyScore >= 3) risk -= 0.10;
  
  return Math.min(1, Math.max(0, risk));
}

/**
 * Churn Risk Labels - Adjusted thresholds
 */
function getChurnRiskLabel(churnRisk: number): string {
  if (churnRisk >= 0.6) return 'high';
  if (churnRisk >= 0.3) return 'medium';
  return 'low';
}

/**
 * Donor Segments - Political-Specific Categories
 */
function getDonorSegment(
  rScore: number, 
  fScore: number, 
  mScore: number, 
  isRecurring: boolean
): string {
  // Champions: High across all dimensions
  if (rScore >= 4 && fScore >= 4 && mScore >= 4) return 'champion';
  
  // Sustainers: Recurring donors with recent activity (political-specific)
  if (isRecurring && rScore >= 3) return 'sustainer';
  
  // Major Donors: High monetary regardless of frequency
  if (mScore === 5 && rScore >= 3) return 'major_donor';
  
  // Loyal: High frequency
  if (fScore >= 4) return 'loyal';
  
  // Potential Loyalists: Recent + some frequency
  if (rScore >= 4 && fScore >= 2) return 'potential_loyalist';
  
  // New Donors: Recent first-time
  if (rScore >= 4 && fScore <= 2) return 'new_donor';
  
  // Cycle Donors: Not recent but gave multiple times (normal for political!)
  if (rScore === 3 && fScore >= 2) return 'cycle_donor';
  
  // At Risk: Used to be active, now fading
  if (rScore <= 2 && fScore >= 3) return 'at_risk';
  
  // Lapsed: Previous cycle donor, low frequency
  if (rScore === 2 && fScore <= 2) return 'lapsed';
  
  // Dormant: Very long time since donation
  if (rScore === 1) return 'dormant';
  
  // Can't Lose: Low recency but very high value
  if (rScore <= 2 && fScore >= 4 && mScore >= 4) return 'cant_lose';
  
  return 'other';
}

/**
 * Predict LTV - Political-Aware Model
 * 
 * Key changes:
 * - 365-day half-life (not 180) for recency decay
 * - Higher monthly prediction for recurring donors
 * - Multi-time donor loyalty boost
 */
function predictLTV(
  avgAmount: number, 
  frequency: number, 
  daysSinceLast: number, 
  tenureDays: number,
  isRecurring: boolean,
  horizon: number
): number {
  if (tenureDays === 0) tenureDays = 1;
  
  // Calculate donation rate (donations per day)
  const dailyRate = frequency / tenureDays;
  
  // Predict future donations in horizon
  let predictedDonations = dailyRate * horizon;
  
  // Use 365-day half-life for political giving (episodic)
  const recencyFactor = Math.exp(-daysSinceLast / 365);
  predictedDonations *= recencyFactor;
  
  // Recurring donors: predictable monthly giving
  if (isRecurring) {
    const monthsInHorizon = horizon / 30;
    predictedDonations = Math.max(predictedDonations, monthsInHorizon * 0.9);
  }
  
  // Multi-time donors get a loyalty boost
  if (frequency >= 3) {
    predictedDonations *= 1.2;
  }
  
  // Apply floor and ceiling
  predictedDonations = Math.max(0, Math.min(predictedDonations, horizon / 7));
  
  return Math.round(predictedDonations * avgAmount * 100) / 100;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id, batch_size = 500 } = body;

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    console.log(`[DONOR LTV v2.0] Starting calculation for org ${organization_id}`);

    const now = new Date();
    const predictions: LTVPrediction[] = [];

    // 1. Fetch donor aggregates from actblue_transactions
    console.log('[DONOR LTV v2.0] Aggregating donor statistics...');
    
    const { data: donorStats, error: statsError } = await supabase
      .from('actblue_transactions')
      .select('donor_email, amount, net_amount, transaction_date, is_recurring, transaction_type')
      .eq('organization_id', organization_id)
      .neq('transaction_type', 'refund')
      .not('donor_email', 'is', null)
      .order('transaction_date', { ascending: true });

    if (statsError) {
      throw new Error(`Failed to fetch donor stats: ${statsError.message}`);
    }

    if (!donorStats || donorStats.length === 0) {
      console.log('[DONOR LTV v2.0] No transactions found');
      return new Response(
        JSON.stringify({ success: true, donors_processed: 0, message: 'No transactions to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Aggregate by donor
    const donorMap = new Map<string, {
      email: string;
      donations: Array<{ amount: number; date: Date; isRecurring: boolean }>;
    }>();

    for (const tx of donorStats) {
      if (!tx.donor_email) continue;
      
      const email = tx.donor_email.toLowerCase().trim();
      if (!donorMap.has(email)) {
        donorMap.set(email, { email, donations: [] });
      }
      
      donorMap.get(email)!.donations.push({
        amount: tx.net_amount || tx.amount || 0,
        date: new Date(tx.transaction_date),
        isRecurring: tx.is_recurring || false,
      });
    }

    console.log(`[DONOR LTV v2.0] Processing ${donorMap.size} unique donors`);

    // 3. Calculate RFM and LTV for each donor
    for (const [email, data] of donorMap.entries()) {
      const donations = data.donations.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      if (donations.length === 0) continue;

      // Create donor key using MD5 hash (matches SQL: 'donor_' || substr(md5(lower(trim(email))), 1, 6))
      const donorKey = await generateDonorKey(email);

      // Calculate metrics
      const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
      const avgAmount = totalAmount / donations.length;
      const firstDate = donations[0].date;
      const lastDate = donations[donations.length - 1].date;
      const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const tenureDays = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      const isRecurring = donations.some(d => d.isRecurring);

      // RFM Scores (Political v2.0)
      const rScore = calculateRecencyScore(daysSinceLast);
      const fScore = calculateFrequencyScore(donations.length, daysSinceLast);
      const mScore = calculateMonetaryScore(avgAmount);
      const rfmScore = rScore * 100 + fScore * 10 + mScore;

      // Churn Risk (Political v2.0)
      const churnRisk = calculateChurnRisk(rScore, fScore, isRecurring, tenureDays);
      const churnRiskLabel = getChurnRiskLabel(churnRisk);

      // Segment (Political v2.0)
      const segment = getDonorSegment(rScore, fScore, mScore, isRecurring);

      // LTV Predictions (Political v2.0)
      const ltv30 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 30);
      const ltv90 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 90);
      const ltv180 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 180);
      const ltv365 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 365);

      // Confidence score based on data quality
      const confidenceScore = Math.min(1, 
        0.3 + // Base confidence
        (donations.length > 5 ? 0.3 : donations.length * 0.06) + // More donations = higher confidence
        (tenureDays > 365 ? 0.2 : tenureDays / 1825) + // Longer tenure = higher confidence (now 1 year threshold)
        (isRecurring ? 0.2 : 0) // Recurring = higher confidence
      );

      predictions.push({
        organization_id,
        donor_key: donorKey,
        predicted_ltv_30: ltv30,
        predicted_ltv_90: ltv90,
        predicted_ltv_180: ltv180,
        predicted_ltv_365: ltv365,
        churn_risk: Math.round(churnRisk * 100) / 100,
        churn_risk_label: churnRiskLabel,
        recency_days: daysSinceLast,
        frequency: donations.length,
        monetary_avg: Math.round(avgAmount * 100) / 100,
        monetary_total: Math.round(totalAmount * 100) / 100,
        rfm_score: rfmScore,
        segment,
        model_version: 'political_rfm_v2.0',
        confidence_score: Math.round(confidenceScore * 100) / 100,
        calculated_at: now.toISOString(),
      });
    }

    // 4. Upsert predictions in batches
    console.log(`[DONOR LTV v2.0] Upserting ${predictions.length} predictions...`);
    let upsertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < predictions.length; i += batch_size) {
      const batch = predictions.slice(i, i + batch_size);
      
      const { error: upsertError } = await supabase
        .from('donor_ltv_predictions')
        .upsert(batch, { onConflict: 'organization_id,donor_key' });

      if (upsertError) {
        console.error(`[DONOR LTV v2.0] Batch upsert error:`, upsertError);
        errorCount += batch.length;
      } else {
        upsertedCount += batch.length;
      }
    }

    // 5. Calculate summary stats for logging
    const segmentCounts = predictions.reduce((acc, p) => {
      acc[p.segment] = (acc[p.segment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const riskCounts = predictions.reduce((acc, p) => {
      acc[p.churn_risk_label] = (acc[p.churn_risk_label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgLTV90 = predictions.length > 0 
      ? predictions.reduce((sum, p) => sum + p.predicted_ltv_90, 0) / predictions.length
      : 0;

    // 6. Update processing checkpoint
    try {
      await supabase.rpc('update_processing_checkpoint', {
        p_function_name: 'calculate-donor-ltv',
        p_records_processed: upsertedCount,
        p_checkpoint_data: {
          organization_id,
          model_version: 'political_rfm_v2.0',
          segments: segmentCounts,
          churn_risk_distribution: riskCounts,
          avg_ltv_90: Math.round(avgLTV90 * 100) / 100,
        },
      });
    } catch (checkpointError) {
      console.warn('[DONOR LTV v2.0] Failed to update checkpoint:', checkpointError);
    }

    const duration = Date.now() - startTime;
    console.log(`[DONOR LTV v2.0] Complete. Processed ${upsertedCount} donors in ${duration}ms`);
    console.log(`[DONOR LTV v2.0] Churn distribution: ${JSON.stringify(riskCounts)}`);
    console.log(`[DONOR LTV v2.0] Segment distribution: ${JSON.stringify(segmentCounts)}`);

    return new Response(
      JSON.stringify({
        success: true,
        donors_processed: upsertedCount,
        errors: errorCount,
        duration_ms: duration,
        model_version: 'political_rfm_v2.0',
        summary: {
          segments: segmentCounts,
          churn_risk: riskCounts,
          avg_ltv_90: Math.round(avgLTV90 * 100) / 100,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DONOR LTV v2.0] Error:', error);
    
    // Log failure
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      
      await supabase.rpc('log_job_failure', {
        p_function_name: 'calculate-donor-ltv',
        p_error_message: error instanceof Error ? error.message : String(error),
        p_context: { model_version: 'political_rfm_v2.0' },
      });
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
