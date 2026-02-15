
# WelcomeStep Redesign: Mobile-First + Desktop-Optimized

## Problem Summary

The current Step 0 has 7 critical conversion friction points: cryptic headline, vague CTA, form fields before value exchange, no trust signals near form, wasted desktop space, intimidating 6-step progress, and a novelty font that undermines B2B credibility.

## Changes

### 1. WelcomeStep Layout Overhaul

**File:** `src/components/funnel/steps/WelcomeStep.tsx`

**Mobile layout (single column, top-to-bottom):**
1. Headline (clean sans-serif, not condensed/novelty font)
2. Subheadline with specific number
3. Value proposition checklist (what you'll get) -- moved ABOVE form
4. Social proof ("50+ organizations")
5. Form fields (email, org)
6. Trust micro-copy: lock icon + "Your data stays private. No spam."
7. CTA button with specific action text
8. "Next:" hint

**Desktop layout (two columns via `md:grid md:grid-cols-2`):**
- Left column: Headline, subheadline, value props, social proof, trust badges
- Right column: Form card with fields, CTA, trust micro-copy
- This fills the viewport and creates a professional landing page feel

**Copy changes (defaults when no variant content loaded):**
- Headline: `"$170.8 Billion. One Platform."` (keep the strong default -- the variant system will swap in test copy like "THE MARKET LEADERS CAN'T SEE" for A/B testing)
- CTA: `"Get My Free Report"` instead of `"Get Started"` or `"Show Me How"` -- specific, value-oriented
- Add trust line below CTA: lock icon + "Your data stays private. No spam, ever."

**Font fix:**
- Override the headline with `font-sans` (Tailwind's system sans-serif stack) to ensure it renders in a clean, professional typeface regardless of global styles. The `tracking-tight` stays for density.

### 2. Desktop-Aware Container

**File:** `src/components/funnel/FunnelContainer.tsx`

- Add `justify-center` to the flex container so content is vertically centered on desktop (currently top-aligned with `pt-12`)
- On desktop, reduce top padding since the two-column layout fills more space naturally

### 3. Progress Bar Simplification

**File:** `src/components/funnel/FunnelProgress.tsx`

- On mobile: Show only a thin progress bar (percentage-based) instead of 6 labeled dots. This reduces cognitive load. Example: a single line that fills from 0% to 100% as the user progresses.
- On desktop: Keep the labeled steps but reduce to 4 visible labels by combining "Opportunity" + "Proof" into "Discover" -- fewer steps = less intimidation.
- Hide progress entirely on Step 0 (the welcome step) so the landing page feels clean and unburdened. Show it starting from Step 1.

### 4. Strengthened "Next:" Hints Across All Steps

**Files:** All step components

Current hints say things like "Next: Choose your path" which is procedural. Change to benefit-oriented:
- Step 0: "Next: Choose your path" (keep -- it's already good)
- Step 1: "Next: See your market opportunity" (already good)
- Step 2: "Next: See our proof" -> "Next: See real results"
- Step 3: "Next: Get your strategy" -> "Next: Build your custom plan"
- Step 4: (no next hint -- it's the submit step)

### 5. Trust Signal Component

**New element inside WelcomeStep** (not a separate file -- just JSX):
- A small line below the CTA: `Shield` icon + "Your data stays private. No spam, ever." in `text-[#7c8ba3] text-xs`
- This addresses the #1 concern B2B users have when giving their work email to an unknown platform

### 6. Political Path CTA Consistency

**Files:** `PoliticalOpportunityStep.tsx`, `PoliticalProofStep.tsx`

The political path uses emerald buttons which is correct. No change needed to those colors. But the CTA copy "Qualify My Campaign" should stay specific and benefit-oriented.

---

## Technical Details

### Responsive Two-Column Layout (WelcomeStep)

The key structural change. On mobile (`< md`), everything stacks vertically in this order: headline, subheadline, value props, form, trust line. On desktop (`>= md`), it becomes a two-column grid:

```
Left column                    Right column
---------------------------    ---------------------------
Headline                       [Form Card]
Subheadline                      Work email
Value prop checklist             Organization name
Social proof (50+ orgs)          [Get My Free Report]
                                 Lock icon + trust copy
                                 Next: Choose your path ->
```

The form card on desktop gets a subtle card treatment (`bg-[#141b2d] border border-[#1e2a45] rounded-2xl p-6`) to visually separate it and draw the eye.

### Progress Bar Changes

Replace the 6 dots with a minimal bar on mobile:
- A thin `h-1` bar at the very bottom of the screen
- Fill width = `(currentStep / (totalSteps - 1)) * 100%`
- Color: blue-500 gradient
- No labels, no numbers -- just a visual cue of progress

On desktop, keep the current labeled approach but hide it on Step 0.

### Font Override

Add `font-sans` to the h1 element. Tailwind's `font-sans` resolves to the system UI font stack (Inter, -apple-system, etc.) which is exactly what high-converting B2B pages use.

### Files Modified

| File | Change |
|------|--------|
| `src/components/funnel/steps/WelcomeStep.tsx` | Two-column desktop layout, reordered content hierarchy, specific CTA copy, trust signal, font-sans on headline |
| `src/components/funnel/FunnelContainer.tsx` | Vertical centering on desktop, reduced top padding |
| `src/components/funnel/FunnelProgress.tsx` | Mobile: thin bar instead of dots. Hide on Step 0. |
| `src/components/funnel/steps/CommercialProofStep.tsx` | "Next" hint copy tweak |
| `src/components/funnel/steps/PoliticalProofStep.tsx` | "Next" hint copy tweak |
| `src/components/funnel/steps/CommercialOpportunityStep.tsx` | "Next" hint copy tweak |
| `src/components/funnel/steps/PoliticalOpportunityStep.tsx` | "Next" hint copy tweak |

### No Functional/Backend Changes

All analytics, hooks, database calls, edge functions, and self-learning infrastructure remain untouched. These are purely layout, copy, and visual hierarchy improvements.
