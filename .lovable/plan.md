

# Generation History: Reassignment + Org Safeguards

## Part 1: Reassign Past Generations to Correct Organization

### Problem
All 6 MPAC generations (actblue_form_name: "mpac-meta") are stored under "A New Policy" (346d6aaf...) because they were created before the Step 0 org gate existed.

### Solution: "Move to Organization" action in GenerationHistoryPanel

Add a "Move" button on each generation card in the detail view that:
1. Opens a small org picker dialog
2. User selects the correct target organization
3. Updates `organization_id` on the `ad_copy_generations` row
4. Shows a success toast and refreshes the list

**UI placement:** In `GenerationDetail`, add a "Move to..." button in the meta info card, next to the existing metadata. Uses a small popover/dialog with the same org search list from `AdminOrganizationPicker`.

### Files
| File | Change |
|------|--------|
| `GenerationHistoryPanel.tsx` | Add "Move to Organization" button in detail view, with org picker popover and Supabase UPDATE call |
| `useGenerationHistory.ts` | Add a `moveGeneration(generationId, newOrgId)` helper function; expose `refetch` |

---

## Part 2: Prevent Generating Under the Wrong Organization

### Problem
There's no validation that the ActBlue form name actually belongs to the selected organization. A user could select Org A but configure an ActBlue form that belongs to Org B.

### Solution: ActBlue Form-to-Org Association Check

The ActBlue forms are currently fetched globally for the admin. To add a safeguard:

1. **Visual warning in CopyGenerationStep (Step 4):** Before generation, if a previous generation exists with the same `actblue_form_name` under a DIFFERENT organization, show a warning banner:
   > "The form 'mpac-meta' was previously used with organization 'MPAC'. You're currently generating for 'A New Policy'. Are you sure this is correct?"

2. **Confirmation dialog on Generate:** If the mismatch warning is active, require an explicit confirmation before proceeding with generation.

This is a soft safeguard (warning, not blocking) since some forms may legitimately be shared, but it catches the common mistake.

### Implementation

Query on Step 4 mount:
```sql
SELECT DISTINCT organization_id 
FROM ad_copy_generations 
WHERE actblue_form_name = $formName 
  AND organization_id != $currentOrgId
LIMIT 1
```

If results exist, look up the org name and show the warning.

### Files
| File | Change |
|------|--------|
| `CopyGenerationStep.tsx` | Add mismatch check query on mount, warning banner UI, confirmation gate on generate |
| `AdCopyWizard.tsx` | Pass `organizations` list to CopyGenerationStep so it can resolve org names for the warning |

---

## Technical Details

### Database Changes
None required -- just UPDATE and SELECT queries using existing tables and columns.

### Reassignment Flow
```text
Detail View -> "Move to..." button -> Org Picker Popover
  -> Select target org -> Confirm dialog ("Move this generation from [A] to [B]?")
  -> UPDATE ad_copy_generations SET organization_id = $newOrgId WHERE id = $genId
  -> Toast "Moved to [Org Name]" -> Refetch list
```

### Mismatch Warning Flow
```text
Step 4 mounts -> Query: any other org used this ActBlue form?
  -> If yes: show yellow warning banner with org name
  -> User clicks "Generate" -> Extra confirmation dialog
  -> User confirms -> Proceed normally
  -> If no mismatch: generate as normal (no extra step)
```

