

# Fix: Scrolling, Button Visibility, and Segment-Aware KPIs

## Problem Summary
Three issues on the `/experience` funnel:
1. Steps with tall content (Step 1 and Step 4) cannot scroll because the container blocks it
2. The "Continue" button gets cut off at the bottom of the viewport
3. The KPI options on Step 4 are static -- they show all options regardless of whether the user selected Commercial or Political

---

## Fix 1: Enable Scrolling in FunnelContainer

**File: `src/components/funnel/FunnelContainer.tsx`**

The motion.div currently uses `absolute inset-0` with `justify-center` and the parent has `overflow-hidden`. This prevents any child from scrolling.

Changes:
- Change the motion.div from `justify-center` to `justify-start` with top padding, and add `overflow-y-auto` so tall content can scroll
- Keep `overflow-hidden` on the outer wrapper (needed for slide animation clipping) but allow the inner animated div to scroll independently
- Add padding-bottom to ensure the progress dots and any bottom content remain visible

The updated class on the motion.div (line 83):
```
"absolute inset-0 flex flex-col items-center px-5 pt-12 pb-24 overflow-y-auto will-change-transform"
```

This removes `justify-center` (which fights with scroll), adds `pt-12` for top breathing room, `pb-24` for bottom clearance past the progress dots, and `overflow-y-auto` to enable scrolling.

---

## Fix 2: SegmentChannelStep Scroll Safety

**File: `src/components/funnel/steps/SegmentChannelStep.tsx`**

The step itself doesn't need its own scroll container since FunnelContainer will now handle scrolling. However, add bottom padding to ensure the Continue button isn't clipped:
- Add `pb-8` to the outer div to give extra spacing at the bottom

---

## Fix 3: Segment-Aware KPI Options

**File: `src/components/funnel/steps/QualificationStep.tsx`**

Replace the static `KPI_OPTIONS` array with segment-driven options:

**Commercial KPIs:**
- ROAS
- Cost Per Acquisition
- Cost Per Verified Patient
- Brand Lift

**Political KPIs:**
- Voter Persuasion Lift
- Donor Lifetime Value
- Cost Per Acquisition
- Voter Registration Rate

The component already receives `segment` as a prop. Add logic to select the right KPI list based on the segment value, with a shared fallback if segment is null.

```typescript
const COMMERCIAL_KPIS = [
  'ROAS',
  'Cost Per Acquisition',
  'Cost Per Verified Patient',
  'Brand Lift',
];

const POLITICAL_KPIS = [
  'Voter Persuasion Lift',
  'Donor Lifetime Value',
  'Cost Per Acquisition',
  'Voter Registration Rate',
];

// In the component:
const kpiOptions = segment === 'political' ? POLITICAL_KPIS : COMMERCIAL_KPIS;
```

Then use `kpiOptions` instead of `KPI_OPTIONS` in the render loop. Also reset the selected KPIs if the segment changes (unlikely mid-step, but defensive).

---

## Technical Details

### Files Modified
1. **`src/components/funnel/FunnelContainer.tsx`** -- Remove `justify-center`, add `overflow-y-auto`, `pt-12`, `pb-24`
2. **`src/components/funnel/steps/SegmentChannelStep.tsx`** -- Add `pb-8` bottom padding
3. **`src/components/funnel/steps/QualificationStep.tsx`** -- Replace static KPI list with segment-driven lists

### No Breaking Changes
- The swipe gesture still works on the scroll container (touch events remain on the outer div)
- The keyboard navigation is unaffected
- The Framer Motion slide animations clip correctly since the outer wrapper retains `overflow-hidden`

