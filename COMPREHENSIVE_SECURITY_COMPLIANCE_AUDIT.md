# Comprehensive Security & Compliance Audit Report
**Date:** January 15, 2026
**Scope:** Compliance (FEC, State Privacy) & Application Security (OWASP, Infrastructure)

---

## 1. Executive Summary

This audit evaluates the system's readiness for high-stakes political campaign finance operations. While the application functions as intended, **critical security and compliance gaps** exist that would likely result in an audit failure or security breach if not addressed.

### 🚨 Critical Findings (Immediate Action Required)
1.  **Plaintext Credential Storage:** "Encrypted" columns appear to store credentials in plaintext JSON, accessible to anyone with database access (including Service Roles).
2.  **PII Leakage in Logs:** Full donor PII (Name, Email, Address, Employer) is logged to the database in `webhook_logs`, violating data minimization principles and creating a permanent, unredacted record of sensitive data.
3.  **Indefinite PII Retention:** No automated mechanisms exist to delete or anonymize donor data after a set period, creating a massive liability "toxic tail."
4.  **CSV Injection Vulnerability:** The export utilities do not sanitize formulas, exposing administrators to Remote Code Execution (RCE) via malicious donor input.

---

## 2. Data Inventory & Flow (Deliverable A)

| Data Category | Collection Source | Storage Location | Retention | Egress Points | Security Controls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Donor PII** (Name, Email, Address, Employer, Occupation) | ActBlue Webhook, ActBlue CSV Sync | `actblue_transactions`, `donor_demographics`, `webhook_logs` (Raw Payload) | **Indefinite** | CSV Export, Email Reports | RLS (Row Level Security), *Fake* Encryption? |
| **Contribution Data** (Amount, Date, Refcodes) | ActBlue | `actblue_transactions`, `daily_aggregated_metrics` | **Indefinite** | Dashboard, CSV Export | RLS |
| **Platform Credentials** (API Keys, Passwords) | User Input | `client_api_credentials` | Indefinite | Used by Edge Functions | **PLAINTEXT JSON** (Misnamed `encrypted_credentials`) |
| **User Activity** | App Usage | `attribution_touchpoints` | Indefinite | None | RLS |
| **System Logs** | Webhooks, Errors | `webhook_logs`, `admin_audit_logs` | Indefinite | Admin Dashboard | None (Internal) |

---

## 3. Compliance Applicability Matrix (Deliverable B)

| Regulation / Standard | Applicability | Status | Evidence / Gap |
| :--- | :--- | :--- | :--- |
| **FEC "Best Efforts"** | **Applies** | ⚠️ Partial | System collects Emp/Occ, but no automated "follow-up" email logic found for missing data. |
| **FEC Recordkeeping** | **Applies** | ✅ Pass | `actblue_transactions` stores comprehensive data. Checks/Deposit images not handled (ActBlue likely handles this). |
| **FEC "Sale or Use"** | **Applies** | ⚠️ Risk | System ingests data. If we ingest *public* FEC data for "Entity Watchlists", we cannot allow it to be used for solicitation. Current controls are weak. |
| **CA CPRA / Privacy** | **Likely Exempt** | ℹ️ Note | Political committees often exempt, but "Major Donor" rules apply in CA. Indefinite retention is a privacy risk regardless of law. |
| **PCI DSS** | **Indirect** | ✅ Pass | Payment processing is offloaded to ActBlue. System does not appear to touch raw credit card numbers (only metadata). |

---

## 4. Security Findings Report (Deliverable C)

### 🔴 Severity: CRITICAL

#### 1. Plaintext Storage of API Credentials
**Location:** `supabase/migrations/20251113221031...sql` (Table Definition) & `supabase/functions/sync-actblue-csv/index.ts` (Usage)
**Finding:** The column `encrypted_credentials` is defined as `JSONB`. The code casts it directly to an object (`const config = cred.encrypted_credentials as any`) and accesses `.username` / `.password`.
**Impact:** If the database is compromised (SQLi or Insider Threat), ALL client ActBlue credentials are leaked immediately.
**Remediation:** Implement application-side encryption (AES-256-GCM) before saving to DB. Decrypt only within Edge Functions using a key stored in Supabase Secrets (Vault).

#### 2. PII Leakage in Immutable Logs
**Location:** `supabase/functions/actblue-webhook/index.ts`
**Code:** `payload: parsedPayload` inside `supabase.from('webhook_logs').insert(...)`
**Finding:** The entire ActBlue webhook payload is dumped into `webhook_logs`. This includes `donor.firstname`, `donor.lastname`, `donor.email`, `donor.addr1`, `donor.employer`.
**Impact:** PII exists in a "Log" table that might have looser access controls or longer retention than the main transaction table. Violates "Data Minimization".
**Remediation:** Redact `donor` object and `customFields` before logging. Store only `lineitem_id` and status.

### 🟠 Severity: HIGH

#### 3. CSV Injection (Formula Injection)
**Location:** `src/lib/csv-utils.ts`
**Finding:** The `escapeCSVValue` function only handles quotes and commas. It does not escape characters like `=`, `+`, `-`, `@`.
**Exploit Scenario:** A malicious donor enters `=cmd|' /C calc'!A0` as their "First Name". When an admin exports the "Donor Demographics" CSV and opens it in Excel, code executes.
**Remediation:** Prepend a `'` (single quote) to any value starting with `=`, `+`, `-`, or `@`.

#### 4. Indefinite PII Retention
**Location:** `supabase/functions/ttl-cleanup/index.ts`
**Finding:** The cleanup job removes operational logs but **ignores** `actblue_transactions`, `donor_demographics`, and `webhook_logs`.
**Impact:** Database size grows indefinitely; liability for data breach increases every day.
**Remediation:** Define a retention policy (e.g., "7 years for FEC compliance"). Update `ttl-cleanup` to prune or anonymize records older than the policy limit.

### 🟡 Severity: MEDIUM

#### 5. Webhook Auth Bypass Risk
**Location:** `supabase/functions/actblue-webhook/index.ts`
**Finding:** The code allows an `allow_unauthenticated` flag in the credentials config.
**Impact:** If enabled by mistake, anyone can spoof donations by POSTing to the webhook endpoint, corrupting data.
**Remediation:** Enforce HMAC validation strictly. Remove the bypass option unless strictly necessary for legacy reasons, and alert heavily if used.

---

## 5. Audit Readiness Checklist (Deliverable D)

- [ ] **Data Retention Policy:** Create a formal document stating "Donor data retained for X years per FEC reqs, then anonymized."
- [ ] **Incident Response Plan:** Draft a 1-page "Who to call" if `admin_audit_logs` shows suspicious exports.
- [ ] **Access Review:** Quarterly review of `client_users` with `admin` role.
- [ ] **Vendor Agreements:** Ensure ActBlue and Meta agreements cover data processing roles.

## 6. Remediation Roadmap

### Immediate (Next 24 Hours)
1.  **Fix Logging:** Patch `actblue-webhook` to redact PII.
2.  **Fix CSV Injection:** Update `src/lib/csv-utils.ts`.

### Short Term (1 Week)
1.  **Encrypt Credentials:** Write a migration script to encrypt existing credentials in `client_api_credentials` and update Edge Functions to decrypt them.
2.  **Prune Logs:** Delete historical PII from `webhook_logs`.

### Long Term (30 Days)
1.  **Retention Automation:** Expand `ttl-cleanup` to archive/delete old donor data.
2.  **SOC 2 / Security Review:** Formal external pen test.
