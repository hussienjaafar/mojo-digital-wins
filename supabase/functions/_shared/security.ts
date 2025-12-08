/**
 * Shared security utilities for Edge Functions
 */

/**
 * Get CORS headers with allowed origins from env
 */
export function getCorsHeaders(): Record<string, string> {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  return {
    'Access-Control-Allow-Origin': allowedOrigins[0] || 'https://lovable.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

/**
 * Encrypt sensitive data before storage (simple XOR with key derivation)
 * NOTE: For production, use Supabase Vault or proper encryption
 */
export async function encryptCredentials(data: Record<string, any>, orgId: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);
  
  // Derive key from org ID + secret
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
  
  // Combine IV + encrypted data
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
  
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  // Derive key
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
    'webhook_secret', 'webhook_password'
  ];
  
  const masked: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(credentials)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(f => lowerKey.includes(f));
    
    if (isSensitive && typeof value === 'string' && value.length > 0) {
      // Show only last 4 chars
      masked[key] = value.length > 4 
        ? '••••••••' + value.slice(-4)
        : '••••••••';
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}
