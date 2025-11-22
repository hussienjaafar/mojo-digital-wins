import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});