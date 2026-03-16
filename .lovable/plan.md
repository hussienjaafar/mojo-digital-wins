

# Build EveryAction Integration

## Overview

Add EveryAction as a 5th integration platform across the full stack: database schema, credential storage, sync edge function, admin onboarding wizard (Step 4), and Integration Center credential form.

## 1. Database Migration

### New `everyaction_transactions` table
Mirrors `actblue_transactions` structure but adapted for EveryAction's data model:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK → client_organizations | |
| transaction_id | text UNIQUE | EveryAction contribution ID |
| van_id | text | EveryAction's donor identifier |
| donor_email | text | |
| donor_name | text | |
| first_name, last_name | text | |
| amount | numeric NOT NULL | |
| transaction_date | timestamptz NOT NULL | |
| transaction_type | text DEFAULT 'donation' | donation, refund |
| is_recurring | boolean DEFAULT false | |
| refcode | text | Mapped from Extended Source Code |
| source_code | text | Raw EveryAction source code |
| designation | text | Fund/designation name |
| contribution_form | text | Online action form name |
| addr1, city, state, zip, country | text | |
| phone, employer, occupation | text | |
| payment_method | text | |
| recurring_period | text | |
| custom_fields | jsonb DEFAULT '[]' | |
| created_at | timestamptz DEFAULT now() | |
| phone_hash | text | For cross-platform matching |

### RLS Policies
Same pattern as `actblue_transactions`:
- SELECT: `user_belongs_to_organization(organization_id)`
- INSERT/UPDATE: admin or org admin
- DELETE: system admin only

### Update `client_api_credentials` platform constraint
Add `'every_action'` as a valid platform value (currently free-text, just needs to work with the view).

### Update `v_integration_summary` view
No change needed — the view already joins `client_api_credentials` generically by `organization_id`, so `every_action` rows will appear automatically.

### Sync tracking table
Add `everyaction_sync_state` table to track Changed Entity Export Job cursors:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organization_id | uuid FK | |
| last_sync_cursor | timestamptz | Last `dateChangedFrom` used |
| last_export_job_id | bigint | EveryAction export job ID |
| last_sync_at | timestamptz | |
| last_sync_status | text | |

## 2. Type System Updates

### `src/types/integrations.ts`
- Add `'every_action'` to `IntegrationPlatform` union
- Add to `PLATFORM_DISPLAY_NAMES`: `every_action: 'EveryAction'`
- Add to `PLATFORM_ICONS`: `every_action: '🟢'`
- Add `EveryActionCredentials` interface: `{ application_name, api_key }`

### `src/components/admin/integrations/CredentialForm.tsx`
- Add `every_action` to platform types, tab grid (5 columns), and form data
- Add `EveryAction` tab with fields: Application Name, API Key
- `CredentialFormData` gets `every_action?: { application_name: string; api_key: string; }`

### `src/components/admin/onboarding/types.ts`
- Add `'every_action'` to `IntegrationConfig.platform` union

## 3. Admin Onboarding Wizard — Step 4

### `Step4Integrations.tsx`
- Add `every_action` to `IntegrationFormState` interface with `application_name`, `api_key`, `isOpen`, `showKey` fields
- Add to `integrationConfigs` array: `{ key: 'every_action', name: 'EveryAction', description: 'Donation & CRM data via EveryAction/VAN', color: 'green', letter: 'E' }`
- Add `getColorClasses` green case
- Add credential form fields (application name + API key) following the Switchboard pattern
- Add to `testConnection`, `saveIntegration`, `handleDisconnectIntegration` handlers
- Info box explaining that EveryAction uses poll-based sync (runs every 30 min) vs real-time webhooks

## 4. Integration Center (Admin)

### `CredentialForm.tsx`
- Add 5th tab "EveryAction" with Application Name and API Key fields
- Update `CredentialFormProps.platform` union to include `'every_action'`
- Update `TabsList` grid from 4 to 5 columns

### `CredentialSlideOver.tsx`
- Add `'every_action'` to platform type unions

## 5. Edge Function: `sync-everyaction`

New edge function that:
1. Reads EveryAction credentials from `client_api_credentials` where `platform = 'every_action'`
2. Uses Changed Entity Export Jobs API (`POST /changedEntityExportJobs`) with `dateChangedFrom` from `everyaction_sync_state`
3. Polls the export job status until complete
4. Downloads and parses the export CSV
5. Upserts contributions into `everyaction_transactions`
6. Updates `everyaction_sync_state` cursor and `client_api_credentials.last_sync_at/status`

Authentication: HTTP Basic Auth with Application Name (username) and API Key (password) against `https://api.securevan.com/v4/`.

### Register in `supabase/config.toml`
```toml
[functions.sync-everyaction]
verify_jwt = false
```

## 6. Scheduled Job Registration

### `run-scheduled-jobs/index.ts`
Add `sync_everyaction` case that invokes the `sync-everyaction` function, following the `sync_actblue_csv` pattern.

## 7. `useIntegrationSummary.ts`
No changes needed — the hook reads from `v_integration_summary` generically.

## Files Changed Summary

| File | Change |
|------|--------|
| New migration SQL | `everyaction_transactions` table, `everyaction_sync_state` table, RLS policies |
| `src/types/integrations.ts` | Add `every_action` platform + display names + credentials type |
| `src/components/admin/integrations/CredentialForm.tsx` | Add EveryAction tab + form fields |
| `src/components/admin/integrations/CredentialSlideOver.tsx` | Add `every_action` to platform unions |
| `src/components/admin/onboarding/types.ts` | Add `every_action` to IntegrationConfig |
| `src/components/admin/onboarding/steps/Step4Integrations.tsx` | Add EveryAction card + form + save/test logic |
| `supabase/functions/sync-everyaction/index.ts` | New edge function for Changed Entity Export Jobs sync |
| `supabase/functions/run-scheduled-jobs/index.ts` | Add `sync_everyaction` case |
| `supabase/config.toml` | Register `sync-everyaction` function |

