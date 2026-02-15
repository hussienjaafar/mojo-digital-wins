

# Full Funnel Audit: Conditional Logic, Content Coherence, and UX Fixes

## Issues Found Across All Steps

### Step 1: SegmentChannelStep

**Issue 1 - Jargon in channel question**: "Which pillars are in your 2026 work plan?" uses insider language ("pillars", "work plan"). A user unfamiliar with media buying jargon won't know what this means.
- Fix: Change to "Which channels interest you?" -- simple and universal.

**Issue 2 - Political segment button stays blue**: When a user selects "Political", the CTA button is blue (`!bg-blue-600`). It should be emerald to match the political card's accent color and maintain visual consistency throughout the path.

**Issue 3 - Channel checkboxes always use blue accent for political path**: Even after selecting "Political", channel selections highlight in blue. Should use emerald for political consistency.

**Issue 4 - No minimum channel guidance**: The CTA is disabled until 1 channel is selected, but there's no text telling the user they need to select at least one. A confused user may not realize why the button won't work.

### Step 2: Opportunity Steps (Commercial + Political)

**Issue 5 - "Total Coverage" icons ignore channel selection**: CommercialOpportunityStep shows TV/Mailbox/Commute icons regardless of what channels the user selected in Step 1. If a user only selected "Digital Ads", showing them "Mailbox" and "Commute" is confusing and irrelevant. These should be filtered or highlighted based on the user's selected channels.
- Fix: Pass `selectedChannels` to both opportunity steps and only show icons relevant to selected channels, or visually highlight the ones the user selected.

**Issue 6 - No transition context referencing the user's choices**: The micro-copy says "Based on your selection, here's your market opportunity..." but doesn't actually reference what they selected. Adding the segment name makes it feel personalized.

### Step 3: Proof Steps

**Issue 7 - CommercialProofStep badge stat mismatch**: The third badge says `label: 'Cultural CTV Precision'` with `stat: 'HIPAA-certified since 2019'`. CTV precision and HIPAA certification are unrelated. This looks like a copy error.
- Fix: Change stat to something CTV-relevant like "3x engagement vs. linear TV."

**Issue 8 - PoliticalProofStep 4-second forced wait is confusing**: The button shows "Please review disclaimer (4s)" with a countdown. Users don't understand why the button is disabled. There's no explanation that they must read the FEC disclaimer first.
- Fix: Add a brief instruction above the button: "Please review the FEC disclaimer above before proceeding." Also change button text to "Review in progress... (4s)" for clarity.

### Step 4: QualificationStep

**Issue 9 - Section 2 completion check is always `true`**: `const section2Complete = true;` means the Decision Making section always shows as "complete" with a checkmark before the user even opens it. This defeats the purpose of progressive disclosure.
- Fix: Track actual completion -- `isDecisionMaker` is a boolean that defaults to `false` which is a valid answer, but `buyingAuthority` (who else is involved) should be considered. A reasonable check: the section is complete once the user has interacted with it (visited it at least once or toggled the decision maker switch).

**Issue 10 - Submit button is always visible regardless of section completion**: The "Submit & Connect" button appears at the bottom of the page even when the user hasn't opened or completed all three sections. This is confusing -- users may try to submit before filling in Goals & Budget and get an error.
- Fix: Only show the submit button when all three sections have been opened/completed, or at minimum show it disabled with helper text.

**Issue 11 - No segment-aware styling on political path**: The entire QualificationStep uses blue accents regardless of whether the user chose the political path. For consistency, political users should see emerald accents on their KPI selections, budget buttons, and section borders.

**Issue 12 - KPI options don't connect to selected channels**: The KPIs are segment-specific (good), but they don't reflect the channels the user selected. For example, if a commercial user selected only "CTV / Streaming", showing "Cost Per Verified Patient" is irrelevant unless they're in healthcare. This is a minor content coherence issue.
- Fix: Add a contextual note above KPIs: "Based on your selected channels: CTV, Digital Ads" to reinforce the connection.

### Step 5: ThankYouStep

**Issue 13 - "Explore our case studies" links to `#`**: The href is `'#'` which is a broken/placeholder link. This is the one actionable CTA on the final step and it goes nowhere.
- Fix: Either link to an actual case studies page or remove the link until one exists.

**Issue 14 - Calendly URL is a placeholder**: `CALENDLY_URL = 'https://calendly.com'` points to the Calendly homepage, not a specific booking page. High-scoring leads will be redirected to a generic page.
- Fix: Add a TODO comment and make it configurable, or link to the company's actual booking page.

### Global / Container Issues

**Issue 15 - Swipe gestures conflict with scrolling on QualificationStep**: The FunnelContainer captures all touch swipes (50px threshold) to navigate between steps. On the QualificationStep, the content is scrollable (`overflow-y-auto`). A user trying to scroll through the form may accidentally trigger a step transition.
- Fix: Disable swipe navigation on steps that have scrollable content (Step 4), or increase the swipe threshold significantly, or only trigger on horizontal swipes.

**Issue 16 - Keyboard navigation (ArrowDown) can skip steps**: Pressing ArrowDown triggers `onNext` when focus is not on an input. A user pressing arrow keys to navigate within KPI or budget options could accidentally advance to ThankYou.
- Fix: Disable keyboard-based step advancement on the QualificationStep.

---

## Implementation Plan

### 1. SegmentChannelStep fixes
**File:** `src/components/funnel/steps/SegmentChannelStep.tsx`
- Change channel question text from "Which pillars are in your 2026 work plan?" to "Which channels interest you?"
- Add segment-aware accent colors: when `localSegment === 'political'`, channel highlights use emerald instead of blue, CTA uses `!bg-emerald-600`
- Add helper text below channel list when no channels selected: "Select at least one channel to continue"

### 2. Opportunity steps -- pass and use selectedChannels
**Files:** `src/pages/Experience.tsx`, `CommercialOpportunityStep.tsx`, `PoliticalOpportunityStep.tsx`
- Update Experience.tsx to pass `selectedChannels` to both opportunity step components
- Update both opportunity steps to accept `selectedChannels` prop
- In CommercialOpportunityStep: filter/highlight "Total Coverage" icons based on selected channels (map `ctv` to TV, `direct_mail` to Mail, `ooh` to Commute, `digital` to a new Screen icon)
- In PoliticalOpportunityStep: same treatment for "Precision Stack" icons
- Update transition micro-copy to include the segment name: "Great choice. Here's your commercial market opportunity..." or "Here's your campaign's precision advantage..."

### 3. CommercialProofStep badge fix
**File:** `src/components/funnel/steps/CommercialProofStep.tsx`
- Change the third badge stat from "HIPAA-certified since 2019" to "3x engagement vs. linear TV"

### 4. PoliticalProofStep disclaimer UX
**File:** `src/components/funnel/steps/PoliticalProofStep.tsx`
- Add instruction text above the CTA: "Please review the FEC disclaimer above before proceeding"
- Change disabled button text to "Reviewing disclaimer... (Xs)"

### 5. QualificationStep logic and styling fixes
**File:** `src/components/funnel/steps/QualificationStep.tsx`
- Fix `section2Complete`: track whether the user has visited/interacted with section 2 via a `section2Visited` state that becomes `true` when `activeSection` is set to 1 or higher
- Only show the submit button when `activeSection >= 2` or all sections have been visited
- Add segment-aware accent: when `segment === 'political'`, use emerald accents for KPI selections, budget highlights, and section active borders
- Add contextual note above KPIs showing which channels the user selected: "Based on your channels: CTV, Digital Ads"
- Pass `selectedChannels` labels into the component (already receives `selectedChannels` as IDs -- map to labels)

### 6. ThankYouStep link fixes
**File:** `src/components/funnel/steps/ThankYouStep.tsx`
- Change the case studies href from `'#'` to a meaningful URL or remove the arrow/link styling and show it as plain text with "Coming soon"
- Add a comment on the Calendly URL noting it needs to be replaced with the real booking link

### 7. FunnelContainer swipe/keyboard guard
**File:** `src/components/funnel/FunnelContainer.tsx`
- Accept a `disableGestures` prop (boolean)
- When `disableGestures` is true, skip touch swipe handling and keyboard ArrowDown/ArrowUp navigation
- In Experience.tsx, pass `disableGestures={currentStep === 4}` to disable on the QualificationStep

---

## Technical Details

### Channel-to-Icon Mapping (Opportunity Steps)

```text
Channel ID   ->  Icon         ->  Label
ctv          ->  Tv           ->  "Streaming"
digital      ->  Monitor      ->  "Digital"
direct_mail  ->  Mail         ->  "Mailbox"
ooh          ->  MapPin       ->  "Outdoor"
sms          ->  Smartphone   ->  "SMS" (political only)
```

Only icons matching selected channels will render. If no channels match a particular icon, it renders dimmed (opacity-30) instead of hidden, so the layout stays stable.

### Section 2 Completion Logic (QualificationStep)

Current (broken):
```
const section2Complete = true;
```

Proposed:
```
const [section2Visited, setSection2Visited] = useState(false);

// In the activeSection effect or handler:
if (activeSection >= 1) setSection2Visited(true);

const section2Complete = section2Visited;
```

### Segment-Aware Accent Colors (QualificationStep)

```text
segment === 'political':
  - Active section border: border-emerald-500/40
  - KPI selected: border-emerald-500/50 bg-emerald-500/10
  - KPI checkbox: border-emerald-500 bg-emerald-500
  - Continue buttons: bg-emerald-600 hover:bg-emerald-500
  - Submit button: !bg-emerald-600 hover:!bg-emerald-500

segment === 'commercial' (default):
  - All stay blue (current behavior)
```

### Files Modified Summary

| File | Changes |
|------|---------|
| `src/pages/Experience.tsx` | Pass `selectedChannels` to opportunity steps; pass `disableGestures` to FunnelContainer |
| `src/components/funnel/FunnelContainer.tsx` | Add `disableGestures` prop to skip swipe/keyboard nav |
| `src/components/funnel/steps/SegmentChannelStep.tsx` | Fix jargon, segment-aware colors, helper text |
| `src/components/funnel/steps/CommercialOpportunityStep.tsx` | Accept `selectedChannels`, filter coverage icons, personalize micro-copy |
| `src/components/funnel/steps/PoliticalOpportunityStep.tsx` | Accept `selectedChannels`, filter precision icons, personalize micro-copy |
| `src/components/funnel/steps/CommercialProofStep.tsx` | Fix badge stat mismatch |
| `src/components/funnel/steps/PoliticalProofStep.tsx` | Improve disclaimer UX, clearer disabled button text |
| `src/components/funnel/steps/QualificationStep.tsx` | Fix section2 completion, conditional submit visibility, segment-aware colors, channel context note |
| `src/components/funnel/steps/ThankYouStep.tsx` | Fix broken case studies link, Calendly placeholder note |

### No Backend Changes

All changes are purely frontend UI/UX. No database, edge function, or analytics hook modifications.

