
# Fix: KPI Options & Padding/Overflow Issues Across Funnel

## Problem 1: KPI Options Too Restrictive & Industry-Specific

The current KPIs are narrowly scoped:

**Commercial** (current): ROAS, Cost Per Acquisition, Cost Per Verified Patient, Brand Lift
- "Cost Per Verified Patient" is healthcare-only -- irrelevant for CPG, Finance, or Retail users

**Political** (current): Voter Persuasion Lift, Donor Lifetime Value, Cost Per Acquisition, Voter Registration Rate
- "Voter Registration Rate" and "Voter Persuasion Lift" are very niche -- many political orgs care about broader awareness or fundraising ROI

### Fix

Replace both lists with broader, universally applicable KPIs. Keep them relevant to each segment but not locked to one industry vertical.

**Commercial KPIs (new):**
- ROAS (Return on Ad Spend)
- Cost Per Acquisition
- Brand Awareness / Lift
- Website Traffic / Conversions
- Audience Reach & Frequency

**Political KPIs (new):**
- Voter Awareness / Persuasion
- Donor Acquisition Cost
- Fundraising ROI
- Volunteer / Supporter Sign-ups
- Audience Reach & Frequency

Also add an "Other" option with a small text input so users with unique KPIs aren't boxed out.

---

## Problem 2: Padding & Overflow Issues

Visible in the screenshots:

1. **Stat cards on Opportunity steps (image 66)**: The 3-column grid with `p-4` and `text-2xl` values causes label text ("Annual Spending Power", "Cultural Relevance Factor") to wrap awkwardly in small cards. The `text-xs` labels don't have enough room.
   - Fix: Reduce stat value font size from `text-2xl` to `text-xl`, reduce card padding from `p-4` to `p-3`, and add `min-h-[80px]` for consistent card heights.

2. **Headline font (image 66)**: The "GENERATION M MEETS TOTAL MARKET SATURATION" headline is still rendering in a condensed/novelty font despite the earlier `font-sans` fix on the WelcomeStep. The Opportunity steps were not updated.
   - Fix: Add `font-sans` to the h2 in both CommercialOpportunityStep and PoliticalOpportunityStep.

3. **Coverage/Precision icons spacing (image 66)**: With 4-5 icons in a `flex gap-8`, the row is cramped on mobile. Labels truncate.
   - Fix: Reduce gap from `gap-8`/`gap-6` to `gap-4`, and use `text-[11px]` for icon labels to prevent wrapping.

4. **KPI checkbox buttons (images 65, 67)**: The KPI buttons span full width with `min-h-[48px]` and `p-3` which is fine, but on narrower screens the text can feel cramped against the checkbox.
   - Fix: Add `pl-4` to give the text more breathing room from the checkbox icon.

5. **QualificationStep container (images 65, 67)**: The `px-1` on the scrollable container gives almost no horizontal padding, causing content to sit flush against screen edges on mobile.
   - Fix: Change `px-1` to `px-4` for proper mobile margins.

---

## Technical Details

### Files Modified

| File | Changes |
|------|---------|
| `src/components/funnel/steps/QualificationStep.tsx` | New KPI lists, add "Other" KPI option with text input, fix container `px-1` to `px-4` |
| `src/components/funnel/steps/CommercialOpportunityStep.tsx` | Reduce stat card padding/font, add `font-sans` to headline, tighten icon gap |
| `src/components/funnel/steps/PoliticalOpportunityStep.tsx` | Same stat card and icon gap fixes |

### KPI "Other" Option Implementation

Add a special "Other" entry at the end of both KPI lists. When selected, a small `FunnelInput` appears below the KPI list for the user to type their custom KPI. Store the custom value in a `customKpi` state variable, and include it in the submitted `performanceKpis` array as `"Other: [user input]"`.

### Stat Card Overflow Fix

Current:
```
className="p-4 rounded-xl bg-[#141b2d] border border-[#1e2a45]"
<p className="text-2xl font-bold ...">
<p className="text-[#94a3b8] text-xs mt-1">
```

Proposed:
```
className="p-3 rounded-xl bg-[#141b2d] border border-[#1e2a45] min-h-[80px] flex flex-col items-center justify-center"
<p className="text-xl font-bold ...">
<p className="text-[#94a3b8] text-[11px] mt-1 leading-tight text-center">
```

This ensures labels like "Annual Spending Power" and "Cultural Relevance Factor" wrap gracefully within the card without overflowing.
