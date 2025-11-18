import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  report_type: string; // critical_alerts, executive_orders, state_actions, organization_mentions, daily_briefing
  format: string; // csv, json, pdf
  start_date?: string;
  end_date?: string;
  filters?: Record<string, any>;
  report_name?: string;
}

function generateCSV(data: any[], columns?: string[]): string {
  if (!data || data.length === 0) {
    return columns ? columns.join(',') + '\n' : '';
  }

  const headers = columns || Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '';
      if (Array.isArray(value)) return `"${value.join('; ')}"`;
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function generatePDFHTML(data: any, reportType: string, dateRange: { start: string; end: string }): string {
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  let content = '';
  let title = '';

  switch (reportType) {
    case 'daily_briefing':
      title = 'Daily Intelligence Briefing';
      const threatScore = data.threat_score || 0;
      const threatColor = threatScore >= 75 ? '#dc2626' : threatScore >= 50 ? '#ea580c' : threatScore >= 25 ? '#ca8a04' : '#16a34a';

      content = `
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font-size: 48px; font-weight: bold; color: ${threatColor};">${threatScore}/100</div>
          <div style="color: #6b7280;">Overall Threat Score</div>
        </div>

        <h2>Summary Statistics</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #fef2f2;"><strong>Critical Alerts</strong><br>${data.critical_count || 0}</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; background: #fff7ed;"><strong>High Priority</strong><br>${data.high_count || 0}</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Total Articles</strong><br>${data.total_articles || 0}</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Total Bills</strong><br>${data.total_bills || 0}</td>
          </tr>
        </table>

        <h2>Critical Items</h2>
        ${(data.critical_items || []).map((item: any) => `
          <div style="border: 1px solid #fca5a5; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fef2f2;">
            <div style="font-weight: bold;">${item.title}</div>
            <div style="font-size: 12px; color: #6b7280;">${item.type} • ${item.source || ''}</div>
          </div>
        `).join('')}

        <h2>Organization Mentions</h2>
        ${Object.entries(data.organization_mentions || {}).map(([org, stats]: [string, any]) => `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <span>${org}</span>
            <span>${stats.total} mentions (${stats.critical} critical)</span>
          </div>
        `).join('')}
      `;
      break;

    case 'critical_alerts':
      title = 'Critical Alerts Report';
      content = `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Date</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Title</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Level</th>
              <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Source</th>
            </tr>
          </thead>
          <tbody>
            ${(data || []).map((item: any) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.date ? formatDate(item.date) : ''}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.title}</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">
                  <span style="background: ${item.threat_level === 'critical' ? '#dc2626' : '#ea580c'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                    ${item.threat_level?.toUpperCase()}
                  </span>
                </td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.source || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;

    default:
      title = 'Intelligence Report';
      content = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 40px;
      color: #111827;
    }
    h1 { color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .date-range { color: #6b7280; font-size: 14px; }
    @media print {
      body { margin: 20px; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="date-range">
      ${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}
    </div>
  </div>
  ${content}
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    Generated on ${new Date().toLocaleString()} • Intelligence Early Warning System
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const body: ReportRequest = await req.json();
    const {
      report_type,
      format = 'csv',
      start_date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date = new Date().toISOString().split('T')[0],
      filters = {},
      report_name
    } = body;

    console.log(`Generating ${format} report: ${report_type}`);

    // Create report record
    const { data: reportRecord, error: recordError } = await supabase
      .from('generated_reports')
      .insert({
        report_type,
        report_name: report_name || `${report_type}_${start_date}_${end_date}`,
        report_format: format,
        date_range_start: start_date,
        date_range_end: end_date,
        filters,
        generated_by: userId,
        status: 'generating',
      })
      .select('id')
      .single();

    if (recordError) {
      console.error('Error creating report record:', recordError);
    }

    // Fetch data using the database function
    const { data: exportData, error: dataError } = await supabase.rpc('get_export_data', {
      p_export_type: report_type,
      p_start_date: start_date,
      p_end_date: end_date,
      p_filters: filters,
    });

    if (dataError) throw dataError;

    let responseContent: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        responseContent = generateCSV(exportData || []);
        contentType = 'text/csv';
        filename = `${report_type}_${start_date}_${end_date}.csv`;
        break;

      case 'json':
        responseContent = JSON.stringify(exportData || [], null, 2);
        contentType = 'application/json';
        filename = `${report_type}_${start_date}_${end_date}.json`;
        break;

      case 'pdf':
        // For PDF, we return HTML that can be converted client-side or via a service
        let pdfData = exportData;

        // For daily briefing, fetch additional data
        if (report_type === 'daily_briefing') {
          const { data: briefing } = await supabase
            .from('daily_briefings')
            .select('*')
            .eq('briefing_date', end_date)
            .single();

          pdfData = {
            ...briefing,
            critical_items: exportData?.filter((i: any) => i.threat_level === 'critical') || [],
            threat_score: briefing?.critical_count ? Math.min(100, briefing.critical_count * 25 + (briefing.high_count || 0) * 10) : 0,
          };
        }

        responseContent = generatePDFHTML(pdfData, report_type, { start: start_date, end: end_date });
        contentType = 'text/html';
        filename = `${report_type}_${start_date}_${end_date}.html`;
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Update report record
    if (reportRecord?.id) {
      await supabase
        .from('generated_reports')
        .update({
          status: 'completed',
          file_size_bytes: new TextEncoder().encode(responseContent).length,
          completed_at: new Date().toISOString(),
        })
        .eq('id', reportRecord.id);
    }

    console.log(`Report generated: ${filename} (${responseContent.length} bytes)`);

    return new Response(responseContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
