
# ActBlue Credential Form Enhancement

## Summary
Add the Entity ID field to the Webhook tab so it can be updated alongside webhook credentials without switching tabs.

---

## Current State

The ActBlue credential form has two tabs:
- **CSV API Tab**: Entity ID, Username, Password
- **Webhook Tab**: Basic Auth Username, Basic Auth Password, Secret

The merge-update save logic already works correctly - updating one tab does not affect fields from the other tab.

---

## Proposed Change

Add a **read-only or editable Entity ID field** to the Webhook tab for convenience. This allows admins to:
1. See the current Entity ID when configuring webhooks
2. Optionally update the Entity ID without switching tabs

---

## Implementation

### File: `src/components/admin/integrations/CredentialForm.tsx`

Add Entity ID field to the Webhook tab content (after line 343, before the SecureInput fields):

```text
<TabsContent value="webhook" className="space-y-4">
  {isEditing && (
    <Alert>
      <ShieldCheck className="h-4 w-4" />
      <AlertDescription>
        Only fill in fields you want to update. Leave empty to keep existing values.
      </AlertDescription>
    </Alert>
  )}
  
  {/* NEW: Entity ID field for webhook tab */}
  <div className="space-y-2">
    <Label htmlFor="actblue_entity_id_webhook">Entity ID</Label>
    <Input
      id="actblue_entity_id_webhook"
      value={formData.actblue?.entity_id || ''}
      onChange={(e) => updateActblue('entity_id', e.target.value)}
      placeholder={existingCredentialMask.entity_id || "Your ActBlue entity ID"}
      disabled={disabled}
    />
    {existingCredentialMask.entity_id && (
      <p className="text-xs text-muted-foreground">
        Current: {existingCredentialMask.entity_id}
      </p>
    )}
    <p className="text-xs text-muted-foreground">
      Used to identify your organization in ActBlue webhooks
    </p>
  </div>

  {/* Existing webhook endpoint URL alert */}
  <Alert className="bg-accent/50 border-accent">
    ...
  </Alert>
  
  {/* Existing SecureInput fields */}
  ...
</TabsContent>
```

---

## Technical Notes

### Why this is safe:
1. **Same form field key**: Both tabs will update the same `formData.actblue.entity_id` value
2. **Merge logic handles it**: The `mapActBlueCredentials` function in `CredentialSlideOver.tsx` already maps `entity_id` correctly
3. **No duplication in database**: Only one `entity_id` value exists in `encrypted_credentials`

### Edge case handled:
If a user enters Entity ID in both tabs before saving, the last value entered wins (both update the same field in state).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/integrations/CredentialForm.tsx` | Add Entity ID input to webhook tab content |

---

## Visual Preview

After implementation, the Webhook tab will show:

```text
Webhook Tab
-----------
Entity ID: [168679              ]
Current: 168679

[Webhook Endpoint URL info box]

Username (Basic Auth): [***********     ]
Current: ****name

Password (Basic Auth): [***********     ]
Current: ****word

Secret (Optional): [...              ]
```

This allows admins to configure webhook credentials while seeing/updating the Entity ID in one place.
