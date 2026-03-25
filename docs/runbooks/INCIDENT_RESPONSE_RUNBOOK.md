# Incident Response Runbook

## Quick Reference

| Severity | Response Time | Examples |
|----------|---------------|----------|
| **P1 - Critical** | 15 minutes | System down, data breach, auth failure |
| **P2 - High** | 1 hour | Feature broken, email not sending |
| **P3 - Medium** | 4 hours | Performance degraded, minor feature issue |
| **P4 - Low** | 24 hours | UI bug, documentation issue |

---

## 1. Health Check Verification

### Check System Status
```bash
# Check health endpoint
curl https://nuclmzoasgydubdshtab.supabase.co/functions/v1/health-check

# Expected response for healthy system:
# {"status":"healthy","timestamp":"...","version":"1.0.0","checks":{...}}
```

### Interpret Health Status
| Status | HTTP Code | Action |
|--------|-----------|--------|
| `healthy` | 200 | No action needed |
| `degraded` | 200 | Investigate warnings |
| `unhealthy` | 503 | Immediate investigation |

---

## 2. Common Issues & Resolution

### 2.1 Email Not Sending

**Symptoms:**
- User invitations not received
- Password reset emails missing
- Health check shows email status: `warn` or `fail`

**Diagnosis:**
```bash
# Check Edge Function logs in Supabase Dashboard
# Functions > send-user-invitation > Logs

# Verify environment variables
# Settings > Edge Functions > Secrets
# Required: RESEND_API_KEY, SENDER_EMAIL
```

**Resolution:**
1. Verify `RESEND_API_KEY` is set and valid
2. Verify `SENDER_EMAIL` is a verified sender in Resend
3. Check Resend dashboard for delivery status
4. Check spam folders for test emails

### 2.2 Authentication Failures

**Symptoms:**
- Users can't log in
- JWT validation errors in logs
- 401 responses from authenticated endpoints

**Diagnosis:**
```sql
-- Check for account lockouts
SELECT * FROM account_lockouts
WHERE locked_until > now()
ORDER BY created_at DESC LIMIT 10;

-- Check recent failed logins
SELECT email, ip_address, attempted_at, failure_reason
FROM login_attempts
WHERE success = false
ORDER BY attempted_at DESC LIMIT 20;
```

**Resolution:**
1. If account locked: Use admin unlock function
2. If JWT invalid: Check `SUPABASE_JWT_SECRET` configuration
3. If widespread: Check Supabase Auth service status

### 2.3 Database Connection Issues

**Symptoms:**
- Health check shows database: `fail`
- 500 errors from Edge Functions
- Slow response times

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC LIMIT 5;
```

**Resolution:**
1. Check Supabase Dashboard for service status
2. Kill long-running queries if necessary
3. Check connection pool settings
4. Scale up if hitting connection limits

### 2.4 Rate Limiting Triggered

**Symptoms:**
- 429 Too Many Requests responses
- `retry_after_seconds` in error response

**Diagnosis:**
```bash
# Check response headers
curl -I https://[project].supabase.co/functions/v1/send-user-invitation
# Look for rate limit headers
```

**Resolution:**
1. Wait for rate limit window to reset
2. If legitimate traffic: Consider increasing limits
3. If abuse: Block source IP at edge

### 2.5 GDPR Data Export/Deletion Issues

**Symptoms:**
- Export requests stuck in `processing`
- Deletion requests not completing

**Diagnosis:**
```sql
-- Check pending exports
SELECT * FROM data_export_requests
WHERE status IN ('pending', 'processing')
ORDER BY requested_at DESC;

-- Check pending deletions
SELECT * FROM data_deletion_requests
WHERE status IN ('confirmed', 'processing')
ORDER BY scheduled_for ASC;
```

**Resolution:**
1. Check `data-retention-cleanup` function logs
2. Manually trigger cleanup job if needed
3. Check for cascade delete errors

---

## 3. Escalation Procedures

### P1 - Critical Incident
1. Page on-call engineer immediately
2. Create incident channel
3. Begin investigation within 15 minutes
4. Post status update every 30 minutes
5. Conduct post-mortem within 48 hours

### P2 - High Priority
1. Notify engineering team
2. Begin investigation within 1 hour
3. Post status update every 2 hours
4. Document resolution

### P3/P4 - Medium/Low Priority
1. Create ticket in issue tracker
2. Assign to appropriate engineer
3. Resolve within SLA window

---

## 4. Useful Commands

### Edge Function Logs
```bash
# Via Supabase CLI (if configured)
supabase functions logs health-check --project-ref nuclmzoasgydubdshtab
```

### Database Queries

```sql
-- Recent audit logs
SELECT * FROM admin_audit_logs
ORDER BY created_at DESC LIMIT 20;

-- User invitation status
SELECT email, invitation_type, status, created_at
FROM user_invitations
ORDER BY created_at DESC LIMIT 20;

-- Data retention policy status
SELECT table_name, retention_days, last_cleanup_at, records_deleted_last_run
FROM data_retention_policies;
```

### Manual Function Invocation
```bash
# Health check (public)
curl https://nuclmzoasgydubdshtab.supabase.co/functions/v1/health-check

# Trigger data cleanup (requires CRON_SECRET)
curl -X POST https://nuclmzoasgydubdshtab.supabase.co/functions/v1/data-retention-cleanup \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## 5. Contact Information

| Role | Contact |
|------|---------|
| Platform Owner | [Configure in .env] |
| Supabase Support | support@supabase.io |
| Resend Support | support@resend.com |

---

## 6. Post-Incident Checklist

- [ ] Incident resolved and verified
- [ ] Status page updated (if applicable)
- [ ] Affected users notified
- [ ] Root cause identified
- [ ] Prevention measures documented
- [ ] Runbook updated if needed
- [ ] Post-mortem scheduled (P1/P2 only)
