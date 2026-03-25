# Environment Configuration Guide

## Required Environment Variables

### Core Supabase (Auto-configured)
| Variable | Description | Source |
|----------|-------------|--------|
| `SUPABASE_URL` | Supabase project URL | Auto-injected by Supabase |
| `SUPABASE_ANON_KEY` | Public anonymous key | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) | Auto-injected by Supabase |

### Email Service (Required for user management)
| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key | `re_xxxxxxxxxxxx` |
| `SENDER_EMAIL` | Verified sender email | `noreply@yourdomain.com` |

### Security (Required for scheduled jobs)
| Variable | Description | Notes |
|----------|-------------|-------|
| `CRON_SECRET` | Secret for cron job authentication | Generate with `openssl rand -hex 32` |

### Optional Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `APP_URL` | Application base URL | Derived from SUPABASE_URL |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `CONTACT_FORM_RECIPIENTS` | Comma-separated emails for contact form | None |

---

## Setting Environment Variables

### Via Supabase Dashboard
1. Go to **Settings** > **Edge Functions** > **Secrets**
2. Click **Add new secret**
3. Enter variable name and value
4. Click **Save**

### Via Supabase CLI
```bash
# Set a single secret
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx --project-ref nuclmzoasgydubdshtab

# Set multiple secrets from .env file
supabase secrets set --env-file .env.production --project-ref nuclmzoasgydubdshtab
```

---

## Environment Verification

### Health Check Endpoint
The `/functions/v1/health-check` endpoint verifies configuration:

```bash
curl https://nuclmzoasgydubdshtab.supabase.co/functions/v1/health-check | jq
```

Expected output for properly configured environment:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T...",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "pass", "latency_ms": 45 },
    "email": { "status": "pass" },
    "environment": { "status": "pass" }
  }
}
```

### Common Configuration Issues

| Check Status | Issue | Resolution |
|--------------|-------|------------|
| `environment: fail` | Missing required env vars | Add missing variables in Dashboard |
| `environment: warn` | Missing optional env vars | Add if feature needed |
| `email: warn` | Email not configured | Set RESEND_API_KEY and SENDER_EMAIL |
| `database: fail` | DB connection issue | Check Supabase service status |

---

## Function-Specific Configuration

### User Management Functions
Required for `send-user-invitation`, `reset-admin-password`, `reset-client-password`, `send-admin-invite`:
- `RESEND_API_KEY`
- `SENDER_EMAIL`

### Scheduled Jobs
Required for cron-triggered functions:
- `CRON_SECRET`

Functions using CRON_SECRET:
- `data-retention-cleanup`
- `tiered-meta-sync`
- `run-scheduled-jobs`
- All `fetch-*` functions
- All `calculate-*` functions
- All `detect-*` functions

### GDPR Compliance Functions
Required for `export-user-data`, `request-account-deletion`, `data-retention-cleanup`:
- Standard Supabase variables (auto-configured)
- `SENDER_EMAIL` (for notification emails)

---

## Security Best Practices

### Secret Management
1. **Never commit secrets to git** - Use `.env.local` for development
2. **Rotate secrets periodically** - Especially after team changes
3. **Use separate secrets per environment** - Don't share between staging/production
4. **Audit secret access** - Review who has dashboard access

### API Key Security
1. **Resend API Key**: Create domain-restricted keys when possible
2. **CRON_SECRET**: Use minimum 32 character random string
3. **Service Role Key**: Never expose in client-side code

### Generating Secure Secrets
```bash
# Generate CRON_SECRET
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Troubleshooting

### "Email service not configured"
```bash
# Verify secrets are set
supabase secrets list --project-ref nuclmzoasgydubdshtab

# Should show:
# RESEND_API_KEY
# SENDER_EMAIL
```

### "Unauthorized" on scheduled jobs
Ensure `CRON_SECRET` is set and matches the header sent by your scheduler:
```bash
curl -X POST https://[project].supabase.co/functions/v1/data-retention-cleanup \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Function not finding environment variable
1. Check variable name is exact (case-sensitive)
2. Redeploy function after adding secret
3. Verify in Supabase Dashboard > Edge Functions > Secrets
