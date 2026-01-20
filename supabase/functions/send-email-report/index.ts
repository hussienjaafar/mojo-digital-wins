import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { report } from "../_shared/email-templates/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface ReportRequest {
  scheduleId?: string;
  organizationId: string;
  recipients: string[];
  startDate?: string;
  endDate?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { scheduleId, organizationId, recipients, startDate, endDate }: ReportRequest = await req.json();

    console.log("Generating report for organization:", organizationId);

    // Get schedule configuration if provided
    let reportConfig: any = null;
    let templateStyle = "professional";
    let customBranding: any = null;

    if (scheduleId) {
      const { data: schedule } = await supabase
        .from("email_report_schedules")
        .select("report_config, template_style, custom_branding")
        .eq("id", scheduleId)
        .single();
      
      if (schedule) {
        reportConfig = schedule.report_config;
        templateStyle = schedule.template_style || "professional";
        customBranding = schedule.custom_branding;
      }
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("client_organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (orgError) throw orgError;

    // Calculate date range based on config
    const end = endDate ? new Date(endDate) : new Date();
    let daysBack = 7;
    
    if (reportConfig?.dateRangeType === "custom") {
      daysBack = reportConfig.customDays || 30;
    }
    
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    const startDateStr = start.toISOString().split('T')[0];
    const endDateStr = end.toISOString().split('T')[0];

    // Fetch aggregated metrics
    const { data: metrics, error: metricsError } = await supabase
      .from("daily_aggregated_metrics")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("date", startDateStr)
      .lte("date", endDateStr)
      .order("date", { ascending: false });

    if (metricsError) throw metricsError;

    // Calculate totals
    const totals = metrics?.reduce((acc, day) => ({
      totalRaised: acc.totalRaised + (Number(day.total_funds_raised) || 0),
      totalSpent: acc.totalSpent + (Number(day.total_ad_spend) || 0) + (Number(day.total_sms_cost) || 0),
      totalDonations: acc.totalDonations + (day.total_donations || 0),
      metaImpressions: acc.metaImpressions + (day.meta_impressions || 0),
      metaClicks: acc.metaClicks + (day.meta_clicks || 0),
      smsSent: acc.smsSent + (day.sms_sent || 0),
      smsConversions: acc.smsConversions + (day.sms_conversions || 0),
    }), {
      totalRaised: 0,
      totalSpent: 0,
      totalDonations: 0,
      metaImpressions: 0,
      metaClicks: 0,
      smsSent: 0,
      smsConversions: 0,
    }) || {
      totalRaised: 0,
      totalSpent: 0,
      totalDonations: 0,
      metaImpressions: 0,
      metaClicks: 0,
      smsSent: 0,
      smsConversions: 0,
    };

    const roi = totals.totalSpent > 0 
      ? ((totals.totalRaised - totals.totalSpent) / totals.totalSpent * 100).toFixed(2)
      : "0.00";

    const avgDonation = totals.totalDonations > 0
      ? (totals.totalRaised / totals.totalDonations).toFixed(2)
      : "0.00";

    // Get configured metrics or use all by default
    const selectedMetrics = reportConfig?.metrics || [
      "funds_raised", "total_spend", "roi", "donations", "meta_ads", "sms"
    ];

    // Get branding
    const showLogo = customBranding?.includeLogo !== false;
    const footerText = customBranding?.footerText ||
      "This is an automated report. For more details, please log into your dashboard.";

    const appUrl = Deno.env.get('APP_URL') || 'https://mojo-digital-wins.lovable.app';

    // Build metrics object for template
    const metrics: Record<string, number | undefined> = {};

    if (selectedMetrics.includes("funds_raised")) {
      metrics.fundsRaised = totals.totalRaised;
    }
    if (selectedMetrics.includes("total_spend")) {
      metrics.totalSpend = totals.totalSpent;
    }
    if (selectedMetrics.includes("roi")) {
      metrics.roi = Number(roi);
    }
    if (selectedMetrics.includes("donations")) {
      metrics.donations = totals.totalDonations;
      metrics.avgDonation = Number(avgDonation);
    }
    if (selectedMetrics.includes("meta_ads")) {
      metrics.impressions = totals.metaImpressions;
      metrics.clicks = totals.metaClicks;
    }
    if (selectedMetrics.includes("sms")) {
      metrics.smsSent = totals.smsSent;
      metrics.smsConversions = totals.smsConversions;
    }

    const html = report.campaignReport({
      organizationName: org.name,
      organizationLogo: showLogo ? org.logo_url : undefined,
      dateRange: {
        start: start.toLocaleDateString(),
        end: end.toLocaleDateString(),
      },
      metrics,
      customFooter: footerText,
      dashboardUrl: `${appUrl}/client-dashboard`,
    });

    // Send email
    const senderEmail = Deno.env.get('SENDER_EMAIL');
    if (!senderEmail) {
      throw new Error('SENDER_EMAIL environment variable not configured');
    }
    const emailResponse = await resend.emails.send({
      from: `Campaign Reports <${senderEmail}>`,
      to: recipients,
      subject: `${org.name} - Performance Report (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the send
    if (scheduleId) {
      await supabase
        .from("email_report_logs")
        .insert({
          schedule_id: scheduleId,
          organization_id: organizationId,
          recipients,
          status: "sent",
        });

      await supabase
        .from("email_report_schedules")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", scheduleId);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending email report:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
