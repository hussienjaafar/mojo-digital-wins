import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getCorsHeaders, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();
const PIXEL_ID = "1344961220416600";
const API_VERSION = "v22.0";

const metaEventSchema = z.object({
  event_name: z.string().trim().min(1).max(100),
  event_source_url: z.string().url().max(500).optional(),
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
    em?: string;
    ph?: string;
    fn?: string;
    ln?: string;
  };
  custom_data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Rate limiting for public endpoint
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(`meta-conversions:${clientIP}`, 100, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
    
    if (!accessToken) {
      console.error('META_CONVERSIONS_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Conversions API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();
    const validationResult = metaEventSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input parameters', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { event_name, event_source_url, user_data = {}, custom_data = {} } = validationResult.data;

    const userAgent = req.headers.get('user-agent') || '';

    const conversionEvent: ConversionEvent = {
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url,
      user_data: {
        client_ip_address: clientIP,
        client_user_agent: userAgent,
        ...user_data,
      },
    };

    if (Object.keys(custom_data).length > 0) {
      conversionEvent.custom_data = custom_data;
    }

    const apiUrl = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Conversion event sent:', { event_name, events_received: result.events_received });

    return new Response(
      JSON.stringify({ success: true, events_received: result.events_received, fbtrace_id: result.fbtrace_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-conversions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
