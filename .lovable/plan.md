
# Deep UX/UI Audit: Ad Copy Studio (Pass 2)

This second-pass audit goes deeper than the first, examining interaction micro-patterns, data flow integrity, accessibility gaps, error recovery paths, component duplication, and visual consistency issues that compound into a degraded user experience.

---

## SECTION A: INTERACTION & FLOW ISSUES

### Issue A1: CRITICAL -- Multi-Video Generation Uses Only First Video's Transcript

**File:** `AdCopyWizard.tsx` lines 440-467

The system supports uploading up to 5 videos, but `handleGenerate` only passes `primaryVideo = sourceVideos[0]` and its single `transcriptId` to the generation function. Videos 2-5 are uploaded, transcribed, and analyzed -- but their content is completely ignored during copy generation. The user spent time uploading and reviewing multiple videos under the impression they all contribute to the output. This is the most misleading part of the entire flow.

**Fix:** Either (a) combine transcripts from all analyzed videos into a single context blob sent to the AI, or (b) clearly communicate in the UI that only one video's transcript is used and let the user select which one, or (c) generate copy per-video and let users pick favorites.

---

### Issue A2: HIGH -- Step 2 "Reviewed X/Y" Counter Persists as a Misleading Metric

The previous audit flagged this (Issue #6) but the implementation still auto-marks videos as "reviewed" on tab switch (`handleTabChange` at line 327). The counter now shows in the header but still doesn't gate anything and still gives false confidence. No "Mark as reviewed" button was added.

**Fix:** Remove the reviewed counter entirely since it doesn't gate progression. Replace with a simple "X videos available" indicator. The step should rely on the "Continue" button alone.

---

### Issue A3: HIGH -- Preset Segment Templates Only Show When List is Empty

**File:** `CampaignConfigStep.tsx` line 469

The "Quick add common segments" chips only render when `config.audience_segments.length === 0 && !isAddingSegment`. Once a user adds their first segment (even via the presets), the remaining presets disappear forever. A user wanting "Progressive Base" AND "Grassroots Donors" must click one, then manually create the second.

**Fix:** Show the preset chips whenever there are unused presets remaining. Filter out presets whose names already exist in `config.audience_segments`.

---

### Issue A4: HIGH -- No Validation That Segment Names Are Unique

**File:** `CampaignConfigStep.tsx` lines 315-329

Users can create two segments with the same name (e.g., two "Progressive Base" entries). Since `generatedCopy` is keyed by segment NAME (`GeneratedCopy = { [segmentName: string]: SegmentCopy }`), duplicate names will cause the second segment's copy to overwrite the first. The user loses half their generated output with no warning.

**Fix:** Add uniqueness validation in `handleSaveNewSegment` and `handleSaveEditSegment`. Disable the Save button and show an inline error if the name conflicts with an existing segment.

---

### Issue A5: HIGH -- Segment Tab in Export Uses segment.name as Key, Not segment.id

**File:** `CopyExportStep.tsx` lines 263, 332-348

`activeSegment` state is set to `audienceSegments[0]?.name` and `TabsTrigger value={segment.name}`. If two segments had the same name (Issue A4), tabs would collide. Even without duplicates, using names as keys is fragile -- if the user renamed a segment after generation, the tab mapping would break.

**Fix:** Use `segment.id` as the tab value and key. Map back to `segment.name` only when looking up `generatedCopy[segment.name]`.

---

### Issue A6: MEDIUM -- No Way to Regenerate a Single Segment's Copy

The export step shows copy per-segment but provides no "Regenerate this segment" button. If one segment's output is poor, the user must go back to Step 4 and regenerate ALL segments, wasting time and API calls on the segments that were already good.

**Fix:** Add a "Regenerate" button per segment tab in CopyExportStep. The `useAdCopyGeneration` hook already has a `regenerateSegment` method.

---

### Issue A7: MEDIUM -- "Start New" Button in Export Doesn't Confirm

**File:** `CopyExportStep.tsx` line 627

The "Start New" button at the bottom of Step 5 calls `onStartNew` directly with no confirmation dialog. After spending potentially 10+ minutes uploading, reviewing, configuring, and generating, a misclick wipes everything. The Reset button in the header correctly shows a confirmation, but this one does not.

**Fix:** Wire `onStartNew` through the same AlertDialog confirmation used for Reset.

---

### Issue A8: MEDIUM -- Copy Generation Doesn't Show Which Segment Is Currently Being Generated

**File:** `CopyGenerationStep.tsx` lines 209-212 and `AdCopyWizard.tsx` line 612

The `currentSegment` prop is always `undefined` because `AdCopyWizard` passes `currentSegment={undefined}` on line 612. The generation step has UI for displaying the current segment name but it never shows because the data isn't piped through.

**Fix:** Track `currentSegment` in `useAdCopyGeneration` and pass it to `CopyGenerationStep`. The edge function processes segments sequentially, so the hook should expose which segment is currently being processed.

---

### Issue A9: MEDIUM -- Step 1 Footer Has No "Back" Button

**File:** `VideoUploadStep.tsx` line 673-689

Every other step has a "Back" button in the footer, but Step 1 only has "Next: Review Transcripts" aligned to the right. While there's a "Back to Admin" in the header, the inconsistency breaks the visual pattern. Users expect a Back button in the footer on every step.

**Fix:** Add a "Back to Admin" or "Exit" ghost button on the left side of the footer, matching the pattern of other steps.

---

## SECTION B: DATA INTEGRITY & STATE MANAGEMENT

### Issue B1: HIGH -- Analyses Object Uses Stale Closure in updateStepData

**File:** `AdCopyWizard.tsx` line 371

Inside the `useEffect` polling loop, `updateStepData({ analyses: { ...analyses, [videoId]: analysis } })` captures the `analyses` variable from the closure. When multiple videos complete near-simultaneously, each callback reads the same stale `analyses` object, potentially overwriting each other. Only the last-completing video's analysis survives.

**Fix:** Use the functional updater pattern or use a ref for analyses. Alternatively, use `setAnalyses` with a callback and derive `stepData.analyses` from the state rather than spreading.

---

### Issue B2: HIGH -- Session Persistence Doesn't Include transcriptIds

**File:** `AdCopyWizard.tsx` line 193

`transcriptIds` is local state (`useState<Record<string, string>>({})`). It's never persisted to `stepData` or the session. On page refresh, `transcriptIds` is empty, which means `handleGenerate` at line 451 falls through to `primaryVideo.transcript_id` (which may also be undefined if the video was uploaded before that field was added to VideoUpload).

**Fix:** Persist `transcriptIds` in `stepData` alongside `analyses`. Hydrate from `stepData` on mount.

---

### Issue B3: MEDIUM -- hasCompletedStep4Ref Not Reset on Session Restore

**File:** `AdCopyWizard.tsx` line 196

`hasCompletedStep4Ref` is initialized to `false` and set to `true` after auto-advancing from Step 4 to 5. But if the user refreshes on Step 5 and then navigates back to Step 4 to regenerate, the ref is still `false` (correct). However, if the session is restored directly to Step 5 (with `generatedCopy` in stepData), the auto-advance effect at line 472 could re-trigger and call `completeStep(4)` redundantly.

**Fix:** Initialize `hasCompletedStep4Ref` to `true` if `currentStep === 5` on mount.

---

### Issue B4: MEDIUM -- Video Status Sync Runs Before Hook Hydration

**File:** `AdCopyWizard.tsx` lines 258-330

The `syncBackendStatuses` effect runs on a 500ms delay after mount. But `useVideoUpload` also has hydration logic that reads `initialVideos` from `stepData.videos`. These two can race, causing the UI to flash between states. The `hasSyncedRef` guard prevents re-runs but doesn't prevent the initial race.

**Fix:** Make the sync effect depend on a "hydration complete" signal from `useVideoUpload`, or increase the delay, or merge the sync logic into the hook itself.

---

## SECTION C: COMPONENT ARCHITECTURE & DUPLICATION

### Issue C1: MEDIUM -- Duplicate AnalysisCard/TagList/BulletList Components

Three places define identical (or near-identical) helper components:
1. `TranscriptReviewStep.tsx` lines 72-160 -- `AnalysisCard`, `TagList`, `BulletList`
2. `TranscriptAnalysisPanel.tsx` lines 41-132 -- `AnalysisCard`, `TagList`, `BulletList`
3. `CopyExportStep.tsx` lines 58-62 -- `getCharCountColor` (duplicated from `CopyVariationCard.tsx`)

These are functionally identical but independently maintained. Changes to one won't propagate.

**Fix:** Extract shared primitives (`AnalysisCard`, `TagList`, `BulletList`, `PrimaryBadge`) into `src/components/ad-copy-studio/components/analysis-primitives.tsx` and import everywhere.

---

### Issue C2: MEDIUM -- AudienceSegmentEditor Component Is Unused

**File:** `src/components/ad-copy-studio/components/AudienceSegmentEditor.tsx`

A fully-built `AudienceSegmentEditor` component exists (340 lines) with the same exact functionality that's duplicated inline in `CampaignConfigStep.tsx`. The component is never imported anywhere.

**Fix:** Replace the inline segment management in `CampaignConfigStep` with the extracted `AudienceSegmentEditor` component, or delete the unused component.

---

### Issue C3: LOW -- GDriveLinkInput and RefcodeGenerator Components Are Unused

Both `GDriveLinkInput.tsx` and `RefcodeGenerator.tsx` in the components folder are fully-built extraction-ready components, but the actual steps use inline implementations. These files add bundle weight and maintenance confusion.

**Fix:** Either integrate them into their respective steps or remove them.

---

## SECTION D: ACCESSIBILITY & USABILITY

### Issue D1: HIGH -- No Keyboard Navigation Between Steps

**File:** `WizardStepIndicator.tsx`

Steps are interactive buttons but there's no arrow-key navigation between them. The ARIA pattern for a wizard should use `role="tablist"` with `role="tab"` for each step, supporting left/right arrow keys. Currently it uses `role="navigation"` with `<ol>`, which is semantically incorrect for a wizard stepper.

**Fix:** Change to `role="tablist"` / `role="tab"` pattern with arrow-key handling, or keep as `nav` but add `aria-describedby` linking each step to its description.

---

### Issue D2: MEDIUM -- ScrollArea in Step 2 Has Fixed Height Cutting Off Content

**File:** `TranscriptReviewStep.tsx` line 659

The right panel analysis cards are in `ScrollArea className="h-[520px]"`. With all the new fields added (targets_supported, values_appealed, urgency_drivers, sentiment_score, CTA, topic), the scroll area is now very crowded. On smaller laptop screens (1366x768), the analysis panel is taller than the viewport but constrained to 520px, creating scroll-within-scroll which is disorienting.

**Fix:** Use `max-h-[calc(100vh-300px)]` or `flex-1 overflow-auto` to make the panel responsive to viewport height rather than fixed.

---

### Issue D3: MEDIUM -- No Focus Management After Step Transitions

When transitioning between steps (framer-motion `AnimatePresence`), focus stays on the previous step's button or is lost entirely. Screen reader users have no indication that content has changed.

**Fix:** After step transition completes, programmatically focus the new step's heading (`h2`) or first interactive element. Add `aria-live="polite"` to the step content container.

---

### Issue D4: LOW -- Transcript Edit Textarea Has No Character Count

**File:** `TranscriptReviewStep.tsx` line 590

The transcript text can be very long and users can edit it, but there's no indication of length. While there's no strict limit, showing a character/word count helps users understand the scope of what they're editing.

**Fix:** Add a small word/character count footer below the textarea.

---

### Issue D5: LOW -- Color-Only Status Indicators

Video status indicators (pending=gray, uploading=blue, extracting=amber, transcribing=purple, ready=green, error=red) rely solely on color differentiation. Users with color blindness cannot distinguish between states.

**Fix:** Ensure each status has a unique icon shape in addition to color (already partially done -- spinner vs checkmark vs alert). Verify the full set covers all states with distinct shapes.

---

## SECTION E: VISUAL & LAYOUT ISSUES

### Issue E1: MEDIUM -- Double Border on Step Content

**File:** `AdCopyWizard.tsx` line 754

The step content wrapper has `rounded-lg border border-[#1e2a45] bg-[#141b2d]`. But inside, some steps have their own borders (e.g., the upload drop zone has `rounded-xl border-2 border-dashed`). The result is nested containers with visible borders that create visual heaviness.

**Fix:** Remove the outer content border or make the step wrapper borderless with only a subtle background difference. Let the step contents provide their own visual boundaries.

---

### Issue E2: MEDIUM -- Header Has Two Layers (Page + Wizard)

**File:** `AdminAdCopyStudio.tsx` line 296 + `AdCopyWizard.tsx` line 665

There are two stacked headers: the page header (with "Back to Admin" and forms loading indicator) and the wizard header (with org picker, title, and Reset). This wastes 100+ pixels of vertical space and creates confusion about which header does what. The "forms loading" indicator in the page header is disconnected from the wizard context.

**Fix:** Merge into a single sticky header. Move "Back to Admin" into the wizard header's left side. Move the forms loading indicator into the wizard or remove it (it's brief and low-value).

---

### Issue E3: LOW -- Step 4 Generate Button Is Excessively Large

**File:** `CopyGenerationStep.tsx` line 263-277

The "Generate Copy" button uses `size="lg"` with additional `px-8 py-6 text-lg` -- making it disproportionately large compared to every other button in the app. While it's the primary CTA, the oversized treatment looks unpolished.

**Fix:** Use `size="lg"` with `px-6 py-3` to keep it prominent but proportional.

---

### Issue E4: LOW -- Inconsistent Card Border Radius

Some cards use `rounded-lg` (8px), others `rounded-xl` (12px). The upload zone is `rounded-xl`, video list items are `rounded-lg`, the GDrive section is `rounded-xl`, summary card in Step 4 is `rounded-xl`, variation cards in Step 5 are `rounded-xl` in variation view but `rounded-lg` in element view.

**Fix:** Standardize on `rounded-xl` for primary content cards, `rounded-lg` for nested sub-cards.

---

## SECTION F: MISSING FEATURES

### Issue F1: MEDIUM -- No Undo After Deleting a Segment

Deleting an audience segment is immediate with no undo. If a user accidentally deletes a segment with a carefully written description, they must recreate it from scratch.

**Fix:** Add a toast with an "Undo" action that restores the deleted segment for 5 seconds.

---

### Issue F2: MEDIUM -- No Copy-Individual-Element Buttons in Variation View

**File:** `CopyExportStep.tsx` lines 396-486

In "Variation View," users can copy the entire variation (all 3 elements combined). But they can't copy just the headline or just the primary text individually. When pasting into Meta Ads Manager, users need to paste each element separately into different fields. The "Copy All" button formats as `PRIMARY TEXT:\n...\nHEADLINE:\n...\nDESCRIPTION:\n...` which isn't directly pasteable.

**Fix:** Add small individual copy buttons next to each element within the variation card. Keep the "Copy All" for full-set clipboard.

---

### Issue F3: LOW -- No "Select All Segments" Quick Action in Export

If a user has 3-4 segments, they must switch tabs to review each one. There's no way to see all segments' output at once for comparison.

**Fix:** Add an "All Segments" tab option that renders all segments in a vertically stacked layout.

---

## Implementation Priority

### Critical (Do First)
1. **A1** -- Multi-video transcript usage (most misleading issue)
2. **A4** -- Segment name uniqueness validation
3. **B1** -- Stale closure in analyses update
4. **B2** -- Persist transcriptIds to session

### High
5. **A3** -- Preset templates available after first add
6. **A5** -- Use segment.id as tab key
7. **E2** -- Merge double headers
8. **D1** -- Wizard step ARIA pattern

### Medium
9. **C1** -- Extract shared analysis primitives
10. **C2** -- Use or delete AudienceSegmentEditor
11. **A6** -- Per-segment regeneration in export
12. **A7** -- Confirm before "Start New"
13. **A8** -- Pipe currentSegment through to generation UI
14. **D2** -- Responsive ScrollArea height
15. **F2** -- Individual copy buttons in variation view

### Low
16. **A2** -- Remove misleading review counter
17. **A9** -- Back button consistency in Step 1
18. **B3** -- Initialize hasCompletedStep4Ref on restore
19. **C3** -- Remove unused components
20. **D3** -- Focus management after transitions
21. **D4** -- Transcript edit character count
22. **D5** -- Color-blind friendly status icons
23. **E1** -- Double border cleanup
24. **E3** -- Generate button sizing
25. **E4** -- Consistent border radius
26. **F1** -- Undo segment deletion
27. **F3** -- All-segments view in export

### Files Changed

| File | Issues |
|------|--------|
| `AdCopyWizard.tsx` | A1, A7, A8, B1, B2, B3, B4, E2 |
| `TranscriptReviewStep.tsx` | A2, C1, D2, D3, D4 |
| `CampaignConfigStep.tsx` | A3, A4, C2, F1 |
| `CopyGenerationStep.tsx` | A8, E3 |
| `CopyExportStep.tsx` | A5, A6, A7, F2, F3, E4 |
| `VideoUploadStep.tsx` | A9, D5 |
| `WizardStepIndicator.tsx` | D1 |
| `AdminAdCopyStudio.tsx` | E2 |
| New: `components/analysis-primitives.tsx` | C1 |
| Delete or integrate: `AudienceSegmentEditor.tsx`, `GDriveLinkInput.tsx`, `RefcodeGenerator.tsx` | C2, C3 |
