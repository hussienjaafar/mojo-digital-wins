# Security Remediation Agent

**Role:** Security Engineer / Remediation Specialist
**Focus:** Fix security vulnerabilities identified in audit
**Reference:** OWASP Top 10, NIST Secure Development Guidelines

---

## Assigned Issues

| Priority | Issue | File |
|----------|-------|------|
| CRITICAL | Service key bypasses RLS | `get-trends-for-org/index.ts:142-143` |
| HIGH | Cron validation fails open | 5 functions |
| HIGH | Org ID accepted from body | `update-org-affinities/index.ts` |
| MEDIUM | Missing RLS user policy | `trend_filter_log` table |

---

## Task 1: Fix Service Key Bypass (CRITICAL)

### Current Code Pattern
```typescript
// INSECURE: Uses service role for all queries
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

### Secure Pattern
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get user JWT from authorization header
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

// Create user-scoped client that respects RLS
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  }
);

// All queries now respect RLS policies
```

### Implementation Steps
1. Read `supabase/functions/get-trends-for-org/index.ts`
2. Identify where service role client is created
3. Replace with user-scoped client using JWT
4. Verify auth validation still works
5. Test RLS enforcement

### Verification Query
```sql
-- This should fail if RLS is working correctly
-- (when called as user from org A, trying to access org B's data)
SELECT * FROM trend_events
WHERE organization_id = 'different-org-id';
```

---

## Task 2: Replace Fail-Open Cron Validation (HIGH)

### Affected Files
1. `supabase/functions/tag-trend-policy-domains/index.ts`
2. `supabase/functions/tag-trend-geographies/index.ts`
3. `supabase/functions/update-org-affinities/index.ts`
4. `supabase/functions/decay-stale-affinities/index.ts`
5. `supabase/functions/correlate-trends-campaigns/index.ts`

### Current Insecure Pattern
```typescript
// INSECURE: Fails open if CRON_SECRET not set
function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) return true; // VULNERABILITY

  const authHeader = req.headers.get('Authorization');
  return authHeader === `Bearer ${cronSecret}`;
}
```

### Secure Pattern (from _shared/security.ts)
```typescript
// SECURE: Fails closed if CRON_SECRET not set
export function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false; // FAIL CLOSED
  }

  const authHeader = req.headers.get('Authorization');
  return authHeader === `Bearer ${cronSecret}`;
}
```

### Implementation Steps
1. For each affected file:
   - Remove local `validateCronSecret` function
   - Add import: `import { validateCronSecret } from '../_shared/security.ts';`
2. Verify `_shared/security.ts` has the secure implementation
3. Test that functions reject requests when CRON_SECRET is missing

---

## Task 3: Fix Org ID Injection (HIGH)

### Current Insecure Pattern
```typescript
// INSECURE: Accepts org_id from request body
const { org_id } = await req.json();
// Uses org_id directly in queries
```

### Secure Pattern
```typescript
// SECURE: Extract org_id from authenticated user
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: `Bearer ${token}` } } }
);

// Get user from token
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response('Unauthorized', { status: 401 });
}

// Get org_id from user's organization membership
const { data: membership } = await supabase
  .from('organization_members')
  .select('organization_id')
  .eq('user_id', user.id)
  .single();

const org_id = membership?.organization_id;
```

---

## Task 4: Add Missing RLS Policy (MEDIUM)

### Migration SQL
```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_add_filter_log_user_policy.sql

-- Add user SELECT policy for trend_filter_log
CREATE POLICY "Users can view own org filter logs"
ON trend_filter_log FOR SELECT
USING (organization_id IN (
  SELECT id FROM client_organizations
  WHERE user_id = auth.uid()
));
```

---

## Execution Checklist

- [ ] Task 1: Fix service key bypass in get-trends-for-org
- [ ] Task 2: Replace cron validation in all 5 functions
- [ ] Task 3: Fix org_id injection in update-org-affinities
- [ ] Task 4: Create migration for trend_filter_log RLS policy

## Post-Fix Verification

Run Security Audit:
```bash
claude -p "Run audit-agents/05-security-compliance-auditor.md on the News & Trends system"
```

Expected Results:
- 0 CRITICAL security findings
- 0 HIGH security findings
- RLS coverage: 100%
