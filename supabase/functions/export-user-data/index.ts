import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, checkRateLimit } from "../_shared/security.ts";

/**
 * GDPR/CCPA Compliant User Data Export
 *
 * Allows users to export all their personal data in JSON format.
 * Rate limited to 1 request per 24 hours per user.
 */

interface ExportData {
  export_date: string;
  user_id: string;
  user_email: string;
  profile: Record<string, unknown> | null;
  organizations: Record<string, unknown>[];
  consent_records: Record<string, unknown>[];
  privacy_settings: Record<string, unknown> | null;
  audit_logs: Record<string, unknown>[];
  login_history: Record<string, unknown>[];
  data_requests: {
    exports: Record<string, unknown>[];
    deletions: Record<string, unknown>[];
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 1 export per 24 hours
    const rateLimitKey = `export:${user.id}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 1, 24 * 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'You can only request one data export per 24 hours',
          retry_after_seconds: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[export-user-data] Starting export for user ${user.id}`);

    // Create export request record
    const { data: exportRequest, error: requestError } = await supabase
      .from('data_export_requests')
      .insert({
        user_id: user.id,
        status: 'processing',
        started_at: new Date().toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      })
      .select('id')
      .single();

    if (requestError) {
      console.error('[export-user-data] Failed to create request:', requestError);
    }

    // Gather all user data in parallel
    const [
      profileResult,
      organizationsResult,
      consentResult,
      privacyResult,
      auditLogsResult,
      loginHistoryResult,
      exportRequestsResult,
      deletionRequestsResult,
    ] = await Promise.all([
      // User profile
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),

      // Organization memberships
      supabase
        .from('client_users')
        .select(`
          *,
          client_organizations (
            id,
            name,
            created_at
          )
        `)
        .eq('id', user.id),

      // Consent records
      supabase
        .from('consent_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Privacy settings
      supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', user.id)
        .single(),

      // Audit logs (user's own actions)
      supabase
        .from('admin_audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000),

      // Login history
      supabase
        .from('login_attempts')
        .select('email, ip_address, success, attempted_at')
        .eq('email', user.email)
        .order('attempted_at', { ascending: false })
        .limit(100),

      // Previous export requests
      supabase
        .from('data_export_requests')
        .select('id, status, format, requested_at, completed_at')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false }),

      // Deletion requests
      supabase
        .from('data_deletion_requests')
        .select('id, status, reason, requested_at, scheduled_for, cancelled_at')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false }),
    ]);

    // Compile export data
    const exportData: ExportData = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email || '',
      profile: profileResult.data || null,
      organizations: organizationsResult.data || [],
      consent_records: consentResult.data || [],
      privacy_settings: privacyResult.data || null,
      audit_logs: auditLogsResult.data || [],
      login_history: (loginHistoryResult.data || []).map(entry => ({
        ...entry,
        ip_address: entry.ip_address ? maskIpAddress(entry.ip_address) : null,
      })),
      data_requests: {
        exports: exportRequestsResult.data || [],
        deletions: deletionRequestsResult.data || [],
      },
    };

    // Calculate size
    const jsonString = JSON.stringify(exportData, null, 2);
    const sizeBytes = new TextEncoder().encode(jsonString).length;

    // Update export request as completed
    if (exportRequest?.id) {
      await supabase
        .from('data_export_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          file_size_bytes: sizeBytes,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
        .eq('id', exportRequest.id);
    }

    // Log the export action
    await supabase.from('admin_audit_logs').insert({
      user_id: user.id,
      action_type: 'data_export',
      table_affected: 'multiple',
      new_value: {
        export_id: exportRequest?.id,
        size_bytes: sizeBytes,
        tables_included: [
          'profiles',
          'client_users',
          'consent_records',
          'privacy_settings',
          'admin_audit_logs',
          'login_attempts',
        ],
      },
    });

    console.log(`[export-user-data] Export completed for user ${user.id}, size: ${sizeBytes} bytes`);

    // Return as downloadable JSON file
    return new Response(jsonString, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="user-data-export-${user.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json"`,
        'Content-Length': sizeBytes.toString(),
      },
    });

  } catch (error) {
    console.error('[export-user-data] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export user data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Mask IP address for privacy (keep first two octets for IPv4)
 */
function maskIpAddress(ip: string): string {
  if (ip.includes('.')) {
    // IPv4
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  } else if (ip.includes(':')) {
    // IPv6
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx`;
  }
  return 'xxx.xxx.xxx.xxx';
}
