import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse cron expression to calculate next run time
function getNextRunTime(schedule: string): Date {
  // Simple implementation for common patterns
  const now = new Date();
  const parts = schedule.split(' ');
  
  if (schedule.startsWith('*/')) {
    const minutes = parseInt(schedule.split('/')[1]);
    return new Date(now.getTime() + minutes * 60 * 1000);
  }
  
  // Default to 5 minutes
  return new Date(now.getTime() + 5 * 60 * 1000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking for scheduled jobs to run...');

    // Get jobs that are due to run
    const now = new Date();
    const { data: jobs } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('is_active', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`)
      .limit(10);

    console.log(`Found ${jobs?.length || 0} jobs to run`);

    let jobsRun = 0;
    let jobsFailed = 0;

    for (const job of jobs || []) {
      const startTime = Date.now();
      
      try {
        console.log(`Running job: ${job.job_name}`);
        
        // Create execution record
        const { data: execution } = await supabase
          .from('job_executions')
          .insert({
            job_id: job.id,
            status: 'running'
          })
          .select()
          .single();

        // Call the edge function
        const functionUrl = `${supabaseUrl}${job.endpoint}`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(job.payload || {})
        });

        const result = await response.json();
        const duration = Date.now() - startTime;

        // Update execution record
        await supabase
          .from('job_executions')
          .update({
            completed_at: new Date().toISOString(),
            status: response.ok ? 'completed' : 'failed',
            result,
            error_message: response.ok ? null : result.error,
            duration_ms: duration
          })
          .eq('id', execution.id);

        // Update job's last run time and calculate next run
        const nextRun = getNextRunTime(job.schedule);
        await supabase
          .from('scheduled_jobs')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString()
          })
          .eq('id', job.id);

        if (response.ok) {
          jobsRun++;
          console.log(`✓ Job ${job.job_name} completed in ${duration}ms`);
        } else {
          jobsFailed++;
          console.error(`✗ Job ${job.job_name} failed:`, result.error);
        }

      } catch (error: any) {
        jobsFailed++;
        console.error(`Error running job ${job.job_name}:`, error);
        
        // Update job's next run time even on failure
        const nextRun = getNextRunTime(job.schedule);
        await supabase
          .from('scheduled_jobs')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString()
          })
          .eq('id', job.id);
      }
    }

    console.log(`Completed: ${jobsRun} succeeded, ${jobsFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobsRun,
        jobsFailed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in run-scheduled-jobs:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
