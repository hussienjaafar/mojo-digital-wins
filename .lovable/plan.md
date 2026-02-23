

# Fix: Eliminate /experience Navigation Delay

## Root Cause Analysis

Three things happen sequentially when a user clicks "Get My Free Report":

1. `navigate("/experience")` fires
2. React unmounts GetStarted, the `PageTransition` wrapper re-keys and triggers an **0.8s fade-in-up animation**
3. Since Experience is `React.lazy()`, a **Suspense fallback (full-screen spinner)** shows while the browser downloads the Experience JS chunk over the network
4. Only after the chunk loads does the Experience page mount and initialize its **6+ hooks** (session, analytics, variants, etc.)

Total perceived delay: network latency + 0.8s animation + hook initialization = easily 1-2+ seconds of friction.

## Solution: Three Changes, Zero New Dependencies

### 1. Prefetch the Experience chunk on GetStarted mount

Instead of waiting for the click, start downloading the Experience JS bundle as soon as the landing page loads. By the time the user scrolls and clicks the CTA, the chunk is already cached.

**File: `src/pages/GetStarted.tsx`**
- Add a `useEffect` that calls `import("./Experience")` on mount (fire-and-forget)
- This silently downloads and caches the chunk in the background
- Zero visual impact, the user never sees anything

### 2. Skip the page transition for /experience navigation

The 0.8s fade-in-up animation adds unnecessary delay for a high-intent conversion click.

**File: `src/components/PageTransition.tsx`**
- Check if the current path is `/experience`
- If so, skip the animation (render children directly without the `animate-fade-in-up` class)
- All other routes keep their existing transition

### 3. Replace the heavy Suspense spinner with an instant skeleton

Instead of a full-screen spinner that feels like "loading", show a minimal dark background that matches the Experience page aesthetic so the transition feels seamless.

**File: `src/App.tsx`**
- Create a lightweight `ExperienceSkeleton` component (just a dark `#0a0f1a` background div with a subtle progress bar)
- Use a route-aware Suspense fallback: if navigating to `/experience`, use the skeleton; otherwise use the existing `PageLoader`

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/GetStarted.tsx` | Add `useEffect(() => { import("./Experience"); }, [])` to prefetch the chunk |
| `src/components/PageTransition.tsx` | Skip animation for `/experience` route |
| `src/App.tsx` | Add a lightweight dark skeleton fallback for the Experience route, replacing the generic spinner |

## Expected Result

- **Before**: Click CTA, see spinner for 0.5-2s, then 0.8s animation, then page appears
- **After**: Click CTA, page appears almost instantly (chunk already cached, no animation delay, seamless dark background transition)

## Technical Details

The prefetch pattern `import("./Experience")` works because Vite/webpack returns the same promise for repeated dynamic imports -- the module is fetched once and cached. When React.lazy later resolves the same import, it hits the cache instantly.

No new dependencies are needed. All changes use existing React and router APIs.
