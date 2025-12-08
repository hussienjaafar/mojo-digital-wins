import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

// CORS with allowed origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const getCorsHeaders = (origin?: string) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || 'https://lovable.dev';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check: require either CRON_SECRET header or valid admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');

    let isAuthorized = false;

    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
      console.log('[cleanup-old-cache] Authorized via CRON_SECRET');
    } else if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        const { data: isAdmin } = await supabaseAuth.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (isAdmin) {
          isAuthorized = true;
          console.log('[cleanup-old-cache] Authorized via admin JWT');
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET or admin JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cache cleanup...');

    // Delete cache entries older than 7 days with low hit counts
    const { data: deleted, error: deleteError } = await supabase
      .from('ai_analysis_cache')
      .delete()
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .lt('hit_count', 3)
      .select('id');

    if (deleteError) throw deleteError;

    const deletedCount = deleted?.length || 0;
    console.log(`Deleted ${deletedCount} old cache entries`);

    // Get cache statistics
    const { data: stats, error: statsError } = await supabase
      .from('ai_analysis_cache')
      .select('hit_count, created_at');

    if (statsError) throw statsError;

    const totalEntries = stats?.length || 0;
    const avgHitCount = stats?.reduce((sum, s) => sum + (s.hit_count || 0), 0) / totalEntries || 0;
    const entriesLast24h = stats?.filter(s => 
      new Date(s.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length || 0;

    console.log(`Cache stats: ${totalEntries} total, avg ${avgHitCount.toFixed(1)} hits, ${entriesLast24h} in last 24h`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount,
        totalEntries,
        avgHitCount: avgHitCount.toFixed(2),
        entriesLast24h
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in cleanup-old-cache:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
