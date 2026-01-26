import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";

/**
 * Geolocate IP Edge Function
 * 
 * Looks up the geographic location for an IP address using the free ip-api.com service.
 * Results are cached in the user_locations table for 24 hours.
 */

interface GeoLocation {
  ip_address: string;
  city: string | null;
  region: string | null;
  country: string | null;
  country_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

const CACHE_TTL_HOURS = 24;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { ip_address } = await req.json();

    if (!ip_address || ip_address === "unknown") {
      return new Response(
        JSON.stringify({ error: "Invalid IP address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip private/local IPs
    if (isPrivateIP(ip_address)) {
      return new Response(
        JSON.stringify({ 
          data: {
            ip_address,
            city: null,
            region: null,
            country: null,
            country_name: "Local Network",
            latitude: null,
            longitude: null,
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    const cacheThreshold = new Date();
    cacheThreshold.setHours(cacheThreshold.getHours() - CACHE_TTL_HOURS);

    const { data: cached } = await adminClient
      .from("user_locations")
      .select("*")
      .eq("ip_address", ip_address)
      .gte("created_at", cacheThreshold.toISOString())
      .maybeSingle();

    if (cached) {
      console.log(`[geolocate-ip] Cache hit for ${ip_address}`);
      return new Response(
        JSON.stringify({ data: cached, cached: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lookup IP using ip-api.com (free, no API key required for non-commercial use)
    console.log(`[geolocate-ip] Looking up IP: ${ip_address}`);
    const geoResponse = await fetch(
      `http://ip-api.com/json/${ip_address}?fields=status,message,country,countryCode,region,regionName,city,lat,lon`
    );
    
    if (!geoResponse.ok) {
      throw new Error(`Geolocation API returned ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();

    if (geoData.status === "fail") {
      console.warn(`[geolocate-ip] Lookup failed for ${ip_address}: ${geoData.message}`);
      return new Response(
        JSON.stringify({ 
          data: {
            ip_address,
            city: null,
            region: null,
            country: null,
            country_name: null,
            latitude: null,
            longitude: null,
          },
          error: geoData.message
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const location: GeoLocation = {
      ip_address,
      city: geoData.city || null,
      region: geoData.regionName || null,
      country: geoData.countryCode || null,
      country_name: geoData.country || null,
      latitude: geoData.lat || null,
      longitude: geoData.lon || null,
    };

    // Cache the result (upsert to handle race conditions)
    const { error: upsertError } = await adminClient
      .from("user_locations")
      .upsert(
        {
          ...location,
          created_at: new Date().toISOString(),
        },
        { onConflict: "ip_address" }
      );

    if (upsertError) {
      console.warn(`[geolocate-ip] Cache upsert failed:`, upsertError);
    } else {
      console.log(`[geolocate-ip] Cached location for ${ip_address}: ${location.city}, ${location.country}`);
    }

    return new Response(
      JSON.stringify({ data: location, cached: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[geolocate-ip] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to geolocate IP", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Check if an IP address is private/local
 */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  
  const first = parseInt(parts[0], 10);
  const second = parseInt(parts[1], 10);
  
  // 10.x.x.x
  if (first === 10) return true;
  // 172.16.x.x - 172.31.x.x
  if (first === 172 && second >= 16 && second <= 31) return true;
  // 192.168.x.x
  if (first === 192 && second === 168) return true;
  // 127.x.x.x (localhost)
  if (first === 127) return true;
  
  return false;
}
