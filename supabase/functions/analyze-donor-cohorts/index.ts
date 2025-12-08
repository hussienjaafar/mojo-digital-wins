import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SECURITY: Restrict CORS to known origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || 'https://lovable.dev',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // SECURITY: Extract user's JWT and create client with their context
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT for RLS enforcement
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { organizationId, cohortType = 'monthly' } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify user belongs to the organization
    const { data: userAccess } = await supabase
      .from('client_users')
      .select('organization_id')
      .eq('id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    // Also check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!userAccess && !isAdmin) {
      console.error('[SECURITY] User not authorized for organization:', organizationId);
      return new Response(
        JSON.stringify({ error: 'Access denied to this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[COHORTS] Analyzing donor cohorts for org: ${organizationId}`);

    // Get all transactions (RLS will filter by org for client_users)
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
      avgRetention: cohorts.length > 0 ? cohorts.reduce((sum, c) => sum + c.retentionRate, 0) / cohorts.length : 0,
      avgLTV: cohorts.length > 0 ? cohorts.reduce((sum, c) => sum + c.lifetimeValue, 0) / cohorts.length : 0,
    };

    if (cohorts.length >= 2) {
      const firstCohort = cohorts[0];
      const lastCohort = cohorts[cohorts.length - 1];
      trends.growthRate = firstCohort.donorCount > 0
        ? ((lastCohort.donorCount - firstCohort.donorCount) / firstCohort.donorCount) * 100
        : 0;
    }

    console.log(`[COHORTS] Analyzed ${cohorts.length} donor cohorts`);

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
    console.error('[COHORTS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
