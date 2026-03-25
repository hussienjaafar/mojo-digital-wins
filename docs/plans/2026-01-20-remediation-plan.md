# User Management System - Remediation Plan

**Date**: 2026-01-20
**Based on**: Production Readiness Audit (68 findings)
**Target**: Enterprise-grade production readiness with GDPR/CCPA compliance

---

## Phase 1: Emergency Fixes (Week 1)

### 1.1 Fix Email Delivery (CRITICAL - Day 1-2)

**Root Cause**: Environment variable inconsistency + silent failures

**Tasks**:
1. [ ] Standardize environment variable names across all functions
2. [ ] Verify sending domain in Resend dashboard
3. [ ] Set `SENDER_EMAIL` secret in Supabase
4. [ ] Update all email functions to fail loudly on error
5. [ ] Test email delivery end-to-end

**Files to modify**:
- `supabase/functions/reset-admin-password/index.ts`
- `supabase/functions/reset-client-password/index.ts`
- `supabase/functions/send-admin-invite/index.ts`
- `supabase/functions/send-user-invitation/index.ts`
- `supabase/functions/create-client-user/index.ts`

**Implementation**:
```typescript
// Shared utility: supabase/functions/_shared/email.ts
export function getEmailConfig() {
  const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  if (!SENDER_EMAIL) {
    throw new Error('SENDER_EMAIL environment variable not configured');
  }
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable not configured');
  }

  return { SENDER_EMAIL, RESEND_API_KEY };
}

export async function sendEmail(config: EmailConfig): Promise<EmailResult> {
  const { RESEND_API_KEY, SENDER_EMAIL } = getEmailConfig();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${config.fromName} <${SENDER_EMAIL}>`,
      to: config.to,
      subject: config.subject,
      html: config.html
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Email send failed:', errorText);
    throw new Error(`Email delivery failed: ${response.status}`);
  }

  return { success: true, messageId: (await response.json()).id };
}
```

### 1.2 Fix Silent Failure Responses (CRITICAL - Day 2-3)

**Change all email functions to return proper error responses**:

```typescript
// BEFORE (wrong):
if (emailError) {
  console.error("Error:", emailError);
  return new Response(
    JSON.stringify({ success: true, email_sent: false }),
    { status: 200 }
  );
}

// AFTER (correct):
if (emailError) {
  console.error("Error:", emailError);
  return new Response(
    JSON.stringify({
      success: false,
      error: "Email delivery failed",
      error_code: "EMAIL_SEND_FAILED"
    }),
    { status: 502, headers: corsHeaders }
  );
}
```

### 1.3 Restrict CORS (CRITICAL - Day 3)

**Create shared CORS utility**:
```typescript
// supabase/functions/_shared/cors.ts
export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',');
  const origin = req.headers.get('origin') || '';

  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || 'https://mojo-digital-wins.lovable.app';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}
```

### 1.4 Enable JWT Verification (HIGH - Day 4)

**Update `supabase/config.toml`** for sensitive functions:
```toml
[functions.reset-admin-password]
verify_jwt = true

[functions.reset-client-password]
verify_jwt = true

[functions.send-admin-invite]
verify_jwt = true

[functions.send-user-invitation]
verify_jwt = true

[functions.terminate-user-sessions]
verify_jwt = true

[functions.unlock-account]
verify_jwt = true
```

### 1.5 Add Error Tracking (HIGH - Day 5)

**Install Sentry for Edge Functions**:
```typescript
// supabase/functions/_shared/sentry.ts
import * as Sentry from 'https://deno.land/x/sentry/index.mjs';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('ENVIRONMENT') || 'production',
});

export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}
```

---

## Phase 2: Security Hardening (Weeks 2-3)

### 2.1 Rate Limiting

**Create rate limiter utility**:
```typescript
// supabase/functions/_shared/rate-limit.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}
```

### 2.2 Fix Race Condition in Invite Codes

**Update SQL function**:
```sql
-- Use SELECT FOR UPDATE to prevent race conditions
CREATE OR REPLACE FUNCTION verify_admin_invite_code(invite_code TEXT, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- Lock the row during transaction
  SELECT * INTO code_record
  FROM admin_invite_codes
  WHERE code = invite_code
    AND is_active = true
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Atomically mark as used
  UPDATE admin_invite_codes
  SET used_at = now(), used_by = user_id
  WHERE id = code_record.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Input Validation with Zod

**Create validation schemas**:
```typescript
// supabase/functions/_shared/validation.ts
import { z } from 'https://deno.land/x/zod/mod.ts';

export const emailSchema = z.string()
  .email()
  .max(255)
  .transform(s => s.toLowerCase().trim().replace(/[\r\n]/g, ''));

export const uuidSchema = z.string().uuid();

export const resetPasswordSchema = z.object({
  user_id: uuidSchema,
});

export const inviteUserSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'manager', 'viewer']),
  organization_id: uuidSchema.optional(),
});
```

### 2.4 Remove Hardcoded Credentials

**Files to update**:
- `supabase/functions/reset-client-password/index.ts:5` - Remove `hussein@ryzeup.io`
- `supabase/functions/send-admin-invite/index.ts:269` - Remove `onboarding@resend.dev`

---

## Phase 3: GDPR/CCPA Compliance (Weeks 4-6)

### 3.1 User Data Export API

**Create new edge function**:
```typescript
// supabase/functions/export-user-data/index.ts
serve(async (req) => {
  const user = await getAuthenticatedUser(req);

  // Gather all user data
  const [profile, auditLogs, consents, organizations] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('admin_audit_logs').select('*').eq('user_id', user.id),
    supabase.from('consent_records').select('*').eq('user_id', user.id),
    supabase.from('client_users').select('*, client_organizations(*)').eq('id', user.id),
  ]);

  const exportData = {
    export_date: new Date().toISOString(),
    user_id: user.id,
    profile: profile.data,
    activity_logs: auditLogs.data,
    consents: consents.data,
    organizations: organizations.data,
  };

  // Log the export request
  await supabase.from('data_export_requests').insert({
    user_id: user.id,
    requested_at: new Date().toISOString(),
    format: 'json',
  });

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### 3.2 Account Deletion

**Create deletion request system**:
```sql
-- Migration: add_data_deletion_requests
CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  scheduled_for TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  retained_for_legal TEXT[], -- e.g., ['fec_donor_records']
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
ON data_deletion_requests FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own requests"
ON data_deletion_requests FOR INSERT
WITH CHECK (user_id = auth.uid());
```

### 3.3 Consent Management

**Create consent tracking**:
```sql
-- Migration: add_consent_records
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  consent_type TEXT NOT NULL CHECK (consent_type IN ('marketing', 'analytics', 'data_processing', 'political_use')),
  policy_version TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN GENERATED ALWAYS AS (withdrawn_at IS NULL) STORED
);

CREATE INDEX idx_consent_user ON consent_records(user_id);
CREATE INDEX idx_consent_active ON consent_records(user_id, consent_type) WHERE is_active;
```

### 3.4 Data Retention Policies

**Create cleanup job**:
```typescript
// supabase/functions/data-retention-cleanup/index.ts
serve(async () => {
  const now = new Date();

  // Delete login history older than 1 year
  await supabase.from('login_history')
    .delete()
    .lt('created_at', new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString());

  // Delete audit logs older than 3 years
  await supabase.from('admin_audit_logs')
    .delete()
    .lt('created_at', new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString());

  // Delete contact submissions older than 2 years
  await supabase.from('contact_submissions')
    .delete()
    .lt('created_at', new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString());

  return new Response(JSON.stringify({ success: true }));
});
```

---

## Phase 4: Quality & Reliability (Weeks 7-8)

### 4.1 Edge Function Tests

**Create test suite**:
```typescript
// supabase/functions/__tests__/reset-admin-password.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std/testing/asserts.ts';

Deno.test('reset-admin-password: requires authentication', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/reset-admin-password', {
    method: 'POST',
    body: JSON.stringify({ user_id: 'test-uuid' }),
  });

  assertEquals(response.status, 401);
});

Deno.test('reset-admin-password: requires admin role', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/reset-admin-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${NON_ADMIN_TOKEN}` },
    body: JSON.stringify({ user_id: 'test-uuid' }),
  });

  assertEquals(response.status, 403);
});

Deno.test('reset-admin-password: fails gracefully when email fails', async () => {
  // Mock Resend to fail
  const response = await fetch('http://localhost:54321/functions/v1/reset-admin-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ user_id: TARGET_USER_ID }),
  });

  assertEquals(response.status, 502);
  const body = await response.json();
  assertEquals(body.success, false);
});
```

### 4.2 Structured Logging

**Create logging utility**:
```typescript
// supabase/functions/_shared/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  correlationId?: string;
  userId?: string;
  [key: string]: unknown;
}

export function createLogger(correlationId?: string) {
  return {
    info: (event: string, data?: Record<string, unknown>) =>
      log('info', event, { ...data, correlationId }),
    warn: (event: string, data?: Record<string, unknown>) =>
      log('warn', event, { ...data, correlationId }),
    error: (event: string, error: Error, data?: Record<string, unknown>) =>
      log('error', event, { ...data, correlationId, error: serializeError(error) }),
  };
}

function log(level: LogLevel, event: string, data: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  console[level](JSON.stringify(entry));
}
```

### 4.3 Health Check Endpoint

```typescript
// supabase/functions/health/index.ts
serve(async () => {
  const checks = await Promise.allSettled([
    // Database connectivity
    supabase.from('profiles').select('count').limit(1),
    // Resend API key valid
    fetch('https://api.resend.com/api-keys', {
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}` }
    }),
  ]);

  const results = {
    database: checks[0].status === 'fulfilled',
    resend: checks[1].status === 'fulfilled' && (checks[1].value as Response).ok,
    env_vars: {
      SENDER_EMAIL: !!Deno.env.get('SENDER_EMAIL'),
      RESEND_API_KEY: !!Deno.env.get('RESEND_API_KEY'),
      ALLOWED_ORIGINS: !!Deno.env.get('ALLOWED_ORIGINS'),
    }
  };

  const healthy = results.database && results.resend &&
    Object.values(results.env_vars).every(Boolean);

  return new Response(JSON.stringify(results), {
    status: healthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## Phase 5: DevOps & DR (Weeks 9-12)

### 5.1 Staging Environment

1. Create separate Supabase project for staging
2. Set up environment-specific CI/CD workflows
3. Configure staging secrets separately
4. Add approval gate for production deployments

### 5.2 Backup Strategy

1. Enable Supabase automated backups (daily)
2. Document point-in-time recovery procedure
3. Test backup restoration monthly
4. Set up read replica for high availability

### 5.3 Incident Response Plan

**Create runbook**: `docs/runbooks/incident-response.md`
- Severity classification (P1-P4)
- On-call rotation schedule
- Escalation procedures
- Communication templates
- Post-mortem template

### 5.4 SLA Monitoring

1. Set up uptime monitoring (Pingdom/Better Uptime)
2. Define SLOs:
   - Availability: 99.9%
   - API latency: p95 < 500ms
   - Email delivery: 99% success rate
3. Create alerting at 70% of SLA threshold
4. Set up status page (Statuspage.io)

---

## Implementation Order & Dependencies

```
Week 1:
├── 1.1 Fix email env vars ──────────────┐
├── 1.2 Fix silent failures ─────────────┼── Can be parallelized
├── 1.3 Restrict CORS ───────────────────┤
├── 1.4 Enable JWT verification ─────────┘
└── 1.5 Add error tracking

Week 2-3:
├── 2.1 Rate limiting
├── 2.2 Fix race condition (depends on 1.x)
├── 2.3 Input validation
└── 2.4 Remove hardcoded creds

Week 4-6:
├── 3.1 Data export API (depends on 2.x)
├── 3.2 Account deletion
├── 3.3 Consent management
└── 3.4 Retention policies

Week 7-8:
├── 4.1 Edge function tests (can start in parallel)
├── 4.2 Structured logging
└── 4.3 Health checks

Week 9-12:
├── 5.1 Staging environment
├── 5.2 Backup strategy
├── 5.3 Incident response
└── 5.4 SLA monitoring
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All password reset emails delivered successfully
- [ ] All invitation emails delivered successfully
- [ ] Email failures return HTTP 5xx, not 200
- [ ] CORS restricted to allowed origins
- [ ] Errors appearing in Sentry

### Phase 2 Complete When:
- [ ] Rate limiting blocks brute force attempts
- [ ] Invite codes cannot be reused via race condition
- [ ] All inputs validated with Zod
- [ ] No hardcoded credentials in codebase

### Phase 3 Complete When:
- [ ] Users can export their data in JSON format
- [ ] Users can request account deletion
- [ ] Consent tracked for all processing activities
- [ ] Old data automatically purged per retention policy

### Phase 4 Complete When:
- [ ] 80%+ test coverage on edge functions
- [ ] All logs in structured JSON format
- [ ] Health endpoint validates deployment
- [ ] Monitoring dashboards operational

### Phase 5 Complete When:
- [ ] Staging environment functional
- [ ] Backup restoration tested
- [ ] Incident response plan documented
- [ ] 99.9% uptime achieved for 30 days
