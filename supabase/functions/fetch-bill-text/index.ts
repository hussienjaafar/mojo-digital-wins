import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOVINFO_API_BASE = 'https://api.govinfo.gov';
const CONGRESS_API_KEY = Deno.env.get('CONGRESS_GOV_API_KEY');
const CONGRESS_API_BASE = 'https://api.congress.gov/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { congress, billType, billNumber } = await req.json();

    console.log(`Fetching full text for ${billType}${billNumber} from Congress ${congress}`);

    // Try Congress.gov API first for text versions
    const textResponse = await fetch(
      `${CONGRESS_API_BASE}/bill/${congress}/${billType}/${billNumber}/text?api_key=${CONGRESS_API_KEY}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!textResponse.ok) {
      throw new Error(`Failed to fetch text versions: ${textResponse.statusText}`);
    }

    const textData = await textResponse.json();
    const textVersions = textData.textVersions || [];

    if (textVersions.length === 0) {
      return new Response(
        JSON.stringify({ 
          fullText: "Full text is not yet available for this bill. The text may be added once the bill progresses through the legislative process." 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the most recent text version
    const latestVersion = textVersions[0];
    
    // Try to get the text URL
    const formats = latestVersion.formats || [];
    const txtFormat = formats.find((f: any) => f.type === 'Formatted Text');
    const pdfFormat = formats.find((f: any) => f.type === 'PDF');
    
    if (txtFormat && txtFormat.url) {
      // Fetch the actual text
      const fullTextResponse = await fetch(txtFormat.url);
      if (fullTextResponse.ok) {
        const fullText = await fullTextResponse.text();
        
        return new Response(
          JSON.stringify({ 
            fullText,
            version: latestVersion.type,
            date: latestVersion.date
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // If we can't get formatted text, provide PDF link
    if (pdfFormat && pdfFormat.url) {
      return new Response(
        JSON.stringify({ 
          fullText: `Full text is available as a PDF. [View PDF](${pdfFormat.url})`,
          pdfUrl: pdfFormat.url,
          version: latestVersion.type,
          date: latestVersion.date
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fallback: provide summary information
    return new Response(
      JSON.stringify({ 
        fullText: `Full text version: ${latestVersion.type}\nDate: ${latestVersion.date}\n\nFull text is available on Congress.gov but could not be retrieved automatically.`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in fetch-bill-text function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
