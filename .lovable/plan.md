
# Credential Status Feedback Enhancement

## Summary
Add a status banner to the credential update form that shows users whether existing credentials are working properly or have issues, without requiring them to switch to the Diagnostics tab.

---

## Current State

| Component | Issue |
|-----------|-------|
| **CredentialSlideOver** | `loadCredential()` only fetches `id, organization_id, platform, is_active` - missing status fields |
| **CredentialForm** | No visual feedback about credential health when editing |
| **Diagnostics tab** | Shows full health info but requires tab switch |
| **existingCredentialMask** | Prop exists but is passed as empty object `{}` |

---

## Proposed Solution

Add a **Credential Status Alert** component that displays:
1. Whether credentials are configured (from `credential_mask`)
2. Last test result (success/error)
3. Last sync result (success/error)
4. Time since last test/sync
5. Specific error messages when applicable

---

## UI Design

### When credentials are working:
```text
+-------------------------------------------------------+
|  [CheckCircle] Credentials verified                   |
|  Last tested: 2 days ago | Last sync: 5 minutes ago   |
+-------------------------------------------------------+
```

### When there are issues:
```text
+-------------------------------------------------------+
|  [AlertTriangle] Credential issues detected           |
|  Last sync failed: ActBlue API error 401              |
|  Recommendation: Update your API credentials          |
+-------------------------------------------------------+
```

### When never tested:
```text
+-------------------------------------------------------+
|  [Clock] Credentials not yet verified                 |
|  Use the "Test" button to verify your credentials     |
+-------------------------------------------------------+
```

---

## Implementation

### File 1: `src/components/admin/integrations/CredentialSlideOver.tsx`

**Update `loadCredential()` to fetch status fields:**
```typescript
const { data, error } = await supabase
  .from('client_api_credentials')
  .select(`
    id, 
    organization_id, 
    platform, 
    is_active,
    credential_mask,
    last_tested_at,
    last_test_status,
    last_test_error,
    last_sync_at,
    last_sync_status,
    last_sync_error
  `)
  .eq('id', id)
  .single();
```

**Pass credential status data to CredentialForm:**
```typescript
<CredentialForm
  platform={platform}
  formData={formData}
  onFormDataChange={setFormData}
  onPlatformChange={setPlatform}
  organizationId={selectedOrg}
  disabled={false}
  isEditing={true}
  existingCredentialMask={existingCredential?.credential_mask || {}}
  credentialStatus={{
    lastTestedAt: existingCredential?.last_tested_at,
    lastTestStatus: existingCredential?.last_test_status,
    lastTestError: existingCredential?.last_test_error,
    lastSyncAt: existingCredential?.last_sync_at,
    lastSyncStatus: existingCredential?.last_sync_status,
    lastSyncError: existingCredential?.last_sync_error,
  }}
/>
```

---

### File 2: `src/components/admin/integrations/CredentialForm.tsx`

**Add new prop types:**
```typescript
interface CredentialStatus {
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  lastTestError?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
}

interface CredentialFormProps {
  // ... existing props
  credentialStatus?: CredentialStatus;
}
```

**Create new CredentialStatusBanner component:**
```typescript
function CredentialStatusBanner({ status }: { status?: CredentialStatus }) {
  if (!status) return null;
  
  const hasTestError = status.lastTestStatus?.includes('error');
  const hasSyncError = status.lastSyncStatus?.includes('error');
  const neverTested = !status.lastTestedAt;
  const hasIssues = hasTestError || hasSyncError;
  
  // Render appropriate alert based on status
}
```

**Add the banner at the top of each platform's TabsContent when editing:**
```typescript
{isEditing && credentialStatus && (
  <CredentialStatusBanner status={credentialStatus} />
)}
```

---

## Visual Component Design

The `CredentialStatusBanner` will be a styled Alert component with:

| Status | Icon | Background | Message |
|--------|------|------------|---------|
| **All Good** | CheckCircle (green) | Green/10 | "Credentials verified and working" |
| **Sync Error** | AlertTriangle (yellow) | Yellow/10 | Shows sync error + recommendation |
| **Test Error** | XCircle (red) | Red/10 | Shows test error + recommendation |
| **Not Tested** | Clock (muted) | Gray/10 | "Click Test to verify credentials" |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/integrations/CredentialSlideOver.tsx` | Expand `loadCredential()` query; pass status to CredentialForm |
| `src/components/admin/integrations/CredentialForm.tsx` | Add `credentialStatus` prop; add `CredentialStatusBanner` component |

---

## Technical Notes

### ActBlue-Specific Feedback
For ActBlue, the banner should differentiate between CSV API and Webhook status:
- CSV API uses `last_sync_status` from sync-actblue-csv
- Webhook uses webhook_events table (already handled by IntegrationHealthPanel)

The banner will parse the error message to provide actionable guidance:
- "401" errors → "Invalid credentials. Please verify your username and password."
- "Entity ID" errors → "Entity ID mismatch. Check your ActBlue entity ID."

### State Management
The status data is fetched once when editing and stored in `existingCredential` state. No additional queries needed since we already have the ID.

---

## Expected Behavior

1. **User opens credential to edit** → Status banner immediately shows current state
2. **User sees error** → Banner shows specific error and recommendation
3. **User updates credentials** → Clicks "Test" → Banner will update after page refresh
4. **User saves** → Status will update on next sync cycle

---

## Benefits

- **Immediate feedback** without switching tabs
- **Actionable guidance** for fixing issues
- **At-a-glance status** using familiar icons
- **Consistent with existing UI patterns** (uses same Alert styling)
