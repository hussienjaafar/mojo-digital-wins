# Phase 2 Implementation Plan

**Created:** 2026-01-19
**Status:** ✅ COMPLETED
**Prerequisite:** Phase 1 remediation completed and deployed

## Execution Summary

| Task | Status | Notes |
|------|--------|-------|
| Fix 5 legacy cron validation | ✅ Complete | refresh-meta-tokens, match-entity-watchlist, track-event-impact, compute-org-relevance, generate-embeddings |
| Add unique constraint | ✅ Complete | Migration created |
| Add GIN indexes | ✅ Complete | Migration created |
| Add FK constraints | ✅ Complete | Migration created |
| Expand keywords to 50+ | ✅ Already Complete | All 12 domains have 59-72 keywords |
| Regenerate TypeScript types | ⏭️ N/A | Project uses manual types, not auto-generated |

---

## Summary

This plan addresses remaining items from the post-Phase 1 audit:
- **6 HIGH** issues in legacy functions (fail-open cron validation)
- **4 MEDIUM** schema issues (constraints, indexes)
- **1 MEDIUM** content issue (3 domains need 3+ keywords)
- **1 LOW** issue (regenerate TypeScript types)

---

## Task Assignment to Agents

| Task | Agent | Priority | Estimated Complexity |
|------|-------|----------|---------------------|
| Fix 6 legacy cron validation | 10-security-remediator.md | HIGH | Low |
| Add unique constraint | 13-schema-migrator.md | MEDIUM | Low |
| Add GIN indexes on arrays | 13-schema-migrator.md | MEDIUM | Low |
| Add FK constraints | 13-schema-migrator.md | MEDIUM | Low |
| Expand 3 domains to 50+ | 11-content-enhancer.md | MEDIUM | Low |
| Regenerate TypeScript types | N/A (direct execution) | LOW | Trivial |

---

## Phase 2A: Security Fixes (HIGH)

### Issue: 6 Legacy Functions with Fail-Open Cron Validation

**Agent:** 10-security-remediator.md

**Affected Files:**
1. `supabase/functions/refresh-meta-tokens/index.ts` (line 24)
2. `supabase/functions/match-entity-watchlist/index.ts` (line 13)
3. `supabase/functions/track-event-impact/index.ts` (line 13)
4. `supabase/functions/compute-org-relevance/index.ts` (line 13)
5. `supabase/functions/generate-embeddings/index.ts` (line 21)
6. `supabase/functions/send-notification-email/index.ts` (line 24)

**Current Pattern (INSECURE):**
```typescript
function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured - allowing request');
    return true;  // FAIL OPEN - Security vulnerability!
  }
  const providedSecret = req.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}
```

**Fix Pattern:**
1. Remove local `validateCronSecret` function
2. Add import: `import { validateCronSecret } from "../_shared/security.ts";`

**Verification:**
- Check that `_shared/security.ts` has fail-closed implementation
- Test that functions reject requests when CRON_SECRET is missing

---

## Phase 2B: Schema Improvements (MEDIUM)

### Issue 1: Missing Unique Constraint

**Agent:** 13-schema-migrator.md

**Table:** `trend_campaign_correlations`
**Constraint:** Unique on `(trend_event_id, campaign_id)`

```sql
ALTER TABLE trend_campaign_correlations
ADD CONSTRAINT unique_trend_campaign_correlation
UNIQUE (trend_event_id, campaign_id);
```

### Issue 2: Missing GIN Indexes on Array Columns

**Tables:** `trend_events`, `campaign_topic_extractions`

```sql
-- For trend_events array columns
CREATE INDEX IF NOT EXISTS idx_trend_events_politicians_gin
ON trend_events USING GIN (politicians_mentioned);

CREATE INDEX IF NOT EXISTS idx_trend_events_organizations_gin
ON trend_events USING GIN (organizations_mentioned);

CREATE INDEX IF NOT EXISTS idx_trend_events_legislation_gin
ON trend_events USING GIN (legislation_mentioned);

-- For campaign_topic_extractions array columns
CREATE INDEX IF NOT EXISTS idx_campaign_extractions_domains_gin
ON campaign_topic_extractions USING GIN (policy_domains);

CREATE INDEX IF NOT EXISTS idx_campaign_extractions_topics_gin
ON campaign_topic_extractions USING GIN (topics);

CREATE INDEX IF NOT EXISTS idx_campaign_extractions_entities_gin
ON campaign_topic_extractions USING GIN (entities);
```

### Issue 3: Missing FK Constraints

**Table:** `campaign_analytics`

```sql
-- Add FK constraint to client_organizations
ALTER TABLE campaign_analytics
ADD CONSTRAINT fk_campaign_analytics_org
FOREIGN KEY (organization_id)
REFERENCES client_organizations(id)
ON DELETE CASCADE;
```

---

## Phase 2C: Content Expansion (MEDIUM)

### Issue: 3 Domains Below 50 Keywords

**Agent:** 11-content-enhancer.md

After counting keywords in `policyDomainKeywords.ts`:

| Domain | Current Count | Keywords Needed |
|--------|--------------|-----------------|
| Healthcare | 47 | +3 |
| Environment | 47 | +3 |
| Civil Rights | 47 | +3 |

**Keywords to Add:**

```typescript
// Healthcare (+3)
'medical bankruptcy', 'hospital merger', 'healthcare workforce'

// Environment (+3)
'climate adaptation', 'environmental review', 'clean energy standard'

// Civil Rights (+3)
'voting access', 'jury trial', 'constitutional rights'
```

---

## Phase 2D: TypeScript Types (LOW)

**Command:** Run `npx supabase gen types typescript --local > src/types/supabase.ts`

---

## Execution Order

1. **Phase 2A (Security)** - Fix legacy cron validation (HIGH)
2. **Phase 2B (Schema)** - Add constraints and indexes (MEDIUM)
3. **Phase 2C (Content)** - Expand keywords (MEDIUM)
4. **Phase 2D (Types)** - Regenerate types (LOW)
5. **Commit and Push**
6. **Deploy via Lovable**
7. **Re-run Audit** to verify fixes

---

## Verification Checklist

After deployment:
- [ ] All 6 legacy functions reject requests without CRON_SECRET
- [ ] Unique constraint prevents duplicate correlations
- [ ] GIN indexes speed up array queries
- [ ] FK constraint enforces data integrity
- [ ] All 12 domains have 50+ keywords
- [ ] TypeScript types are up to date
