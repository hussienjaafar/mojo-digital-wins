import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log('Fetching executive orders...');

    // Fetch from Federal Register API (https://www.federalregister.gov/developers/documentation/api/v1)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const url = `https://www.federalregister.gov/api/v1/documents.json?` +
      `conditions[type][]=PRESDOCU&` +
      `conditions[presidential_document_type][]=executive_order&` +
      `conditions[publication_date][gte]=${thirtyDaysAgo.toISOString().split('T')[0]}&` +
      `per_page=100&` +
      `order=newest`;

    console.log('Fetching from:', url);
    const response = await fetch(url);
    const data = await response.json();

    console.log(`Found ${data.results?.length || 0} executive orders`);

    let insertedCount = 0;
    let errorCount = 0;

    for (const order of data.results || []) {
      try {
        const { error } = await supabase
          .from('executive_orders')
          .insert({
            order_number: order.executive_order_number || order.document_number,
            title: order.title,
            issuing_authority: order.president || 'Federal Government',
            jurisdiction: 'Federal',
            issued_date: order.signing_date || order.publication_date,
            effective_date: order.effective_on,
            summary: order.abstract || order.summary,
            full_text: order.full_text_xml_url ? null : order.raw_text_url,
            source_url: order.html_url,
            tags: order.topics || [],
            relevance_score: 5
          })
          .select()
          .maybeSingle();

        if (!error) {
          insertedCount++;
        } else if (!error.message?.includes('duplicate key')) {
          console.error(`Error inserting order ${order.document_number}:`, error);
          errorCount++;
        }
      } catch (err: any) {
        console.error(`Error processing order:`, err);
        errorCount++;
      }
    }

    console.log(`Completed: ${insertedCount} new orders, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ordersAdded: insertedCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fetch-executive-orders:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
