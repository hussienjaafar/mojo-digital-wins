# Invitation System Implementation Plan

**Date:** January 22, 2026
**Scope:** Phases 1-3 (Critical Bugs + Security + Enhanced Model)
**Deployment:** Hybrid (Direct commits for frontend, Lovable for edge functions/migrations)
**Constraints:** Limited beta users - avoid breaking changes, maintain test coverage

---

## Implementation Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PARALLEL AGENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │   Agent 1   │  │   Agent 2   │  │   Agent 3   │  │   Agent 4   │   │
│   │   Session   │  │  Password   │  │   Token     │  │   Multi-Org │   │
│   │    Fixer    │  │  Confirm    │  │  Security   │  │    Model    │   │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│          │                │                │                │          │
│          ▼                ▼                ▼                ▼          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │   Agent 5   │  │   Agent 6   │  │   Agent 7   │  │   Agent 8   │   │
│   │ Permissions │  │   Session   │  │    Test     │  │   Review    │   │
│   │    Model    │  │  Management │  │   Writer    │  │    Agent    │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Specifications

### Agent 1: Session Race Condition Fixer

**Domain:** Authentication Flow
**Priority:** CRITICAL
**Files to Modify:**
- `src/pages/ClientLogin.tsx`
- `src/pages/AcceptInvitation.tsx`
- `src/components/client/ClientShell.tsx`

**Tasks:**
1. Fix `ClientLogin.tsx` to wait for session confirmation before redirect
2. Fix `AcceptInvitation.tsx` to confirm session before triggering redirect
3. Fix `ClientShell.tsx` to add retry logic for session checks
4. Add loading states during auth transitions
5. Write/update tests for login flow

**Success Criteria:**
- [ ] User can sign up via invitation and land on dashboard
- [ ] User can log in and land on dashboard
- [ ] No redirect loops
- [ ] Tests pass

---

### Agent 2: Password Confirmation Implementer

**Domain:** Form Validation
**Priority:** HIGH
**Files to Modify:**
- `src/pages/AcceptInvitation.tsx`
- `supabase/functions/accept-invitation-signup/index.ts` (Lovable prompt)

**Tasks:**
1. Add confirm password field to AcceptInvitation form
2. Add client-side validation (passwords match)
3. Update edge function to validate confirmation
4. Add proper error messages
5. Write tests for password validation

**Success Criteria:**
- [ ] Confirm password field present
- [ ] Mismatch shows clear error
- [ ] Cannot submit with mismatched passwords
- [ ] Tests pass

---

### Agent 3: Token Security Hardener

**Domain:** Security
**Priority:** HIGH
**Files to Modify:**
- `supabase/functions/send-user-invitation/index.ts` (Lovable prompt)
- `supabase/functions/accept-invitation-signup/index.ts` (Lovable prompt)
- Database migration for token changes (Lovable prompt)

**Tasks:**
1. Reduce token expiry from 7 days to 48 hours
2. Implement single-use tokens (mark as used on acceptance)
3. Add rate limiting for invitation acceptance (5 attempts per token)
4. Add device/IP logging for security audit
5. Generate Lovable prompts for all changes

**Success Criteria:**
- [ ] Tokens expire in 48 hours
- [ ] Tokens cannot be reused after acceptance
- [ ] Rate limiting prevents brute force
- [ ] Audit trail for acceptance attempts

---

### Agent 4: Multi-Organization Model Designer

**Domain:** Data Architecture
**Priority:** MEDIUM
**Files to Create/Modify:**
- New migration: `organization_memberships` table
- Update: `client_users` → becomes transitional
- Update: RLS policies for multi-org
- Lovable prompts for all migrations

**Tasks:**
1. Design `organization_memberships` table schema
2. Create migration with backwards compatibility
3. Update RLS policies for multi-org access
4. Create helper functions for org context
5. Plan data migration from `client_users`

**Success Criteria:**
- [ ] Schema supports multiple org membership
- [ ] Existing users unaffected (backwards compatible)
- [ ] RLS policies enforce org isolation
- [ ] Migration plan documented

---

### Agent 5: Permissions Model Implementer

**Domain:** Authorization
**Priority:** MEDIUM
**Files to Create/Modify:**
- New migration: `permissions`, `role_permissions` tables
- New shared utility: `permissionChecker.ts`
- Update: RLS policies to use permissions
- Lovable prompts for migrations

**Tasks:**
1. Design permissions schema (resource + action based)
2. Create default permission sets for existing roles
3. Implement permission checking functions
4. Add feature flag support for gradual rollout
5. Document permission model

**Success Criteria:**
- [ ] Fine-grained permissions possible
- [ ] Existing roles mapped to permissions
- [ ] Permission checks in critical paths
- [ ] Backwards compatible

---

### Agent 6: Session Management Enhancer

**Domain:** Security/UX
**Priority:** MEDIUM
**Files to Modify:**
- `src/components/client/ClientShell.tsx`
- `src/hooks/useAuth.tsx`
- New: `src/hooks/useSessionManager.tsx`
- New migration: session tracking table

**Tasks:**
1. Create centralized session management hook
2. Implement session timeout warnings
3. Add concurrent session tracking
4. Implement graceful session refresh
5. Add "session expired" UX flow

**Success Criteria:**
- [ ] Single source of truth for auth state
- [ ] Session expiry warnings before logout
- [ ] Concurrent sessions tracked
- [ ] Smooth refresh experience

---

### Agent 7: Test Writer

**Domain:** Quality Assurance
**Priority:** HIGH
**Files to Create/Modify:**
- `src/__tests__/auth/` - new test files
- `playwright.config.ts` - E2E config
- Test utilities and mocks

**Tasks:**
1. Write unit tests for session management
2. Write integration tests for invitation flow
3. Write E2E tests for complete signup journey
4. Add test utilities for auth mocking
5. Ensure all existing tests still pass

**Success Criteria:**
- [ ] 80%+ coverage on auth flows
- [ ] E2E test for invitation → dashboard
- [ ] All existing tests pass
- [ ] CI/CD integration ready

---

### Agent 8: Review Agent (Orchestrator)

**Domain:** Quality Control
**Priority:** CRITICAL
**Runs After:** All other agents complete

**Tasks:**
1. Verify all agents completed their tasks
2. Check for conflicts between agent changes
3. Run full test suite
4. Verify backwards compatibility
5. Create final implementation report
6. Generate Lovable prompts for any remaining items

**Success Criteria:**
- [ ] All agent tasks verified complete
- [ ] No conflicts between changes
- [ ] All tests pass
- [ ] Ready for deployment

---

## Task Dependencies

```
Phase 1 (Can run in parallel):
├── Agent 1: Session Fixer ────────────────────┐
├── Agent 2: Password Confirmation ────────────┤
└── Agent 7: Test Writer (auth tests) ─────────┤
                                               │
Phase 2 (Can run in parallel):                 │
├── Agent 3: Token Security ───────────────────┤
└── Agent 6: Session Management ───────────────┤
                                               │
Phase 3 (Can run in parallel):                 │
├── Agent 4: Multi-Org Model ──────────────────┤
└── Agent 5: Permissions Model ────────────────┤
                                               │
Final:                                         │
└── Agent 8: Review Agent ◄────────────────────┘
```

---

## File Change Matrix

| File | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 | Agent 6 | Agent 7 |
|------|---------|---------|---------|---------|---------|---------|---------|
| `ClientLogin.tsx` | MODIFY | - | - | - | - | - | TEST |
| `AcceptInvitation.tsx` | MODIFY | MODIFY | - | - | - | - | TEST |
| `ClientShell.tsx` | MODIFY | - | - | - | - | MODIFY | TEST |
| `accept-invitation-signup` | - | LOVABLE | LOVABLE | - | - | - | - |
| `send-user-invitation` | - | - | LOVABLE | - | - | - | - |
| New: `organization_memberships` | - | - | - | LOVABLE | - | - | - |
| New: `permissions` tables | - | - | - | - | LOVABLE | - | - |
| New: `useSessionManager.tsx` | - | - | - | - | - | CREATE | TEST |

---

## Lovable Prompt Queue

Agents will generate Lovable prompts for:
1. `accept-invitation-signup` - Password confirmation + token security
2. `send-user-invitation` - Token expiry changes
3. Migration: Token single-use tracking
4. Migration: `organization_memberships` table
5. Migration: `permissions` and `role_permissions` tables
6. Migration: Session tracking table

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Login success rate | 100% (currently ~0% due to bug) |
| Invitation acceptance rate | 100% (currently broken) |
| Test coverage (auth) | 80%+ |
| Breaking changes | 0 |
| Backwards compatibility | 100% |

---

## Rollback Plan

If issues arise:
1. All changes are feature-flagged where possible
2. Database migrations are backwards compatible
3. Frontend changes can be reverted via git
4. Edge function changes via Lovable rollback

---

**Plan Created:** January 22, 2026
**Ready for Agent Deployment**
