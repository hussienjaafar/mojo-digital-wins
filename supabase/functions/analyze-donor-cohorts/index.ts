import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CohortMetrics {
  cohort: string;
  donorCount: number;
  totalRevenue: number;
  avgDonationSize: number;
  retentionRate: number;
  lifetimeValue: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { organizationId, cohortType = 'monthly' } = await req.json();

    console.log(`📈 Analyzing donor cohorts for org: ${organizationId}`);

    // Get all transactions
    const { data: transactions, error } = await supabase
      .from('actblue_transactions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    // Group donors by first donation date
    const donorFirstDonation = new Map<string, Date>();
    const cohortData = new Map<string, {
      donors: Set<string>;
      revenue: number;
      donations: number;
      returningDonors: Set<string>;
    }>();

    transactions?.forEach(txn => {
      if (!txn.donor_email) return;

      const txnDate = new Date(txn.transaction_date);
      
      // Track first donation
      if (!donorFirstDonation.has(txn.donor_email)) {
        donorFirstDonation.set(txn.donor_email, txnDate);
      }

      // Determine cohort
      const firstDonation = donorFirstDonation.get(txn.donor_email)!;
      let cohortKey: string;
      
      if (cohortType === 'monthly') {
        cohortKey = `${firstDonation.getFullYear()}-${String(firstDonation.getMonth() + 1).padStart(2, '0')}`;
      } else {
        cohortKey = `${firstDonation.getFullYear()}-Q${Math.floor(firstDonation.getMonth() / 3) + 1}`;
      }

      if (!cohortData.has(cohortKey)) {
        cohortData.set(cohortKey, {
          donors: new Set(),
          revenue: 0,
          donations: 0,
          returningDonors: new Set(),
        });
      }

      const cohort = cohortData.get(cohortKey)!;
      cohort.donors.add(txn.donor_email);
      cohort.revenue += Number(txn.amount);
      cohort.donations += 1;

      // Check if returning donor
      if (txnDate > firstDonation) {
        cohort.returningDonors.add(txn.donor_email);
      }
    });

    // Calculate cohort metrics
    const cohorts: CohortMetrics[] = [];
    
    cohortData.forEach((data, cohortKey) => {
      const donorCount = data.donors.size;
      const retentionRate = donorCount > 0 
        ? (data.returningDonors.size / donorCount) * 100 
        : 0;
      
      cohorts.push({
        cohort: cohortKey,
        donorCount,
        totalRevenue: data.revenue,
        avgDonationSize: donorCount > 0 ? data.revenue / data.donations : 0,
        retentionRate,
        lifetimeValue: donorCount > 0 ? data.revenue / donorCount : 0,
      });
    });

    // Sort by cohort date
    cohorts.sort((a, b) => a.cohort.localeCompare(b.cohort));

    // Calculate trends
    const trends = {
      growthRate: 0,
      avgRetention: cohorts.reduce((sum, c) => sum + c.retentionRate, 0) / cohorts.length,
      avgLTV: cohorts.reduce((sum, c) => sum + c.lifetimeValue, 0) / cohorts.length,
    };

    if (cohorts.length >= 2) {
      const firstCohort = cohorts[0];
      const lastCohort = cohorts[cohorts.length - 1];
      trends.growthRate = firstCohort.donorCount > 0
        ? ((lastCohort.donorCount - firstCohort.donorCount) / firstCohort.donorCount) * 100
        : 0;
    }

    console.log(`✅ Analyzed ${cohorts.length} donor cohorts`);

    return new Response(
      JSON.stringify({
        success: true,
        cohorts,
        trends,
        totalDonors: donorFirstDonation.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing cohorts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
