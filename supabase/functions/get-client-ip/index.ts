import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/security.ts";

/**
 * Get Client IP Edge Function
 * 
 * Returns the client's IP address. This is useful for the frontend to obtain
 * the user's IP address for session tracking, since browsers cannot directly
 * access their own public IP.
 */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Get IP from various headers (in order of reliability)
    const ip = 
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    console.log(`[get-client-ip] Returning IP: ${ip}`);

    return new Response(
      JSON.stringify({ 
        ip,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[get-client-ip] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get client IP", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
