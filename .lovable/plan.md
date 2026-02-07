

# Deep UX/UI Audit: Organization Context and Overall Flow (Pass 3)

This audit examines the Ad Copy Studio from the user's perspective, focusing on how organizational context is communicated, the first-impression experience, information hierarchy, and micro-interaction gaps across all 5 steps.

---

## SECTION 1: ORGANIZATION SELECTION -- THE CRITICAL FIRST MOMENT

### Issue 1.1: CRITICAL -- No "Step 0" Organization Selection Gate

Currently, the page loads and silently selects the first org alphabetically (`orgs[0].id` at `AdminAdCopyStudio.tsx` line 79). The user lands directly on Step 1 (Upload Videos) with no deliberate choice of which organization they're working on. The org name appears as tiny subtitle text ("Creating ads for Org Name") in the header, which is easy to miss.

For a tool where every uploaded video, generated transcript, and AI output is tied to an organization, accidentally working in the wrong org is a catastrophic error. The current design treats org selection as a secondary header action, but it should be the **primary gate** before any work begins.

**Fix:** Add a "Step 0" organization selection screen that appears when:
- No org is currently selected (first visit)
- The user has multiple organizations available

This screen should be a full-page card showing:
- "Select an Organization" heading
- Search input (reusing AdminOrganizationPicker logic but inline, not a dialog)
- Recent orgs section
- Full org list with logos
- Only after selection does the wizard render

If an org is already selected (from localStorage/session), skip Step 0 and show the wizard with a prominent org badge that can be clicked to return to selection.

### Issue 1.2: HIGH -- Org Picker Button Is Visually Subordinate to Reset

In the header (line 764-796), the org picker button and Reset button are side-by-side in the same visual weight. The Reset button even has a label ("Reset") while the org picker just shows the org name + chevron. Users scanning right-to-left in the header hit Reset before the org context. The org identity should be the most prominent element in the header, not co-equal with a destructive action.

**Fix:** 
- Move the org identity to the LEFT side of the header, immediately after "Ad Copy Studio" title
- Make it larger and more prominent (current name text + logo)
- Move Reset to a secondary position (perhaps an icon-only button with tooltip)
- The org identity doubles as the picker trigger

### Issue 1.3: HIGH -- No Org Context on Individual Step Content

Each step (Upload, Review, Configure, Generate, Export) has its own header area with a title like "Upload Your Campaign Videos" -- but none of them mention the organization. If the sticky header scrolls out of view or the user is focused on the step content, they lose all org context.

**Fix:** Add a subtle, persistent org context line below each step's `<h2>` title:
- Step 1: "Upload Your Campaign Videos **for [Org Name]**"
- Step 4: "Generate Ad Copy **for [Org Name]**"
- Step 5: Export header showing org name

This is lightweight (just appending to existing text) but ensures the org context is always visible in the user's focal area.

### Issue 1.4: MEDIUM -- localStorage "selectedOrganizationId" Is Not Used for Persistence

`AdminAdCopyStudio.tsx` always defaults to `orgs[0].id` on mount (line 79). It doesn't check localStorage for a previously selected org. If the user was working on Org X, navigated away, and returned, they'd be dumped into Org A (alphabetically first) instead of Org X.

**Fix:** On mount, check `localStorage.getItem('selectedOrganizationId')` and use it if the org exists in the fetched list. Fall back to `orgs[0].id` only if no match.

### Issue 1.5: MEDIUM -- Org Picker Dialog Has No Keyboard Shortcut Registered

The `AdminOrganizationPicker` supports keyboard navigation inside the dialog, but there's no global `Cmd+K` or `Ctrl+K` shortcut to OPEN it. The plan mentioned a keyboard shortcut hint but it was never wired up.

**Fix:** Add a `useEffect` in `AdCopyWizard` that listens for `Cmd+K` / `Ctrl+K` and calls `setShowOrgPicker(true)`. Show the shortcut hint on the org picker button.

---

## SECTION 2: INFORMATION HIERARCHY AND VISUAL WEIGHT

### Issue 2.1: HIGH -- Step Indicator Takes Up Premium Space But Lacks Context

The `WizardStepIndicator` occupies a bordered card (`rounded-xl border border-[#1e2a45] bg-[#141b2d] p-4`) with significant vertical space. It shows step circles and labels but no indication of what data has been collected. A user on Step 4 has no way to see "3 videos uploaded, 2 segments configured" without going back.

**Fix:** Add a compact data summary below each completed step's label:
- Step 1 (completed): "3 videos"
- Step 2 (completed): "3 reviewed"  
- Step 3 (completed): "2 segments"
- Step 4 (completed): "10 variations"
This gives at-a-glance progress without clicking back.

### Issue 2.2: MEDIUM -- No Breadcrumb or Context Path

The header shows "Exit" and "Ad Copy Studio" but there's no breadcrumb showing the full path: `Admin > Ad Copy Studio > [Org Name] > Step X`. Users who arrive via deep links or bookmarks have no spatial awareness.

**Fix:** Replace the simple "Exit" button + title with a minimal breadcrumb:
`Admin / Ad Copy Studio / [Org Name]` where "Admin" is clickable (= Exit), and "[Org Name]" is clickable (= org picker).

### Issue 2.3: MEDIUM -- Step Content Area Has No Visual Distinction from Step Indicator

Both the step indicator and the step content use `rounded-xl bg-[#141b2d]`. They look like two cards of equal importance stacked vertically. The step content should feel like the primary workspace while the indicator is secondary navigation.

**Fix:** 
- Keep step indicator as a compact bar (remove the card treatment, just a row of circles)
- Give step content a slightly different background or no border (it IS the page content, not a card within a card)
- Or: merge step indicator INTO the header as a horizontal bar, freeing up vertical space

---

## SECTION 3: STEP-SPECIFIC UX ISSUES

### Issue 3.1: HIGH -- Step 1 Has No Organization-Specific Context

The upload step shows "Upload Your Campaign Videos" with "Upload up to 5 videos for this campaign." There's no mention of WHICH organization. A user managing 10 orgs could easily upload to the wrong one. The header subtitle is the only clue, and it's far from the action area.

**Fix:** Change the subtitle to: "Upload up to 5 videos for **[Org Name]**'s campaign" with the org name styled in the blue accent color.

### Issue 3.2: MEDIUM -- Step 4 "Generation Summary" Doesn't Show the Organization

The summary card shows audiences, variations, and elements but not which organization's transcript and ActBlue form are being used. This is the last checkpoint before expensive AI generation.

**Fix:** Add an org identity row at the top of the summary card:
- Organization: [Logo] [Name]
- ActBlue Form: [form name]
- Transcript: [video name]

### Issue 3.3: MEDIUM -- Export Step Has No Org Branding

Step 5 is where users copy content to paste into Meta Ads Manager. The exported text has no org reference. If a user exports copy for multiple orgs in the same session (switch org, generate, export), the clipboard content is indistinguishable.

**Fix:** Include the org name in the clipboard format header:
```
=== [ORG NAME] - AD COPY ===
=== PROGRESSIVE BASE ===
...
```

### Issue 3.4: LOW -- No Session Timestamp or "Last Saved" Indicator

The saving indicator appears briefly but there's no persistent "Last saved at 2:34 PM" indicator. Users can't tell if their session data is current.

**Fix:** Show a small "Saved X min ago" text near the bottom or in the header.

---

## SECTION 4: ORG PICKER COMPONENT IMPROVEMENTS

### Issue 4.1: MEDIUM -- CommandDialog Styling May Not Override Default Theme

The `AdminOrganizationPicker` uses a `CommandDialog` from the UI library but applies dark colors via className. The `CommandDialog` component's own styles (including the overlay and content background) may bleed through, causing inconsistent appearance.

**Fix:** Verify the CommandDialog content wrapper receives `bg-[#141b2d]` and the overlay is properly dark. Add explicit `className` overrides to the `CommandDialog` root if needed.

### Issue 4.2: MEDIUM -- "All Organizations" List Renders Every Org at Once

With 500+ orgs, rendering all items simultaneously will cause layout jank. The current implementation maps all `filteredOrgs` into DOM elements (line 204-211).

**Fix:** Add virtualization using `react-window` (already installed) for the "All Organizations" list. Only render visible items. Keep the "Recent" section non-virtualized since it's max 5 items.

### Issue 4.3: LOW -- No "No Recent Organizations" Empty State

When `recentOrgs` is empty and search is empty, the user only sees "All Organizations." There's no indication that recent tracking exists. After they use it once, they'll see the Recent section appear, which could be confusing.

**Fix:** Show a subtle hint: "Your recent organizations will appear here" when `recentOrgs.length === 0` and there's no search.

### Issue 4.4: LOW -- Search Doesn't Highlight Matching Text

When searching, org names show plain text. Highlighting the matched substring (e.g., bold or underline) would help users visually confirm their search matched correctly.

**Fix:** Wrap matching text segments in `<mark>` or `<strong>` tags during rendering.

---

## SECTION 5: CROSS-CUTTING CONCERNS

### Issue 5.1: HIGH -- Org Switch Loses URL State

When switching organizations, the URL stays at `/admin/ad-copy-studio` with no query parameter indicating the active org. If the user shares the URL or bookmarks it, the recipient gets the default org, not the intended one. Deep-linking to a specific org context is impossible.

**Fix:** Add `?org=<orgId>` to the URL when an org is selected. On mount, check for this query param before localStorage or default.

### Issue 5.2: MEDIUM -- No Loading Skeleton for Org Data

When `isLoadingOrgs` is true, the page shows a full-screen centered spinner. This is jarring. A skeleton of the expected layout (header + step indicator + empty content area) would feel faster.

**Fix:** Replace the loading spinner with a skeleton layout that mirrors the wizard structure.

### Issue 5.3: LOW -- Mobile Responsiveness of Org Picker Button

The org picker button has `max-w-[240px]` which truncates long org names. On smaller screens, the header layout may break when the org name, Reset button, and Exit button compete for space.

**Fix:** On small screens (`sm:`), collapse the org picker to just the logo/initials with a tooltip showing the full name. Or stack the header into two rows.

---

## Implementation Priority

### Critical
1. **1.1** -- "Step 0" organization selection gate

### High  
2. **1.2** -- Make org identity the primary header element
3. **1.3** -- Add org name to each step's heading
4. **2.1** -- Data summaries in step indicator
5. **3.1** -- Org name in Step 1 context
6. **5.1** -- URL-based org state (`?org=orgId`)

### Medium
7. **1.4** -- localStorage org persistence
8. **1.5** -- Cmd+K keyboard shortcut
9. **2.2** -- Breadcrumb navigation
10. **2.3** -- Visual hierarchy between indicator and content
11. **3.2** -- Org context in generation summary
12. **3.3** -- Org name in clipboard export
13. **4.1** -- CommandDialog style overrides
14. **4.2** -- Virtualized org list
15. **5.2** -- Loading skeleton

### Low
16. **3.4** -- "Last saved" timestamp
17. **4.3** -- Recent orgs empty state
18. **4.4** -- Search highlight
19. **5.3** -- Mobile org picker

---

## Technical Details

### Files to Change

| File | Issues |
|------|--------|
| `AdminAdCopyStudio.tsx` | 1.1, 1.4, 5.1, 5.2 |
| `AdCopyWizard.tsx` | 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 3.4 |
| `AdminOrganizationPicker.tsx` | 4.1, 4.2, 4.3, 4.4 |
| `VideoUploadStep.tsx` | 3.1 |
| `CopyGenerationStep.tsx` | 3.2 |
| `CopyExportStep.tsx` | 3.3 |
| `WizardStepIndicator.tsx` | 2.1, 2.3 |

### New Components

| Component | Purpose |
|-----------|---------|
| `OrganizationSelectionGate.tsx` | Full-page "Step 0" org selection with inline search and recent orgs |

### Architecture for "Step 0"

The gate component renders INSTEAD of the wizard when no org is deliberately chosen. It reuses the `AdminOrganizationPicker` search/filter logic but presents it inline (not in a dialog). Once an org is selected:
1. Save to localStorage + URL query param
2. Render the `AdCopyWizard` component
3. The user can always click the org badge in the header to return to selection (or use Cmd+K for the quick-switch dialog)

This creates two interaction patterns:
- **First use / deliberate switch**: Full-page org selection (Step 0 gate)
- **Quick switch mid-session**: Command palette dialog (Cmd+K or header click)

