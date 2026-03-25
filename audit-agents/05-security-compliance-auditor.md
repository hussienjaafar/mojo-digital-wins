# Security & Compliance Auditor

**Role:** Security Analyst / Compliance Officer
**Audit Type:** Security & Data Protection
**Reference:** [OWASP Top 10](https://owasp.org/www-project-top-ten/), [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security), [SOC 2 Type II Controls](https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2)

## Audit Objectives

1. Verify Row-Level Security (RLS) policies are correctly implemented
2. Check for data leakage vulnerabilities
3. Validate authentication and authorization mechanisms
4. Ensure privacy compliance (data minimization, retention)
5. Detect potential injection or XSS vulnerabilities
6. Verify audit logging and traceability

## Audit Checklist

### 1. Row-Level Security (RLS) Policy Audit

**Files to Examine:**
- `supabase/migrations/20260119034328_news_trends_overhaul.sql`
- All migration files with RLS policies

**Tables Requiring RLS:**
| Table | RLS Required | Policy Type |
|-------|--------------|-------------|
| `org_topic_affinities` | YES | Org-scoped |
| `org_trend_relevance_cache` | YES | Org-scoped |
| `campaign_topic_extractions` | YES | Org-scoped |
| `trend_campaign_correlations` | YES | Org-scoped |
| `trend_filter_log` | YES | Org-scoped |
| `trend_events` | DEPENDS | Public read, admin write |
| `rss_sources` | DEPENDS | Public read, admin write |
| `political_entities` | NO | Reference data |
| `policy_domain_keywords` | NO | Reference data |

**RLS Verification Queries:**
```sql
-- Check which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'org_topic_affinities',
    'org_trend_relevance_cache',
    'campaign_topic_extractions',
    'trend_campaign_correlations',
    'trend_filter_log',
    'trend_events',
    'rss_sources'
  );

-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Checks:**
- [ ] RLS is ENABLED on all org-scoped tables
- [ ] SELECT policies filter by organization_id
- [ ] INSERT policies verify organization_id matches auth
- [ ] UPDATE policies prevent organization_id modification
- [ ] DELETE policies are org-scoped
- [ ] Service role bypasses are intentional and documented

### 2. Data Leakage Prevention

**Checks:**
- [ ] No cross-organization data exposure in queries
- [ ] API responses don't include other orgs' data
- [ ] Aggregations don't leak individual org data
- [ ] Error messages don't expose sensitive info
- [ ] Logs don't contain PII or organization secrets

**Cross-Org Leakage Test:**
```sql
-- As org A, attempt to read org B's data (should return 0)
-- This requires setting auth context properly
SET request.jwt.claim.organization_id = 'org-a-uuid';

SELECT COUNT(*) as leak_test
FROM org_topic_affinities
WHERE organization_id = 'org-b-uuid';
-- Expected: 0 (RLS should block)

-- Check relevance cache isolation
SELECT COUNT(*) as leak_test
FROM org_trend_relevance_cache
WHERE organization_id = 'org-b-uuid';
-- Expected: 0
```

**API Response Audit:**
```typescript
// In get-trends-for-org/index.ts, verify:
// 1. organization_id comes from authenticated context
// 2. No org_id parameter allows override
// 3. Response is filtered before returning

// BAD: Accepting org_id from request body
const { organization_id } = await req.json(); // VULNERABLE!

// GOOD: Getting org_id from authenticated user
const { data: { user } } = await supabase.auth.getUser();
const organization_id = user?.user_metadata?.organization_id;
```

### 3. Authentication & Authorization

**Files to Examine:**
- All Edge Functions in `supabase/functions/*/index.ts`
- Authentication middleware

**Checks:**
- [ ] All Edge Functions verify authentication
- [ ] Service role key is only used where necessary
- [ ] API keys are not hardcoded
- [ ] JWT tokens are validated
- [ ] Session expiry is enforced
- [ ] CORS is properly configured

**Authentication Pattern Check:**
```typescript
// Every public-facing function should have:
serve(async (req) => {
  // 1. CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 2. Auth verification
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 3. User validation
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401
    });
  }

  // Continue with org_id from user context...
});
```

**Audit Each Function:**
| Function | Auth Required | Service Key | Status |
|----------|--------------|-------------|--------|
| `get-trends-for-org` | YES | NO | [ ] Verify |
| `update-org-affinities` | YES | NO | [ ] Verify |
| `tag-trend-policy-domains` | NO (cron) | YES | [ ] Verify |
| `tag-trend-geographies` | NO (cron) | YES | [ ] Verify |
| `extract-trend-entities` | NO (cron) | YES | [ ] Verify |
| `decay-stale-affinities` | NO (cron) | YES | [ ] Verify |
| `correlate-trends-campaigns` | NO (cron) | YES | [ ] Verify |

### 4. Injection Vulnerability Check

**Checks:**
- [ ] No raw SQL string concatenation
- [ ] Parameterized queries used throughout
- [ ] User input is sanitized before use
- [ ] No eval() or dynamic code execution
- [ ] JSON parsing handles malformed input

**Code Pattern Search:**
```bash
# Search for potential SQL injection
grep -r "sql\`.*\${" supabase/functions/
grep -r '+ .*query' supabase/functions/

# Search for potential command injection
grep -r 'exec(' supabase/functions/
grep -r 'eval(' supabase/functions/

# Search for dangerous string interpolation in queries
grep -r "\.from\(.*\`" supabase/functions/
```

**Safe vs Unsafe Patterns:**
```typescript
// UNSAFE: String interpolation in SQL
const query = `SELECT * FROM trends WHERE id = '${userInput}'`;

// SAFE: Parameterized query
const { data } = await supabase
  .from('trends')
  .select('*')
  .eq('id', userInput);

// UNSAFE: Dynamic table name
const table = req.query.table;
supabase.from(table).select(); // Allows access to any table!

// SAFE: Whitelist table names
const ALLOWED_TABLES = ['trend_events', 'rss_sources'];
if (!ALLOWED_TABLES.includes(table)) throw new Error('Invalid table');
```

### 5. Data Retention & Privacy

**Checks:**
- [ ] Data retention policies are documented
- [ ] Old data is automatically purged
- [ ] PII is minimized in stored data
- [ ] Logs don't contain sensitive data
- [ ] Export/deletion mechanisms exist (GDPR compliance)

**Retention Policy Verification:**
```sql
-- Check if cleanup jobs exist
SELECT job_name, function_name, schedule
FROM scheduled_jobs
WHERE function_name LIKE '%cleanup%'
   OR function_name LIKE '%purge%'
   OR function_name LIKE '%delete%';

-- Check for old data that should be purged
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as count
FROM trend_events
GROUP BY month
ORDER BY month;

-- Trend filter log should have 30-day retention
SELECT
  MIN(logged_at) as oldest_log,
  MAX(logged_at) as newest_log,
  NOW() - MIN(logged_at) as log_age
FROM trend_filter_log;
```

**Expected:**
- Trend filter logs: 30 days max
- Trend events: Policy-defined (e.g., 90 days)
- Affinities: Decay removes unused ones

### 6. Audit Trail & Logging

**Checks:**
- [ ] Security-relevant actions are logged
- [ ] Logs include timestamp, user, action, resource
- [ ] Log tampering is prevented
- [ ] Logs are retained appropriately
- [ ] No sensitive data in logs

**Actions That Should Be Logged:**
- Authentication attempts (success/failure)
- Organization data access
- Affinity updates
- Filter log entries
- Administrative actions

**Log Review:**
```sql
-- Check trend_filter_log for audit purposes
SELECT
  logged_at,
  organization_id,
  filter_reason,
  relevance_score
FROM trend_filter_log
ORDER BY logged_at DESC
LIMIT 100;

-- Verify log entries have all required fields
SELECT
  COUNT(*) FILTER (WHERE organization_id IS NULL) as missing_org,
  COUNT(*) FILTER (WHERE filter_reason IS NULL) as missing_reason,
  COUNT(*) FILTER (WHERE logged_at IS NULL) as missing_timestamp
FROM trend_filter_log;
```

### 7. Service Key Usage Audit

**Critical:** Service keys bypass RLS

**Checks:**
- [ ] Service key usage is limited to admin/cron functions
- [ ] Service key is never exposed to client
- [ ] Service key operations are audited
- [ ] Environment variables are properly secured

**Service Key Usage Search:**
```bash
# Find all service key usage
grep -r "SUPABASE_SERVICE_ROLE_KEY" supabase/functions/
grep -r "service_role" supabase/functions/

# Ensure service key isn't in client-side code
grep -r "service_role" src/
```

### 8. Rate Limiting & DoS Prevention

**Checks:**
- [ ] API endpoints have rate limiting
- [ ] Batch operations have size limits
- [ ] Expensive queries have timeouts
- [ ] Pagination is enforced

**Configuration Review:**
```typescript
// Check for batch size limits
const BATCH_SIZE = 100; // Should be defined
if (items.length > BATCH_SIZE) {
  throw new Error('Batch size exceeded');
}

// Check for query limits
const { data } = await supabase
  .from('trend_events')
  .select()
  .limit(50); // Always use limits

// Check for timeouts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);
```

## Findings Template

### Finding: [TITLE]
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
**Category:** RLS Gap | Auth Bypass | Injection | Data Leak | Compliance
**File:** `path/to/file.ts:line`
**CWE/OWASP:** [Reference if applicable]

**Description:**
[What vulnerability was found]

**Proof of Concept:**
[Steps to reproduce or code sample]

**Impact:**
[What an attacker could do, what data is at risk]

**Recommendation:**
[Specific fix]

**Effort:** Low | Medium | High

---

## Red Flags to Watch For

1. **RLS disabled on org-scoped tables** - CRITICAL data exposure risk
2. **Service key in client code** - CRITICAL authentication bypass
3. **SQL string concatenation** - HIGH injection risk
4. **Missing auth check in Edge Function** - HIGH unauthorized access
5. **Cross-org data in API response** - HIGH privacy violation
6. **No rate limiting** - MEDIUM DoS vulnerability
7. **Logs contain PII** - MEDIUM compliance risk
8. **No data retention policy** - LOW compliance gap

## Compliance Checklist

### SOC 2 Relevant Controls
- [ ] Access controls enforce least privilege
- [ ] Authentication mechanisms are secure
- [ ] Data is encrypted at rest and in transit
- [ ] Audit logs are maintained
- [ ] Change management is documented

### GDPR Relevant Checks
- [ ] Data minimization principle applied
- [ ] Retention periods defined and enforced
- [ ] Right to deletion can be exercised
- [ ] Processing is documented
- [ ] Cross-border transfers are compliant

### CCPA Relevant Checks
- [ ] Personal information is cataloged
- [ ] Opt-out mechanisms exist
- [ ] Data sale disclosures (if applicable)
- [ ] Consumer rights can be exercised

## Audit Execution Instructions

1. Run RLS verification queries
2. Review all Edge Functions for auth patterns
3. Search codebase for injection patterns
4. Test cross-organization data isolation
5. Verify service key usage is limited
6. Check data retention compliance
7. Review audit logging completeness
8. Test rate limiting and DoS protections
9. Document all findings with severity ratings
10. Prioritize remediation by risk level
