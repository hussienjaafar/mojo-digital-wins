import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Calculate Donor LTV (Lifetime Value)
 * 
 * Uses RFM (Recency, Frequency, Monetary) analysis to:
 * 1. Score each donor based on their giving behavior
 * 2. Predict future LTV at 30/90/180/365 day horizons
 * 3. Calculate churn risk based on recency patterns
 * 4. Segment donors into behavioral categories
 */

interface DonorStats {
  donor_key: string;
  donor_email: string;
  first_donation_date: string;
  last_donation_date: string;
  total_donations: number;
  total_amount: number;
  avg_amount: number;
  is_recurring: boolean;
  days_since_last: number;
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

// RFM Scoring Functions
function calculateRecencyScore(daysSinceLast: number): number {
  // Lower days = higher score (more recent = better)
  if (daysSinceLast <= 7) return 5;
  if (daysSinceLast <= 30) return 4;
  if (daysSinceLast <= 90) return 3;
  if (daysSinceLast <= 180) return 2;
  return 1;
}

function calculateFrequencyScore(donationCount: number): number {
  if (donationCount >= 10) return 5;
  if (donationCount >= 5) return 4;
  if (donationCount >= 3) return 3;
  if (donationCount >= 2) return 2;
  return 1;
}

function calculateMonetaryScore(avgAmount: number): number {
  if (avgAmount >= 250) return 5;
  if (avgAmount >= 100) return 4;
  if (avgAmount >= 50) return 3;
  if (avgAmount >= 25) return 2;
  return 1;
}

function calculateChurnRisk(recencyScore: number, frequencyScore: number, isRecurring: boolean): number {
  // Lower recency (longer time since last) = higher churn risk
  // Lower frequency = higher churn risk
  // Recurring donors have lower base churn risk
  
  const baseRisk = (6 - recencyScore) * 0.15 + (6 - frequencyScore) * 0.10;
  const recurringDiscount = isRecurring ? 0.2 : 0;
  
  return Math.min(1, Math.max(0, baseRisk - recurringDiscount));
}

function getChurnRiskLabel(churnRisk: number): string {
  if (churnRisk >= 0.7) return 'high';
  if (churnRisk >= 0.4) return 'medium';
  return 'low';
}

function getDonorSegment(rScore: number, fScore: number, mScore: number): string {
  const rfm = rScore * 100 + fScore * 10 + mScore;
  
  // Champions: High R, High F, High M
  if (rScore >= 4 && fScore >= 4 && mScore >= 4) return 'champion';
  
  // Loyal Customers: High F
  if (fScore >= 4) return 'loyal';
  
  // Potential Loyalists: High R, Medium F
  if (rScore >= 4 && fScore >= 2) return 'potential_loyalist';
  
  // Recent Donors: High R, Low F
  if (rScore >= 4 && fScore === 1) return 'new_donor';
  
  // At Risk: Low R, High F (used to be active)
  if (rScore <= 2 && fScore >= 3) return 'at_risk';
  
  // Hibernating: Low R, Low F
  if (rScore <= 2 && fScore <= 2) return 'hibernating';
  
  // Can't Lose: Low R, Very High F, High M
  if (rScore <= 2 && fScore >= 4 && mScore >= 4) return 'cant_lose';
  
  // About to Sleep: Medium R, Low F
  if (rScore === 3 && fScore <= 2) return 'about_to_sleep';
  
  // Need Attention
  if (rScore === 3 && fScore === 3) return 'need_attention';
  
  // Promising
  if (rScore >= 3 && fScore === 1 && mScore >= 3) return 'promising';
  
  return 'other';
}

function predictLTV(
  avgAmount: number, 
  frequency: number, 
  daysSinceLast: number, 
  tenureDays: number,
  isRecurring: boolean,
  horizon: number // days to predict
): number {
  // Simple predictive model based on historical patterns
  // In production, this would use ML models trained on historical data
  
  if (tenureDays === 0) tenureDays = 1;
  
  // Calculate donation rate (donations per day)
  const dailyRate = frequency / tenureDays;
  
  // Predict future donations in horizon
  let predictedDonations = dailyRate * horizon;
  
  // Apply recency decay - donors who haven't given recently are less likely
  const recencyFactor = Math.exp(-daysSinceLast / 180); // 180-day half-life
  predictedDonations *= recencyFactor;
  
  // Recurring donors get a boost
  if (isRecurring) {
    const monthsInHorizon = horizon / 30;
    predictedDonations = Math.max(predictedDonations, monthsInHorizon * 0.8);
  }
  
  // Apply floor and ceiling
  predictedDonations = Math.max(0, Math.min(predictedDonations, horizon / 7)); // Max 1 donation per week
  
  // Calculate predicted value
  const predictedLTV = predictedDonations * avgAmount;
  
  return Math.round(predictedLTV * 100) / 100;
}

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

    console.log(`[DONOR LTV] Starting calculation for org ${organization_id}`);

    const now = new Date();
    const predictions: LTVPrediction[] = [];

    // 1. Fetch donor aggregates from actblue_transactions
    console.log('[DONOR LTV] Aggregating donor statistics...');
    
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
      console.log('[DONOR LTV] No transactions found');
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

    console.log(`[DONOR LTV] Processing ${donorMap.size} unique donors`);

    // 3. Calculate RFM and LTV for each donor
    for (const [email, data] of donorMap.entries()) {
      const donations = data.donations.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      if (donations.length === 0) continue;

      // Create donor key (hash of email)
      let hash = 0;
      for (let i = 0; i < email.length; i++) {
        const char = email.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const donorKey = `donor_${Math.abs(hash).toString(36)}`;

      // Calculate metrics
      const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
      const avgAmount = totalAmount / donations.length;
      const firstDate = donations[0].date;
      const lastDate = donations[donations.length - 1].date;
      const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      const tenureDays = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      const isRecurring = donations.some(d => d.isRecurring);

      // RFM Scores
      const rScore = calculateRecencyScore(daysSinceLast);
      const fScore = calculateFrequencyScore(donations.length);
      const mScore = calculateMonetaryScore(avgAmount);
      const rfmScore = rScore * 100 + fScore * 10 + mScore;

      // Churn Risk
      const churnRisk = calculateChurnRisk(rScore, fScore, isRecurring);
      const churnRiskLabel = getChurnRiskLabel(churnRisk);

      // Segment
      const segment = getDonorSegment(rScore, fScore, mScore);

      // LTV Predictions
      const ltv30 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 30);
      const ltv90 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 90);
      const ltv180 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 180);
      const ltv365 = predictLTV(avgAmount, donations.length, daysSinceLast, tenureDays, isRecurring, 365);

      // Confidence score based on data quality
      const confidenceScore = Math.min(1, 
        0.3 + // Base confidence
        (donations.length > 5 ? 0.3 : donations.length * 0.06) + // More donations = higher confidence
        (tenureDays > 180 ? 0.2 : tenureDays / 900) + // Longer tenure = higher confidence
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
        model_version: 'rfm_v1.0',
        confidence_score: Math.round(confidenceScore * 100) / 100,
        calculated_at: now.toISOString(),
      });
    }

    // 4. Upsert predictions in batches
    console.log(`[DONOR LTV] Upserting ${predictions.length} predictions...`);
    let upsertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < predictions.length; i += batch_size) {
      const batch = predictions.slice(i, i + batch_size);
      
      const { error: upsertError } = await supabase
        .from('donor_ltv_predictions')
        .upsert(batch, { onConflict: 'organization_id,donor_key' });

      if (upsertError) {
        console.error(`[DONOR LTV] Batch upsert error:`, upsertError);
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

    const avgLTV90 = predictions.reduce((sum, p) => sum + p.predicted_ltv_90, 0) / predictions.length;

    // 6. Update processing checkpoint
    try {
      await supabase.rpc('update_processing_checkpoint', {
        p_function_name: 'calculate-donor-ltv',
        p_records_processed: upsertedCount,
        p_checkpoint_data: {
          organization_id,
          segments: segmentCounts,
          churn_risk_distribution: riskCounts,
          avg_ltv_90: Math.round(avgLTV90 * 100) / 100,
        },
      });
    } catch (checkpointError) {
      console.warn('[DONOR LTV] Failed to update checkpoint:', checkpointError);
    }

    const duration = Date.now() - startTime;
    console.log(`[DONOR LTV] Complete. Processed ${upsertedCount} donors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        donors_processed: upsertedCount,
        errors: errorCount,
        duration_ms: duration,
        summary: {
          segments: segmentCounts,
          churn_risk: riskCounts,
          avg_ltv_90: Math.round(avgLTV90 * 100) / 100,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DONOR LTV] Error:', error);
    
    // Log failure
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      
      await supabase.rpc('log_job_failure', {
        p_function_name: 'calculate-donor-ltv',
        p_error_message: error instanceof Error ? error.message : String(error),
        p_context: {},
      });
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
