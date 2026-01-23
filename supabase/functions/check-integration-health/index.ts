import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CredentialHealthStatus {
  field: string;
  configured: boolean;
  hint?: string;
}

interface WebhookHealthStats {
  recentSuccessCount: number;
  recentFailureCount: number;
  failureRate: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  recentErrors: string[];
}

interface SyncHealthStats {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  syncSuccessRate: number;
  recentSyncCount: number;
}

interface DataFreshnessStats {
  lastTransactionAt: string | null;
  transactionsLast7Days: number;
  daysStale: number;
  isStale: boolean;
}

interface IntegrationHealth {
  platform: string;
  organizationId: string;
  organizationName: string;
  credentialId: string;
  isActive: boolean;
  credentialStatus: CredentialHealthStatus[];
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  webhookHealth: WebhookHealthStats | null;
  syncHealth: SyncHealthStats | null;
  dataFreshness: DataFreshnessStats | null;
  healthScore: number;
  recommendations: string[];
  checkedAt: string;
}

function getCredentialHint(value: string | undefined | null): string | undefined {
  if (!value || typeof value !== 'string' || value.length < 4) return undefined;
  return value.slice(-4);
}

function getActBlueCredentialStatus(credentials: any): CredentialHealthStatus[] {
  return [
    { 
      field: 'Entity ID', 
      configured: !!credentials?.entity_id,
      hint: getCredentialHint(credentials?.entity_id?.toString())
    },
    { 
      field: 'API Username', 
      configured: !!credentials?.username,
      hint: getCredentialHint(credentials?.username)
    },
    { 
      field: 'API Password', 
      configured: !!credentials?.password,
      hint: credentials?.password ? '****' : undefined
    },
    { 
      field: 'Webhook Username', 
      configured: !!credentials?.webhook_username,
      hint: getCredentialHint(credentials?.webhook_username)
    },
    { 
      field: 'Webhook Password', 
      configured: !!credentials?.webhook_password,
      hint: credentials?.webhook_password ? '****' : undefined
    },
    { 
      field: 'Webhook Secret', 
      configured: !!credentials?.webhook_secret,
      hint: credentials?.webhook_secret ? '****' : undefined
    },
  ];
}

function getMetaCredentialStatus(credentials: any): CredentialHealthStatus[] {
  return [
    { 
      field: 'Access Token', 
      configured: !!credentials?.access_token,
      hint: getCredentialHint(credentials?.access_token)
    },
    { 
      field: 'Ad Account ID', 
      configured: !!credentials?.ad_account_id,
      hint: getCredentialHint(credentials?.ad_account_id)
    },
    { 
      field: 'Business Manager ID', 
      configured: !!credentials?.business_manager_id,
      hint: getCredentialHint(credentials?.business_manager_id)
    },
  ];
}

function calculateHealthScore(
  credentialStatus: CredentialHealthStatus[],
  webhookHealth: WebhookHealthStats | null,
  syncHealth: SyncHealthStats | null,
  dataFreshness: DataFreshnessStats | null,
  lastTestStatus: string | null
): number {
  let score = 100;
  
  // Credential configuration (30 points max)
  const configuredCount = credentialStatus.filter(c => c.configured).length;
  const configRatio = credentialStatus.length > 0 ? configuredCount / credentialStatus.length : 1;
  score -= (1 - configRatio) * 30;
  
  // Webhook health (30 points max)
  if (webhookHealth) {
    if (webhookHealth.failureRate > 0.5) {
      score -= 30;
    } else if (webhookHealth.failureRate > 0.1) {
      score -= 20;
    } else if (webhookHealth.failureRate > 0) {
      score -= 10;
    }
  }
  
  // Sync health (20 points max)
  if (syncHealth) {
    if (syncHealth.lastSyncStatus !== 'success') {
      score -= 15;
    }
    if (syncHealth.syncSuccessRate < 0.9) {
      score -= 5;
    }
  }
  
  // Data freshness (20 points max)
  if (dataFreshness) {
    if (dataFreshness.isStale) {
      score -= Math.min(20, dataFreshness.daysStale * 5);
    }
  }
  
  // Last test status
  if (lastTestStatus === 'error' || lastTestStatus === 'invalid_credentials') {
    score -= 10;
  }
  
  return Math.max(0, Math.round(score));
}

function generateRecommendations(
  platform: string,
  credentialStatus: CredentialHealthStatus[],
  webhookHealth: WebhookHealthStats | null,
  syncHealth: SyncHealthStats | null,
  dataFreshness: DataFreshnessStats | null,
  lastTestStatus: string | null
): string[] {
  const recommendations: string[] = [];
  
  // Check for missing credentials
  const missingCreds = credentialStatus.filter(c => !c.configured);
  if (missingCreds.length > 0) {
    recommendations.push(`Configure missing credentials: ${missingCreds.map(c => c.field).join(', ')}`);
  }
  
  // Webhook issues
  if (webhookHealth && webhookHealth.failureRate > 0.1) {
    recommendations.push('Update webhook credentials - authentication is failing');
    if (webhookHealth.recentErrors.length > 0) {
      recommendations.push(`Fix webhook error: ${webhookHealth.recentErrors[0]}`);
    }
  }
  
  // Data freshness
  if (dataFreshness && dataFreshness.isStale) {
    recommendations.push(`Run data backfill for the last ${dataFreshness.daysStale} days`);
  }
  
  // Sync issues
  if (syncHealth && syncHealth.lastSyncStatus !== 'success') {
    recommendations.push('Check sync configuration - last sync failed');
  }
  
  // Test status
  if (lastTestStatus === 'invalid_credentials') {
    recommendations.push('Credentials are invalid - please update them');
  }
  
  return recommendations;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { organization_id, platform } = await req.json().catch(() => ({}));

    console.log(`[CHECK-INTEGRATION-HEALTH] Starting health check. org=${organization_id}, platform=${platform}`);

    // Fetch credentials
    let credQuery = supabase
      .from("client_api_credentials")
      .select(`
        id,
        organization_id,
        platform,
        encrypted_credentials,
        is_active,
        last_tested_at,
        last_test_status,
        last_test_error,
        last_sync_at,
        last_sync_status,
        credential_mask,
        client_organizations!inner(name, timezone)
      `);

    if (organization_id) {
      credQuery = credQuery.eq("organization_id", organization_id);
    }
    if (platform) {
      credQuery = credQuery.eq("platform", platform);
    }

    const { data: credentials, error: credError } = await credQuery;

    if (credError) {
      throw credError;
    }

    const results: IntegrationHealth[] = [];
    const checkedAt = new Date().toISOString();

    for (const cred of credentials || []) {
      const orgId = cred.organization_id;
      const orgName = (cred.client_organizations as any)?.name || "Unknown";
      
      // Parse credentials for status check
      let credData: any = {};
      try {
        credData = typeof cred.encrypted_credentials === "string"
          ? JSON.parse(cred.encrypted_credentials)
          : cred.encrypted_credentials || {};
      } catch {
        credData = {};
      }

      // Get credential status based on platform
      let credentialStatus: CredentialHealthStatus[];
      switch (cred.platform) {
        case "actblue":
          credentialStatus = getActBlueCredentialStatus(credData);
          break;
        case "meta":
          credentialStatus = getMetaCredentialStatus(credData);
          break;
        default:
          credentialStatus = [];
      }

      // Fetch webhook health for ActBlue
      let webhookHealth: WebhookHealthStats | null = null;
      if (cred.platform === "actblue") {
        const { data: webhookLogs } = await supabase
          .from("webhook_logs")
          .select("processing_status, error_message, received_at")
          .eq("organization_id", orgId)
          .eq("platform", "actblue")
          .gte("received_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order("received_at", { ascending: false })
          .limit(100);

        if (webhookLogs && webhookLogs.length > 0) {
          const successCount = webhookLogs.filter(l => l.processing_status === "success").length;
          const failureCount = webhookLogs.filter(l => l.processing_status === "failed").length;
          const errors = [...new Set(
            webhookLogs
              .filter(l => l.error_message)
              .map(l => l.error_message as string)
              .slice(0, 3)
          )];
          
          const successLogs = webhookLogs.filter(l => l.processing_status === "success");
          const failureLogs = webhookLogs.filter(l => l.processing_status === "failed");

          webhookHealth = {
            recentSuccessCount: successCount,
            recentFailureCount: failureCount,
            failureRate: webhookLogs.length > 0 ? failureCount / webhookLogs.length : 0,
            lastSuccessAt: successLogs[0]?.received_at || null,
            lastFailureAt: failureLogs[0]?.received_at || null,
            recentErrors: errors,
          };
        }
      }

      // Build sync health from credential record
      let syncHealth: SyncHealthStats | null = null;
      if (cred.last_sync_at) {
        syncHealth = {
          lastSyncAt: cred.last_sync_at,
          lastSyncStatus: cred.last_sync_status,
          syncSuccessRate: cred.last_sync_status === "success" ? 1 : 0.5,
          recentSyncCount: 1,
        };
      }

      // Fetch data freshness for ActBlue
      let dataFreshness: DataFreshnessStats | null = null;
      if (cred.platform === "actblue") {
        const { data: lastTx } = await supabase
          .from("actblue_transactions")
          .select("transaction_date")
          .eq("organization_id", orgId)
          .order("transaction_date", { ascending: false })
          .limit(1)
          .single();

        const { count: recentCount } = await supabase
          .from("actblue_transactions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .gte("transaction_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const lastTxDate = lastTx?.transaction_date ? new Date(lastTx.transaction_date) : null;
        const daysStale = lastTxDate 
          ? Math.floor((Date.now() - lastTxDate.getTime()) / (24 * 60 * 60 * 1000))
          : 999;

        dataFreshness = {
          lastTransactionAt: lastTx?.transaction_date || null,
          transactionsLast7Days: recentCount || 0,
          daysStale,
          isStale: daysStale > 1, // More than 1 day without data is stale
        };
      }

      const healthScore = calculateHealthScore(
        credentialStatus,
        webhookHealth,
        syncHealth,
        dataFreshness,
        cred.last_test_status
      );

      const recommendations = generateRecommendations(
        cred.platform,
        credentialStatus,
        webhookHealth,
        syncHealth,
        dataFreshness,
        cred.last_test_status
      );

      results.push({
        platform: cred.platform,
        organizationId: orgId,
        organizationName: orgName,
        credentialId: cred.id,
        isActive: cred.is_active,
        credentialStatus,
        lastTestedAt: cred.last_tested_at,
        lastTestStatus: cred.last_test_status,
        lastTestError: cred.last_test_error,
        webhookHealth,
        syncHealth,
        dataFreshness,
        healthScore,
        recommendations,
        checkedAt,
      });
    }

    console.log(`[CHECK-INTEGRATION-HEALTH] Completed. Checked ${results.length} integrations.`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: results.length,
          healthy: results.filter(r => r.healthScore >= 80).length,
          warning: results.filter(r => r.healthScore >= 50 && r.healthScore < 80).length,
          critical: results.filter(r => r.healthScore < 50).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[CHECK-INTEGRATION-HEALTH] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
