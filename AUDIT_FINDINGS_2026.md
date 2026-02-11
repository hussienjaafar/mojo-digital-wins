# Audit Findings 2026

**Date:** 2026-02-10
**Status:** In Progress

## Summary
Deep audit in progress. Major findings include security regressions in recent database functions, "fake" multi-touch attribution logic, and deprecated legacy code.

## 1. 🚨 Security (Critical)
- **Security Regression:** The function `get_creative_intelligence` in `supabase/migrations/20260130000000_align_rpc_confidence.sql` is marked `SECURITY DEFINER` but **fails to set `search_path`**. This re-introduces a vulnerability fixed in the 2025 audit (search path injection).
- **RLS:** Row Level Security seems generally enforced (e.g., `campaign_attribution` has `FORCE ROW LEVEL SECURITY`), which is good.

## 2. 📉 Code Quality & Logic
- **Fake Attribution:** `calculate-attribution-models` claims to implement linear, position-based, and time-decay models. However, it assigns 100% credit to a single campaign derived from the transaction's refcode for *all* models. There is no true multi-touch logic.
- **Legacy Code:** `supabase/functions/calculate-attribution/index.ts` is deprecated but still present.
- **Complex SQL:** Recent migrations contain heavy statistical logic (e.g., Z-scores, P-values) in PL/PGSQL. This increases database load and makes maintenance difficult.

## 3. 📦 Dependencies
- **Deprecated:** `string-similarity`, `glob` (older version), `sourcemap-codec`.
- **Vulnerabilities:** 15 reported (10 high).
- **Unused:** `inflight` is deprecated and likely unused or should be replaced.

## 4. 🛠 Build & Tools
- `npm run build` failed/timed out, indicating potential configuration issues or simply a heavy build process not suitable for this environment without optimization.
- `npm run lint` was started but results pending.

## 5. UI/UX
- Stack: React, Vite, Tailwind, Shadcn/UI, Framer Motion.
- Animations: `framer-motion` is actively used, which aligns with modern design requirements.

## 6. Recommendations
1.  **Fix Security:** Immediate patch required for `get_creative_intelligence` to add `SET search_path = public`.
2.  **Refactor Attribution:** Rewrite `calculate-attribution-models` to either implement real multi-touch logic or rename it to "Single Touch Attribution" to avoid misleading metrics.
3.  **Delete Legacy:** Remove `supabase/functions/calculate-attribution`.
4.  **Audit Dependencies:** Run `npm audit fix` and replace deprecated packages.
