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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Analyzing optimal send times...');

    // Get all organizations
    const { data: orgs } = await supabase
      .from('client_organizations')
      .select('id')
      .eq('is_active', true);

    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ message: 'No active organizations' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    for (const org of orgs) {
      // Analyze donation patterns by hour of day and day of week
      const { data: donations } = await supabase
        .from('actblue_transactions')
        .select('transaction_date, amount')
        .eq('organization_id', org.id)
        .gte('transaction_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('transaction_date', { ascending: true });

      if (!donations || donations.length < 50) {
        console.log(`Not enough data for org ${org.id}`);
        continue;
      }

      // Group by hour of day (0-23)
      const hourlyStats = new Array(24).fill(0).map(() => ({
        count: 0,
        total: 0,
        avg: 0,
      }));

      // Group by day of week (0-6, Sunday-Saturday)
      const dailyStats = new Array(7).fill(0).map(() => ({
        count: 0,
        total: 0,
        avg: 0,
      }));

      donations.forEach(d => {
        const date = new Date(d.transaction_date);
        const hour = date.getHours();
        const day = date.getDay();

        hourlyStats[hour].count++;
        hourlyStats[hour].total += d.amount;

        dailyStats[day].count++;
        dailyStats[day].total += d.amount;
      });

      // Calculate averages
      hourlyStats.forEach(stat => {
        stat.avg = stat.count > 0 ? stat.total / stat.count : 0;
      });

      dailyStats.forEach(stat => {
        stat.avg = stat.count > 0 ? stat.total / stat.count : 0;
      });

      // Find best hours (top 3)
      const bestHours = hourlyStats
        .map((stat, hour) => ({ hour, ...stat }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
        .map(h => h.hour);

      // Find best days (top 3)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const bestDays = dailyStats
        .map((stat, day) => ({ day, dayName: dayNames[day], ...stat }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
        .map(d => d.dayName);

      // Calculate optimal windows (2-hour blocks)
      const twoHourWindows: Array<{
        start: number;
        end: number;
        count: number;
        total: number;
        avg: number;
      }> = [];
      for (let i = 0; i < 24; i += 2) {
        const window = {
          start: i,
          end: (i + 2) % 24,
          count: hourlyStats[i].count + hourlyStats[(i + 1) % 24].count,
          total: hourlyStats[i].total + hourlyStats[(i + 1) % 24].total,
          avg: 0,
        };
        window.avg = window.count > 0 ? window.total / window.count : 0;
        twoHourWindows.push(window);
      }

      const optimalWindows = twoHourWindows
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 3)
        .map(w => ({
          start_hour: w.start,
          end_hour: w.end,
          avg_donation: w.avg,
          sample_size: w.count,
        }));

      // Store optimization results
      const { error: upsertError } = await supabase
        .from('send_time_optimizations')
        .upsert({
          organization_id: org.id,
          best_hours_of_day: bestHours,
          best_days_of_week: bestDays,
          optimal_windows: optimalWindows,
          hourly_performance: hourlyStats,
          daily_performance: dailyStats,
          analyzed_at: new Date().toISOString(),
          sample_size: donations.length,
        }, {
          onConflict: 'organization_id',
        });

      if (upsertError) {
        console.error(`Error storing timing optimization for ${org.id}:`, upsertError);
      } else {
        console.log(`Stored timing optimization for ${org.id}: Best hours ${bestHours.join(', ')}`);
      }
    }

    console.log('Send timing optimization complete');

    return new Response(
      JSON.stringify({ 
        success: true,
        organizations_analyzed: orgs.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in optimize-send-timing:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
