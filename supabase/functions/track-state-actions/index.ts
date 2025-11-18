import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Priority states with significant Arab American and Muslim populations
const PRIORITY_STATES = [
  'MI', 'CA', 'NY', 'IL', 'TX', 'FL', 'PA', 'NJ', 'OH', 'VA'
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Tracking state actions...');

    let totalInserted = 0;
    let totalErrors = 0;

    // For demonstration, we'll track Michigan state legislation using LegiScan API
    // In production, you'd add your LegiScan API key
    const legiscanKey = Deno.env.get('LEGISCAN_API_KEY');
    
    if (!legiscanKey) {
      console.log('LegiScan API key not configured. Skipping state action tracking.');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'LegiScan API key not configured',
          actionsAdded: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Track legislation in priority states
    for (const state of PRIORITY_STATES) {
      try {
        // LegiScan API call would go here
        // For now, we'll create a placeholder entry
        console.log(`Tracking legislation for ${state}...`);
        
        // Example: This would be replaced with actual API calls
        const mockAction = {
          state,
          action_type: 'legislation',
          title: `State Legislation Tracker - ${state}`,
          description: 'Tracking state-level legislative actions',
          status: 'active',
          introduced_date: new Date().toISOString().split('T')[0],
          source_url: `https://legiscan.com/`,
          tags: ['civil rights', 'discrimination'],
          relevance_score: 5
        };

        // Only insert if we have real data
        // This is commented out to avoid inserting mock data
        /*
        const { error } = await supabase
          .from('state_actions')
          .insert(mockAction)
          .select()
          .maybeSingle();

        if (!error) {
          totalInserted++;
        } else if (!error.message?.includes('duplicate key')) {
          console.error(`Error inserting action for ${state}:`, error);
          totalErrors++;
        }
        */
      } catch (err: any) {
        console.error(`Error processing state ${state}:`, err);
        totalErrors++;
      }
    }

    console.log(`Completed: ${totalInserted} new actions, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        actionsAdded: totalInserted,
        errors: totalErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in track-state-actions:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
