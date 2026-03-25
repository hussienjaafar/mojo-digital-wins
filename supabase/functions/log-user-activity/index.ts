import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";

/**
 * Log User Activity Edge Function
 * 
 * Accepts activity events from the frontend and logs them to user_activity_logs.
 * Validates user session and rate-limits to prevent abuse.
 */

interface ActivityEvent {
  action_type: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, any>;
}

// Rate limiting: max 100 events per user per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60000;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const now = Date.now();
    const userLimit = rateLimitMap.get(user.id);
    if (userLimit) {
      if (now < userLimit.resetAt) {
        if (userLimit.count >= RATE_LIMIT_MAX) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userLimit.count++;
      } else {
        rateLimitMap.set(user.id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      }
    } else {
      rateLimitMap.set(user.id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    // Parse request body
    const { events, organization_id } = await req.json();
    
    if (!Array.isArray(events) || events.length === 0) {
      return new Response(
        JSON.stringify({ error: "No events provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit batch size
    const maxBatchSize = 50;
    const eventsToProcess = events.slice(0, maxBatchSize) as ActivityEvent[];

    // Get client IP
    const clientIp = 
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    // Create admin client for inserting
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Build activity log entries
    const logEntries = eventsToProcess.map(event => ({
      user_id: user.id,
      organization_id: organization_id || null,
      action_type: sanitizeString(event.action_type, 100),
      resource_type: event.resource_type ? sanitizeString(event.resource_type, 100) : null,
      resource_id: event.resource_id ? sanitizeString(event.resource_id, 255) : null,
      metadata: event.metadata ? sanitizeMetadata(event.metadata) : null,
      ip_address: clientIp,
      created_at: new Date().toISOString(),
    }));

    // Insert activity logs
    const { error: insertError } = await adminClient
      .from("user_activity_logs")
      .insert(logEntries);

    if (insertError) {
      console.error("[log-user-activity] Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to log activity" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[log-user-activity] Logged ${logEntries.length} events for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, logged: logEntries.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[log-user-activity] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Sanitize string input to prevent injection
 */
function sanitizeString(value: string, maxLength: number): string {
  return String(value).slice(0, maxLength).replace(/[<>]/g, "");
}

/**
 * Sanitize metadata object - remove sensitive fields
 */
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ["password", "token", "secret", "key", "auth", "credential"];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      continue; // Skip sensitive fields
    }
    // Only include primitive values and small arrays
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    } else if (Array.isArray(value) && value.length <= 10) {
      sanitized[key] = value.slice(0, 10);
    }
  }
  
  return sanitized;
}
