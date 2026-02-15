import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";
import { computeEmailHash } from "../_shared/phoneHash.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      session_id,
      name,
      email,
      organization,
      role,
      is_decision_maker,
      budget_range,
      selected_channels,
      buying_authority_info,
      performance_kpis,
      segment,
      variant_label,
    } = body;

    if (!session_id || !email) {
      return new Response(
        JSON.stringify({ error: "session_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lead score calculation
    let score = 0;
    if (budget_range === "$50k+") score += 30;
    else if (budget_range === "$10k-$50k") score += 15;
    if (is_decision_maker) score += 20;
    if (Array.isArray(selected_channels) && selected_channels.length >= 3) score += 15;
    if (organization && organization.trim().length > 0) score += 5;

    // Hash email for PII-safe storage
    const emailHash = await computeEmailHash(email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Update lead with score + hash
    const { data: leadData, error: leadError } = await supabase
      .from("funnel_leads")
      .update({
        lead_score: score,
        email_hash: emailHash,
        status: "qualified",
        name,
        organization,
        role,
        is_decision_maker,
        budget_range,
        selected_channels,
        buying_authority_info,
        performance_kpis,
        segment,
        variant_label,
      })
      .eq("session_id", session_id)
      .select("id")
      .single();

    // If no row to update (abandoned capture didn't fire), insert
    let leadId = leadData?.id;
    if (leadError && leadError.code === "PGRST116") {
      const { data: insertedLead } = await supabase
        .from("funnel_leads")
        .insert({
          session_id,
          lead_score: score,
          email_hash: emailHash,
          email,
          name,
          organization,
          role,
          is_decision_maker,
          budget_range,
          selected_channels,
          buying_authority_info,
          performance_kpis,
          segment,
          variant_label,
          status: "qualified",
          utm_source: null,
          utm_campaign: null,
        })
        .select("id")
        .single();
      leadId = insertedLead?.id;
    }

    // Update funnel_sessions
    await supabase
      .from("funnel_sessions")
      .update({
        completed_at: new Date().toISOString(),
        lead_id: leadId || null,
      })
      .eq("session_id", session_id);

    const redirectToCalendar = score >= 50;

    // If high-value lead (score >= 50), send notification
    if (redirectToCalendar) {
      try {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            to: Deno.env.get("SALES_ALERT_EMAIL") || "team@molitico.com",
            subject: `🔥 High-Value Lead: ${name} (Score: ${score})`,
            body: `New qualified lead from funnel:\n\nName: ${name}\nEmail: ${email}\nOrg: ${organization}\nRole: ${role}\nBudget: ${budget_range}\nChannels: ${(selected_channels || []).join(", ")}\nSegment: ${segment}\nScore: ${score}\nDecision Maker: ${is_decision_maker ? "Yes" : "No"}`,
          },
        });
      } catch (e) {
        console.error("[funnel-lead-alert] Failed to send notification:", e);
      }
    }

    // Fire Lead_Qualified to Meta CAPI if budget >= $10k
    if (budget_range === "$10k-$50k" || budget_range === "$50k+") {
      try {
        await supabase.functions.invoke("meta-conversions", {
          body: {
            event_name: "Lead_Qualified",
            event_source_url: `${supabaseUrl.replace("supabase.co", "lovable.app")}/experience`,
            user_data: { em: emailHash },
            custom_data: {
              budget_range,
              segment,
              lead_score: score,
              channels: selected_channels,
            },
          },
        });
      } catch (e) {
        console.error("[funnel-lead-alert] Failed to fire Meta CAPI:", e);
      }
    }

    console.log(`[funnel-lead-alert] Lead scored: ${score}, redirect: ${redirectToCalendar}`);

    return new Response(
      JSON.stringify({
        redirect_to_calendar: redirectToCalendar,
        lead_score: score,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[funnel-lead-alert] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
