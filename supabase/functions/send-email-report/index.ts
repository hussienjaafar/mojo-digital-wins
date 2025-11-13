import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const primaryColor = customBranding?.primaryColor || "#667eea";
    const showLogo = customBranding?.includeLogo !== false;
    const footerText = customBranding?.footerText || 
      "This is an automated report. For more details, please log into your dashboard.";

    // Build HTML sections
    let metricsHtml = "";
    
    if (selectedMetrics.includes("funds_raised")) {
      metricsHtml += `
        <div class="metric-card">
          <div class="metric-label">Total Funds Raised</div>
          <div class="metric-value">$${totals.totalRaised.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      `;
    }

    if (selectedMetrics.includes("total_spend") || selectedMetrics.includes("roi")) {
      metricsHtml += '<div class="metric-grid">';
      
      if (selectedMetrics.includes("total_spend")) {
        metricsHtml += `
          <div class="metric-card">
            <div class="metric-label">Total Spend</div>
            <div class="metric-value">$${totals.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        `;
      }

      if (selectedMetrics.includes("roi")) {
        metricsHtml += `
          <div class="metric-card">
            <div class="metric-label">ROI</div>
            <div class="metric-value ${Number(roi) > 0 ? 'positive' : 'negative'}">${roi}%</div>
          </div>
        `;
      }
      
      metricsHtml += '</div>';
    }

    if (selectedMetrics.includes("donations")) {
      metricsHtml += `
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-label">Total Donations</div>
            <div class="metric-value">${totals.totalDonations}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Avg Donation</div>
            <div class="metric-value">$${avgDonation}</div>
          </div>
        </div>
      `;
    }

    let campaignHtml = "";
    if (selectedMetrics.includes("meta_ads") || selectedMetrics.includes("sms")) {
      campaignHtml = '<h2 style="margin-top: 30px;">Campaign Performance</h2><div class="metric-grid">';
      
      if (selectedMetrics.includes("meta_ads")) {
        campaignHtml += `
          <div class="metric-card">
            <div class="metric-label">Meta Ads Impressions</div>
            <div class="metric-value">${totals.metaImpressions.toLocaleString()}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Meta Ads Clicks</div>
            <div class="metric-value">${totals.metaClicks.toLocaleString()}</div>
          </div>
        `;
      }

      if (selectedMetrics.includes("sms")) {
        campaignHtml += `
          <div class="metric-card">
            <div class="metric-label">SMS Messages Sent</div>
            <div class="metric-value">${totals.smsSent.toLocaleString()}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">SMS Conversions</div>
            <div class="metric-value">${totals.smsConversions.toLocaleString()}</div>
          </div>
        `;
      }

      campaignHtml += '</div>';
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: ${primaryColor}; color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header img { max-height: 40px; margin-bottom: 10px; }
    .content { padding: 30px; background: #f9fafb; }
    .metric-card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .metric-label { color: #6b7280; font-size: 14px; text-transform: uppercase; margin-bottom: 5px; }
    .metric-value { font-size: ${templateStyle === 'detailed' ? '28px' : '32px'}; font-weight: bold; color: #1f2937; }
    .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .footer { background: #1f2937; color: white; padding: 20px; text-align: center; font-size: 12px; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    ${templateStyle === 'minimal' ? '.metric-label { font-size: 12px; }' : ''}
    ${templateStyle === 'minimal' ? 'h2 { font-size: 18px; }' : ''}
  </style>
</head>
<body>
  <div class="header">
    ${showLogo && org.logo_url ? `<img src="${org.logo_url}" alt="${org.name}" />` : ''}
    <h1>📊 Performance Report</h1>
    <p>${org.name}</p>
    <p style="font-size: 14px; opacity: 0.9;">${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
  </div>
  <div class="content">
    ${templateStyle !== 'minimal' ? '<h2>Key Metrics</h2>' : ''}
    ${metricsHtml}
    ${campaignHtml}
  </div>
  <div class="footer">
    <p>${footerText}</p>
    <p>&copy; ${new Date().getFullYear()} ${org.name}. All rights reserved.</p>
  </div>
</body>
</html>`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Campaign Reports <reports@resend.dev>",
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
