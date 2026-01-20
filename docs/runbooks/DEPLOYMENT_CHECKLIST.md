# Deployment Checklist

## Pre-Deployment

### Code Review
- [ ] All changes reviewed and approved
- [ ] No hardcoded credentials or secrets
- [ ] No console.log statements with sensitive data
- [ ] Error handling covers edge cases
- [ ] Input validation in place

### Testing
- [ ] Unit tests pass locally
  ```bash
  deno test --allow-env supabase/functions/_shared/validators.test.ts
  ```
- [ ] Manual testing of affected features
- [ ] Test with realistic data volumes

### Database Migrations
- [ ] Migration file syntax validated
- [ ] Rollback plan documented
- [ ] Backup taken before destructive changes
- [ ] RLS policies reviewed for new tables

---

## Deployment Steps

### 1. Push to GitHub
```bash
git push origin [branch-name]
```

### 2. Trigger Lovable Deployment
Provide Lovable with:
- Branch name and commit hash
- List of Edge Functions to deploy
- Migration files (if any)
- Required environment variables (if new)

### 3. Verify Deployment

#### Health Check
```bash
curl https://nuclmzoasgydubdshtab.supabase.co/functions/v1/health-check | jq '.status'
# Expected: "healthy"
```

#### Function Logs
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Select deployed function
4. Check Logs tab for errors

#### Database Migration
```sql
-- Verify new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

---

## Post-Deployment

### Smoke Tests
- [ ] Health check returns `healthy`
- [ ] User can log in
- [ ] User invitation sends email
- [ ] Password reset sends email
- [ ] GDPR export generates file
- [ ] Scheduled jobs run (check logs)

### Monitoring
- [ ] Check error rates in logs
- [ ] Verify response times are acceptable
- [ ] Monitor for rate limiting issues

### Documentation
- [ ] Update changelog if needed
- [ ] Document any new environment variables
- [ ] Update runbooks if procedures changed

---

## Rollback Procedures

### Edge Function Rollback
1. Identify the last working commit
2. Create rollback branch:
   ```bash
   git checkout -b rollback/[function-name] [last-good-commit]
   git push origin rollback/[function-name]
   ```
3. Deploy via Lovable with rollback branch

### Database Migration Rollback
1. Create reverse migration file
2. Test in staging first
3. Deploy with explicit rollback steps

### Emergency Rollback
If system is down:
1. Disable affected Edge Function in Supabase Dashboard
2. Investigate in parallel
3. Deploy fix or rollback
4. Re-enable function

---

## Deployment Schedule

### Recommended Windows
- **Best**: Tuesday-Thursday, 10am-2pm (local time)
- **Avoid**: Friday afternoon, weekends, holidays
- **Never**: During high-traffic periods

### Notification
For significant deployments:
1. Notify team 24 hours in advance
2. Post in deployment channel when starting
3. Confirm completion with health check results

---

## Checklist Templates

### Standard Deployment
```
- [ ] Code reviewed
- [ ] Tests pass
- [ ] Pushed to GitHub
- [ ] Deployed via Lovable
- [ ] Health check passes
- [ ] Smoke tests pass
```

### Database Migration Deployment
```
- [ ] Code reviewed
- [ ] Migration tested locally
- [ ] Backup confirmed
- [ ] Rollback plan ready
- [ ] Pushed to GitHub
- [ ] Deployed via Lovable
- [ ] Migration verified
- [ ] Health check passes
- [ ] Smoke tests pass
```

### Security-Sensitive Deployment
```
- [ ] Security review completed
- [ ] No new vulnerabilities introduced
- [ ] Secrets rotated (if needed)
- [ ] RLS policies verified
- [ ] Standard deployment checklist
- [ ] Security smoke tests pass
```
