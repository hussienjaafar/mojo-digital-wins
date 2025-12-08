/**
 * Shared security utilities for Edge Functions
 * Provides CORS, encryption, auth validation, rate limiting helpers
 */

/**
 * Get CORS headers with allowed origins from env
 */
export function getCorsHeaders(): Record<string, string> {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  const origin = allowedOrigins[0] || 'https://lovable.dev';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-admin-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

/**
 * Validate that a request has proper authentication
 * Returns the user if valid, null otherwise
 */
export async function validateAuth(
  req: Request,
  supabase: any
): Promise<{ user: any; isAdmin: boolean } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) return null;

  // Check if admin
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = roles?.some((r: any) => r.role === 'admin') || false;

  return { user, isAdmin };
}

/**
 * Validate cron secret for scheduled jobs
 */
export function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured - allowing request');
    return true;
  }
  
  const providedSecret = req.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}

/**
 * Check if user belongs to organization
 */
export async function userBelongsToOrg(
  supabase: any,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('client_users')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return data.organization_id === organizationId;
}

/**
 * Encrypt sensitive data before storage (AES-GCM with PBKDF2 key derivation)
 */
export async function encryptCredentials(data: Record<string, any>, orgId: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);
  
  const secret = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY') || 'default-key-change-me';
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret + orgId),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(orgId),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(dataStr)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt credentials
 */
export async function decryptCredentials(encryptedData: string, orgId: string): Promise<Record<string, any>> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const secret = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY') || 'default-key-change-me';
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret + orgId),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(orgId),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return JSON.parse(decoder.decode(decrypted));
}

/**
 * Mask sensitive fields for display (never return raw secrets to clients)
 */
export function maskCredentials(credentials: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    'password', 'secret', 'token', 'api_key', 'apikey', 'access_token',
    'webhook_secret', 'webhook_password', 'private_key', 'refresh_token'
  ];
  
  const masked: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(credentials)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(f => lowerKey.includes(f));
    
    if (isSensitive && typeof value === 'string' && value.length > 0) {
      masked[key] = value.length > 4 
        ? '••••••••' + value.slice(-4)
        : '••••••••';
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}

/**
 * Log job failure for dead-letter handling
 */
export async function logJobFailure(
  supabase: any,
  functionName: string,
  errorMessage: string,
  context: Record<string, any> = {}
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('log_job_failure', {
      p_function_name: functionName,
      p_error_message: errorMessage,
      p_error_stack: context.stack || null,
      p_context: context
    });
    
    if (error) {
      console.error('Failed to log job failure:', error);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Exception logging job failure:', e);
    return null;
  }
}

/**
 * Check and update quota for an organization
 * Returns true if within quota, false if exceeded
 */
export async function checkQuota(
  supabase: any,
  organizationId: string,
  quotaType: string
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  // Get current quota
  const { data: quota, error } = await supabase
    .from('organization_quotas')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('quota_type', quotaType)
    .maybeSingle();

  if (error) {
    console.error('Error checking quota:', error);
    // Fail open - allow if we can't check
    return { allowed: true, remaining: 999, resetAt: '' };
  }

  // No quota configured = unlimited
  if (!quota || quota.is_unlimited) {
    return { allowed: true, remaining: 999, resetAt: '' };
  }

  const now = new Date();
  
  // Reset counters if needed
  if (new Date(quota.hour_reset_at) <= now) {
    await supabase
      .from('organization_quotas')
      .update({
        current_hour_count: 0,
        hour_reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
      })
      .eq('id', quota.id);
    quota.current_hour_count = 0;
  }

  if (new Date(quota.day_reset_at) <= now) {
    await supabase
      .from('organization_quotas')
      .update({
        current_day_count: 0,
        day_reset_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('id', quota.id);
    quota.current_day_count = 0;
  }

  // Check if within limits
  const hourlyRemaining = quota.max_per_hour - quota.current_hour_count;
  const dailyRemaining = quota.max_per_day - quota.current_day_count;
  const remaining = Math.min(hourlyRemaining, dailyRemaining);
  const allowed = remaining > 0;

  if (allowed) {
    // Increment counters
    await supabase
      .from('organization_quotas')
      .update({
        current_hour_count: quota.current_hour_count + 1,
        current_day_count: quota.current_day_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', quota.id);
  }

  return {
    allowed,
    remaining: Math.max(0, remaining - 1),
    resetAt: hourlyRemaining <= dailyRemaining ? quota.hour_reset_at : quota.day_reset_at
  };
}

/**
 * Retry with exponential backoff
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Update processing checkpoint for resumable operations
 */
export async function updateCheckpoint(
  supabase: any,
  functionName: string,
  lastProcessedId: string | null,
  recordsProcessed: number,
  checkpointData: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase.rpc('update_processing_checkpoint', {
      p_function_name: functionName,
      p_last_processed_id: lastProcessedId,
      p_records_processed: recordsProcessed,
      p_checkpoint_data: checkpointData
    });
  } catch (e) {
    console.error('Failed to update checkpoint:', e);
  }
}
