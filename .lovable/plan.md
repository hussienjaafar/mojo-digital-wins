
# Fix: Button Visibility and Funnel Intuitiveness Overhaul

## Root Cause Discovery

The primary issue is that **all CTA buttons across the entire funnel are invisible**. The `V3Button` component relies on CSS variables (e.g., `--portal-accent-blue`) that are only defined inside the `.portal-theme` class. The `Experience.tsx` page never applies this class, so every button in every step renders as plain, unstyled text on a dark background -- completely invisible as an interactive element.

This single root cause explains why "the next step button is not apparent that it is a button" and why the system feels unintuitive throughout. Every CTA across all 6 steps is affected.

## Secondary Issues Found

Beyond the broken buttons, the following intuitiveness gaps were identified:

1. **Back button icon is misleading**: The back button uses `ChevronUp` (an upward arrow), which is confusing in a form wizard context. Users expect a left arrow or "Back" label.
2. **"Next:" hints use muted text that blends into the background**: The hints below CTAs are `text-[#7c8ba3] text-xs` -- barely visible and easy to miss.
3. **Segment cards on Step 1 lack "selected" confirmation**: When a user taps Commercial or Political, the only feedback is a subtle border color change. There is no checkmark, no label change, no strong visual confirmation.
4. **Channel checkboxes look like buttons, not checkboxes**: The full-width rounded rectangles with tiny internal checkbox indicators don't match the mental model of "select multiple items."
5. **QualificationStep accordion sections look like static cards**: The section headers ("About You", "Decision Making", "Goals & Budget") have no visual cue that they expand. The chevron is small and muted.
6. **"Continue" links inside accordion sections are styled as plain text links**: The `text-blue-400 text-sm` "Continue" text at the bottom of each section is easy to miss and doesn't look like a primary action.
7. **Progress bar at the bottom competes with the CTA for attention**: The fixed bottom progress indicator and the CTA buttons are in close proximity, creating visual noise.

---

## Implementation Plan

### Fix 1: Add `portal-theme` class to Experience page (Critical)

**File:** `src/pages/Experience.tsx`

Add the `portal-theme` class to the root wrapper so all V3Button CSS variables resolve correctly. This single change will make every button in every step visible and properly styled.

Change the root div from:
```
<div className="fixed inset-0 bg-[#0a0f1a] text-white overflow-hidden">
```
to:
```
<div className="fixed inset-0 bg-[#0a0f1a] text-white overflow-hidden portal-theme dark">
```

### Fix 2: Replace all V3Button CTAs with explicit inline-styled buttons as a fallback layer

To prevent future CSS variable breakage, add explicit Tailwind utility classes alongside V3Button across all step components so the buttons are always visually apparent regardless of theme context. This means adding a `className` override with visible background/text colors.

**Files:** All 7 step components

For primary CTAs, add explicit classes:
```
className="w-full min-h-[48px] !bg-blue-600 hover:!bg-blue-500 !text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25"
```

For political path (success variant):
```
className="w-full min-h-[48px] !bg-emerald-600 hover:!bg-emerald-500 !text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/25"
```

The `!important` overrides ensure the button is always visible even if CSS variables fail to resolve.

### Fix 3: Replace back button icon and add label

**File:** `src/components/funnel/FunnelContainer.tsx`

- Replace `ChevronUp` with `ArrowLeft` icon
- Add a "Back" text label next to the icon for clarity
- Increase the touch target and add a subtle background

### Fix 4: Strengthen "Next:" hints

**Files:** All step components with "Next:" hints

- Change from `text-[#7c8ba3] text-xs` to `text-[#94a3b8] text-sm`
- Add a right arrow icon (`ArrowRight` or `ChevronRight`) inline to reinforce that it leads somewhere
- Add `mt-3` spacing to separate it from the button

### Fix 5: Add selected checkmark to segment cards

**File:** `src/components/funnel/steps/SegmentChannelStep.tsx`

- When a segment card is selected, render a checkmark badge in the top-right corner
- Add a subtle "Selected" label or a filled radio indicator on the left side of the card

### Fix 6: Improve accordion section headers with clearer expand/collapse affordance

**File:** `src/components/funnel/steps/QualificationStep.tsx`

- Add "Tap to expand" hint text or a more prominent chevron with animation
- Add a colored left border accent to the active section (e.g., `border-l-4 border-l-blue-500`)
- Style the "Continue" links inside sections as small filled buttons instead of plain text links

### Fix 7: Improve channel selection visual feedback

**File:** `src/components/funnel/steps/SegmentChannelStep.tsx`

- Add a count badge: "3 of 4 selected" below the channel list
- Make the checkmark inside the checkbox larger and use an animation on toggle

---

## Technical Details

### Why V3Button Was Invisible

The V3Button component uses CSS variable-based styling:
```css
bg-[hsl(var(--portal-accent-blue))]
```

These variables are defined in `src/styles/portal-theme.css` under the `.portal-theme` selector. Without this class in the DOM ancestor chain, `hsl(var(--portal-accent-blue))` evaluates to an invalid value, and the browser renders no background color at all. The white text on the dark background makes the button text barely visible, appearing as a non-interactive label.

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Experience.tsx` | Add `portal-theme dark` class to root div |
| `src/components/funnel/FunnelContainer.tsx` | Replace ChevronUp with ArrowLeft, add "Back" label |
| `src/components/funnel/steps/WelcomeStep.tsx` | Add explicit button colors, strengthen "Next:" hint |
| `src/components/funnel/steps/SegmentChannelStep.tsx` | Add selected checkmark, channel count badge, stronger CTA |
| `src/components/funnel/steps/CommercialOpportunityStep.tsx` | Explicit button colors, stronger "Next:" hint |
| `src/components/funnel/steps/PoliticalOpportunityStep.tsx` | Explicit button colors, stronger "Next:" hint |
| `src/components/funnel/steps/CommercialProofStep.tsx` | Explicit button colors, stronger "Next:" hint |
| `src/components/funnel/steps/PoliticalProofStep.tsx` | Explicit button colors, stronger "Next:" hint |
| `src/components/funnel/steps/QualificationStep.tsx` | Accordion affordance, "Continue" as button, explicit submit styling |
| `src/components/funnel/steps/ThankYouStep.tsx` | No CTA changes needed (final step) |

### No Functional Changes

All analytics, hooks, database calls, and edge functions remain untouched. These are purely visual and interaction design fixes.
