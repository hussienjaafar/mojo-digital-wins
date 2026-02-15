

# Fix: QualificationStep Layout -- Remove Nested Scroll, Inline Into Page

## Problem

The QualificationStep is rendered inside FunnelContainer's animated `motion.div` which uses `absolute inset-0` positioning. This creates:
1. A visible scrollbar from the nested `overflow-y-auto` + `max-h-[calc(100vh-120px)]` on the step itself
2. Content getting cut off at the bottom (budget options, submit button)
3. The fixed "Back" button overlapping the headline text

## Solution

Make the QualificationStep (step 4) render as a **full-page inline layout** that owns its own scrolling, bypassing the FunnelContainer's animated wrapper entirely. The step will use the full viewport height, have its own back button integrated into the layout (not fixed/overlapping), and scroll naturally without a nested scroll container.

## Changes

### 1. Experience.tsx -- Render QualificationStep outside FunnelContainer

When `currentStep === 4`, render the QualificationStep directly in the page div instead of inside FunnelContainer. This removes the `absolute inset-0` wrapper and its competing scroll context.

The FunnelContainer will still be used for steps 0-3 and step 5 (ThankYou). Step 4 gets its own full-page treatment.

Similarly, when `currentStep === 5` (ThankYou), keep it in FunnelContainer as-is since it's a short page.

### 2. QualificationStep.tsx -- Remove scroll constraints, add integrated back button

- Remove `overflow-y-auto max-h-[calc(100vh-120px)]` from the root div -- the page itself will scroll naturally via `overflow-y-auto` on the parent
- Change root container to `min-h-screen` with proper top/bottom padding (`pt-6 pb-10`) so content flows naturally
- Add an inline back button at the top of the component (not fixed/overlapping) that calls `onBack`
- Add `onBack` to the component's props

### 3. FunnelContainer.tsx -- Hide back button when step is rendered outside

The back button in FunnelContainer won't show for step 4 since the QualificationStep won't be rendered inside it. No change needed to FunnelContainer itself.

---

## Technical Details

### Experience.tsx Changes

Replace the current single-render approach with conditional rendering:

```text
currentStep === 4:
  Render QualificationStep directly in the page div (not inside FunnelContainer)
  with its own onBack handler and full-viewport scrolling

all other steps:
  Render inside FunnelContainer as before
```

The QualificationStep will be wrapped in a simple `div` with `overflow-y-auto h-full` so the entire page scrolls as one document, not a nested iframe-like box.

### QualificationStep.tsx Changes

- Add `onBack?: () => void` to props
- Root div: change from `overflow-y-auto max-h-[calc(100vh-120px)] pb-20 px-4` to `min-h-full pb-10 px-4 pt-6`
- Add an inline back button at the very top (before the headline), styled consistently with the rest of the funnel but not fixed-position:
  ```text
  <button onClick={onBack}>
    <ArrowLeft /> Back
  </button>
  ```
- This button sits in the document flow, so it never overlaps the headline

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/Experience.tsx` | Render step 4 outside FunnelContainer; pass `onBack` to QualificationStep |
| `src/components/funnel/steps/QualificationStep.tsx` | Accept `onBack` prop, add inline back button, remove nested scroll constraints |

### No Backend Changes

Purely layout/CSS changes. All analytics, database, and edge function logic remains untouched.

