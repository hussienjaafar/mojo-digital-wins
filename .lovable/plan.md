
# Redesign: Apply V3 Design System to the `/experience` Funnel

## Overview
Restyle all 8 funnel step components, the FunnelContainer, FunnelProgress, and Experience.tsx to use the V3 design system's CSS variables, components, and the voter impact map's dark aesthetic (`#0a0f1a` base, `#141b2d` card surfaces, `#1e2a45` borders, `backdrop-blur-md`).

---

## Design Language (Sourced from Voter Impact Map + V3 System)

| Element | Current Style | New Style |
|---------|--------------|-----------|
| Page background | `bg-[#0a0f1a]` (already correct) | Keep as-is |
| Card surfaces | `bg-white/5 border-white/10` | `bg-[#141b2d] border-[#1e2a45]` |
| Elevated surfaces | `bg-white/10` | `bg-[#141b2d]/80 backdrop-blur-md border-[#1e2a45]` |
| Input fields | `bg-white/10 border-white/20` | `bg-[#141b2d] border-[#1e2a45] focus:border-blue-500/50 focus:ring-blue-500/20` |
| Primary text | `text-white` | `text-[#e2e8f0]` |
| Secondary text | `text-white/60` | `text-[#94a3b8]` |
| Muted text | `text-white/40` | `text-[#64748b]` |
| Primary CTA button | Raw gradient classes | Use `V3Button` component with `variant="primary"` and `size="xl"` |
| Secondary/toggle buttons | Raw inline classes | Use V3 portal-card pattern with proper hover states |
| Badges | Raw colored text | Use `V3Badge` component with appropriate variants |
| Checkbox indicators | Raw SVG + manual styling | Portal-style with `border-[#1e2a45]` and accent fill |
| Progress dots | Raw dots | Styled to match `#1e2a45` inactive / blue-500 active |

---

## Files Modified (10 files)

### 1. `src/pages/Experience.tsx`
- Wrap content in `portal-theme dark` class wrapper so V3 CSS variables resolve correctly
- No other changes needed (layout is already correct)

### 2. `src/components/funnel/FunnelContainer.tsx`
- No structural changes needed (scrolling fix is already in place)
- Keep existing animation and swipe logic

### 3. `src/components/funnel/FunnelProgress.tsx`
- Inactive dots: `bg-[#1e2a45]` instead of `bg-white/20`
- Past dots: `bg-[#94a3b8]` instead of `bg-white/60`
- Active dot: `bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]` (glow effect matching voter map's active indicator)

### 4. `src/components/funnel/steps/WelcomeStep.tsx`
- Video container: `bg-[#141b2d] border border-[#1e2a45]` instead of `bg-white/5 border-white/10`
- Caption badge: `bg-[#141b2d]/90 border border-[#1e2a45] text-[#e2e8f0]`
- Headline: `text-[#e2e8f0]` instead of `text-white`
- Subheadline: `text-[#94a3b8]` instead of `text-white/60`
- Inputs: `bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b] focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20`
- CTA: Replace raw button with imported `V3Button variant="primary" size="xl"` with full width

### 5. `src/components/funnel/steps/SegmentChannelStep.tsx`
- Segment cards: `bg-[#141b2d] border-[#1e2a45]` base; selected commercial: `border-blue-500/50 bg-blue-500/10`; selected political: `border-emerald-500/50 bg-emerald-500/10`; hover: `hover:border-[#2d3b55]`
- Card text: primary `text-[#e2e8f0]`, secondary `text-[#64748b]`
- Channel checkboxes: `bg-[#141b2d] border-[#1e2a45]`; selected: `border-blue-500/50 bg-blue-500/10`
- Checkbox indicator box: `border-[#1e2a45]` inactive, `border-blue-500 bg-blue-500` active
- CTA: `V3Button variant="primary" size="xl"` full width

### 6. `src/components/funnel/steps/CommercialOpportunityStep.tsx`
- Stat cards: `bg-[#141b2d] border border-[#1e2a45] rounded-xl` (matching voter map sidebar cards)
- Stat values: keep accent colors (`text-blue-400`)
- Stat labels: `text-[#94a3b8]`
- Section label: `text-[#64748b]`
- Icon coverage items: `text-[#94a3b8]`
- CTA: `V3Button`

### 7. `src/components/funnel/steps/PoliticalOpportunityStep.tsx`
- Same card pattern as Commercial but with emerald accents
- Stat cards, labels, section labels follow the same `#141b2d` / `#1e2a45` / `#94a3b8` palette
- CTA: `V3Button variant="success" size="xl"` (emerald primary action for political path)

### 8. `src/components/funnel/steps/CommercialProofStep.tsx`
- Badge rows: `bg-[#141b2d] border border-[#1e2a45]` instead of `bg-white/5 border-white/10`
- Badge text: `text-[#e2e8f0]`
- "Cultural Authenticity" footer: `text-[#64748b]`
- CTA: `V3Button`

### 9. `src/components/funnel/steps/PoliticalProofStep.tsx`
- Same card pattern as Commercial Proof
- FEC disclaimer box: `bg-amber-500/10 border border-amber-500/30` (keep as-is, already good)
- Disclaimer text: keep `text-amber-300/90`
- Disabled button: `V3Button` with `disabled` prop (natural V3 disabled state)
- Timer text rendered inside button label

### 10. `src/components/funnel/steps/QualificationStep.tsx`
- All inputs: `bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]`
- Decision maker toggle: `bg-[#141b2d] border-[#1e2a45]`; active track: `bg-blue-500`; inactive track: `bg-[#1e2a45]`
- KPI checkboxes: same pattern as SegmentChannelStep checkboxes
- Budget buttons: keep color-coded gradients for selected state; unselected: `bg-[#141b2d] border border-[#1e2a45] hover:border-[#2d3b55]`
- Error text: `text-red-400` (keep)
- Section labels: `text-[#94a3b8]`
- Submit CTA: `V3Button variant="primary" size="xl"`

### 11. `src/components/funnel/steps/ThankYouStep.tsx`
- Icon circles: `bg-[#141b2d] border border-[#1e2a45]` with accent glow (`shadow-[0_0_20px_rgba(59,130,246,0.2)]` for blue, emerald equivalent for calendar)
- Text: `text-[#e2e8f0]` primary, `text-[#94a3b8]` secondary, `text-[#64748b]` muted
- Social link icons: `text-[#64748b] hover:text-[#e2e8f0]`

---

## Technical Details

### V3Button Integration
Import `V3Button` from `@/components/v3` in each step component. Replace all raw `<button>` CTA elements with:
```tsx
<V3Button variant="primary" size="xl" className="w-full" onClick={onNext}>
  {cta}
</V3Button>
```

For the political path (emerald CTAs), use `variant="success"`. For disabled states (FEC timer), pass `disabled={!canProceed}`.

### Color Constants
Define a shared constant file `src/components/funnel/funnelTheme.ts` to avoid hardcoding hex values in every file:
```typescript
export const FUNNEL = {
  bg: '#0a0f1a',
  card: '#141b2d',
  border: '#1e2a45',
  borderHover: '#2d3b55',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
} as const;

export const inputClass = `w-full h-14 px-4 rounded-xl bg-[${FUNNEL.card}] border border-[${FUNNEL.border}] text-[${FUNNEL.textPrimary}] placeholder:text-[${FUNNEL.textMuted}] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-base transition-colors`;
```

Note: Since Tailwind requires full class strings at build time (no interpolation), the input class and card classes will be written as full literal strings in each component rather than using template interpolation. The theme file serves as documentation and a single source of truth for the hex values.

### No Functional Changes
- All hooks, analytics, edge function calls, and state management remain untouched
- Only visual styling changes (className updates and V3Button imports)
- Framer Motion animations remain identical
- All touch targets remain 48px minimum

### Performance Impact
- Zero bundle size increase (V3Button is already in the bundle from the dashboard)
- No new dependencies
- No layout shifts (same dimensions, just color changes)
