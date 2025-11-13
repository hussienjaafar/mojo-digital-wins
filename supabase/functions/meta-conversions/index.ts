import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIXEL_ID = "1344961220416600";
const API_VERSION = "v22.0";

const metaEventSchema = z.object({
  event_name: z.string().trim().min(1, { message: "Event name is required" }).max(100, { message: "Event name must be less than 100 characters" }),
  event_source_url: z.string().url({ message: "Invalid URL format" }).max(500, { message: "URL must be less than 500 characters" }).optional(),
  user_data: z.object({
    em: z.string().optional(),
    ph: z.string().optional(),
    fn: z.string().optional(),
    ln: z.string().optional(),
  }).optional(),
  custom_data: z.record(z.string(), z.any()).optional()
});

interface ConversionEvent {
  event_name: string;
  event_time: number;
  action_source: string;
  event_source_url?: string;
  user_data?: {
    client_ip_address?: string;
    client_user_agent?: string;
    em?: string; // hashed email
    ph?: string; // hashed phone
    fn?: string; // hashed first name
    ln?: string; // hashed last name
  };
  custom_data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
    
    if (!accessToken) {
      console.error('META_CONVERSIONS_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Conversions API not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate input with Zod schema
    const requestBody = await req.json();
    const validationResult = metaEventSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input parameters',
          details: validationResult.error.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { 
      event_name, 
      event_source_url, 
      user_data = {},
      custom_data = {} 
    } = validationResult.data;

    // Get client IP and user agent from request headers
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Build the conversion event
    const conversionEvent: ConversionEvent = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url,
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: userAgent,
        ...user_data,
      },
    };

    if (Object.keys(custom_data).length > 0) {
      conversionEvent.custom_data = custom_data;
    }

    // Send to Meta Conversions API
    const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [conversionEvent],
        access_token: accessToken,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta Conversions API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send conversion event', details: result }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Conversion event sent successfully:', {
      event_name,
      events_received: result.events_received,
      fbtrace_id: result.fbtrace_id,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        events_received: result.events_received,
        fbtrace_id: result.fbtrace_id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in meta-conversions function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
