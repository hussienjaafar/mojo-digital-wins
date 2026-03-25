import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";

/**
 * Data Retention Cleanup Job
 *
 * Runs as a scheduled cron job to delete old data per retention policies.
 * Also processes confirmed account deletion requests.
 *
 * Requires CRON_SECRET header or admin JWT.
 */

interface CleanupResult {
  table: string;
  records_deleted: number;
  retention_days: number;
}

interface DeletionResult {
  user_id: string;
  status: 'completed' | 'failed';
  error?: string;
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

    // Validate cron secret or admin JWT
    const auth = await validateCronOrAdmin(req, supabase);
    if (!auth.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[data-retention-cleanup] Starting cleanup job');

    const cleanupResults: CleanupResult[] = [];
    const deletionResults: DeletionResult[] = [];

    // ============================================
    // Part 1: Run retention policy cleanup
    // ============================================

    const { data: policies } = await supabase
      .from('data_retention_policies')
      .select('*')
      .eq('is_active', true);

    if (policies) {
      for (const policy of policies) {
        const cutoffDate = new Date(Date.now() - policy.retention_days * 24 * 60 * 60 * 1000);
        let deletedCount = 0;

        try {
          switch (policy.table_name) {
            case 'login_attempts': {
              const { count } = await supabase
                .from('login_attempts')
                .delete({ count: 'exact' })
                .lt('created_at', cutoffDate.toISOString());
              deletedCount = count || 0;
              break;
            }

            case 'admin_audit_logs': {
              const { count } = await supabase
                .from('admin_audit_logs')
                .delete({ count: 'exact' })
                .lt('created_at', cutoffDate.toISOString());
              deletedCount = count || 0;
              break;
            }

            case 'data_export_requests': {
              const { count } = await supabase
                .from('data_export_requests')
                .delete({ count: 'exact' })
                .in('status', ['completed', 'failed', 'expired'])
                .lt('created_at', cutoffDate.toISOString());
              deletedCount = count || 0;
              break;
            }

            case 'contact_submissions': {
              const { count } = await supabase
                .from('contact_submissions')
                .delete({ count: 'exact' })
                .lt('created_at', cutoffDate.toISOString());
              deletedCount = count || 0;
              break;
            }
          }

          // Update policy record
          await supabase
            .from('data_retention_policies')
            .update({
              last_cleanup_at: new Date().toISOString(),
              records_deleted_last_run: deletedCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', policy.id);

          cleanupResults.push({
            table: policy.table_name,
            records_deleted: deletedCount,
            retention_days: policy.retention_days,
          });

          console.log(`[data-retention-cleanup] ${policy.table_name}: deleted ${deletedCount} records`);

        } catch (error) {
          console.error(`[data-retention-cleanup] Error cleaning ${policy.table_name}:`, error);
          cleanupResults.push({
            table: policy.table_name,
            records_deleted: -1,
            retention_days: policy.retention_days,
          });
        }
      }
    }

    // ============================================
    // Part 2: Process confirmed account deletions
    // ============================================

    const { data: pendingDeletions } = await supabase
      .from('data_deletion_requests')
      .select('*')
      .eq('status', 'confirmed')
      .lt('scheduled_for', new Date().toISOString());

    if (pendingDeletions && pendingDeletions.length > 0) {
      console.log(`[data-retention-cleanup] Processing ${pendingDeletions.length} account deletions`);

      for (const deletion of pendingDeletions) {
        try {
          // Mark as processing
          await supabase
            .from('data_deletion_requests')
            .update({ status: 'processing' })
            .eq('id', deletion.id);

          // Delete user data from various tables
          // Note: Using CASCADE on foreign keys handles most deletions

          // 1. Delete from client_users
          await supabase
            .from('client_users')
            .delete()
            .eq('id', deletion.user_id);

          // 2. Delete consent records
          await supabase
            .from('consent_records')
            .delete()
            .eq('user_id', deletion.user_id);

          // 3. Delete privacy settings
          await supabase
            .from('privacy_settings')
            .delete()
            .eq('user_id', deletion.user_id);

          // 4. Anonymize audit logs (keep for compliance but remove PII)
          await supabase
            .from('admin_audit_logs')
            .update({
              new_value: { anonymized: true, deleted_at: new Date().toISOString() },
            })
            .eq('user_id', deletion.user_id);

          // 5. Delete login attempts
          const { data: userData } = await supabase.auth.admin.getUserById(deletion.user_id);
          if (userData?.user?.email) {
            await supabase
              .from('login_attempts')
              .delete()
              .eq('email', userData.user.email);
          }

          // 6. Delete the auth user (this cascades to profiles)
          const { error: deleteError } = await supabase.auth.admin.deleteUser(deletion.user_id);

          if (deleteError) {
            throw deleteError;
          }

          // Mark deletion as completed
          await supabase
            .from('data_deletion_requests')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', deletion.id);

          deletionResults.push({
            user_id: deletion.user_id,
            status: 'completed',
          });

          console.log(`[data-retention-cleanup] Deleted account ${deletion.user_id}`);

        } catch (error) {
          console.error(`[data-retention-cleanup] Failed to delete account ${deletion.user_id}:`, error);

          // Mark as failed
          await supabase
            .from('data_deletion_requests')
            .update({
              status: 'failed',
              retained_data_types: ['all'],
              retention_reason: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('id', deletion.id);

          deletionResults.push({
            user_id: deletion.user_id,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // ============================================
    // Part 3: Expire old export requests
    // ============================================

    const { count: expiredExports } = await supabase
      .from('data_export_requests')
      .update({ status: 'expired' })
      .eq('status', 'completed')
      .lt('expires_at', new Date().toISOString());

    // Log the cleanup run
    await supabase.from('admin_audit_logs').insert({
      user_id: auth.user?.id || null,
      action_type: 'retention_cleanup',
      table_affected: 'multiple',
      new_value: {
        cleanup_results: cleanupResults,
        deletions_processed: deletionResults.length,
        exports_expired: expiredExports || 0,
      },
    });

    const totalDeleted = cleanupResults.reduce((sum, r) => sum + Math.max(0, r.records_deleted), 0);

    console.log(`[data-retention-cleanup] Completed. Total records cleaned: ${totalDeleted}`);

    return new Response(
      JSON.stringify({
        success: true,
        cleanup_results: cleanupResults,
        account_deletions: deletionResults,
        exports_expired: expiredExports || 0,
        total_records_cleaned: totalDeleted,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[data-retention-cleanup] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Cleanup job failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
