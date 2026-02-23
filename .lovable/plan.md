

# Hero Animation: Replace Photo with Interactive Particle Network

## The Approach

No, the hero image is not necessary. We'll replace it with a **canvas-based interactive particle network animation** -- floating nodes connected by lines that react to mouse movement. This is the most widely used premium hero animation pattern in 2025 SaaS/B2B landing pages (used by Vercel, Linear, Stripe, and countless high-end sites). It's performant, looks striking on the dark `#0a0f1a` background, and reinforces the "data network / audience intelligence" brand metaphor.

## Why a Canvas Particle Network (Not Three.js)

Three options were considered:

| Option | Pros | Cons |
|--------|------|------|
| **Three.js / R3F 3D scene** | Impressive 3D globe or mesh | Heavy bundle (~150KB+), GPU-intensive on mobile, complex to maintain |
| **tsParticles library** | Easy config, lots of presets | Large dependency (~80KB), adds npm bloat, limited customization |
| **Custom Canvas2D particle system** | Zero dependencies, tiny (~3KB), full control, perfect performance | Needs to be written from scratch |

**Recommendation: Custom Canvas2D** -- zero new dependencies (the project already has enough), complete creative control over colors/density/behavior, and the best mobile performance. It will render 80-120 floating nodes with connecting lines, subtle mouse repulsion/attraction, and a blue-to-emerald gradient glow -- all matching the existing page palette.

## What It Will Look Like

- **Dark navy background** (`#0a0f1a`) with no photo
- **60-100 floating particles** (small circles, 1-3px) in blue (`#3b82f6`) and emerald (`#34d399`) tones at low opacity
- **Connecting lines** between nearby particles (within ~150px), creating a network/constellation effect
- **Mouse interaction**: particles gently drift away from the cursor, creating a "parting" effect
- **Gradient glow orbs**: 2-3 large soft radial gradients (blue/emerald) floating slowly in the background for depth
- **Reduced motion support**: respects `prefers-reduced-motion` -- shows static dots only, no animation
- **Mobile optimization**: reduces particle count to 30-40 on screens under 768px

## Technical Plan

### New File: `src/components/landing/HeroParticleBackground.tsx`

A self-contained React component using a `<canvas>` element with `requestAnimationFrame` for smooth 60fps animation:

- Uses `useRef` for canvas element and animation state
- Uses `useEffect` for setup/teardown and resize handling
- Uses `useReducedMotion` hook (already exists in project) to disable animation for accessibility
- Mouse position tracked via `mousemove` event on the canvas
- Particles stored as a simple array of `{x, y, vx, vy, radius, opacity}` objects
- Each frame: update positions, check distances, draw connections, draw particles
- Colors pulled from the existing palette constants (blue-400, emerald-400)

### Modified File: `src/components/landing/HeroSection.tsx`

- Remove the `heroRally` image import and the `<img>` tag
- Replace the background `<div>` with `<HeroParticleBackground />`
- Keep the gradient overlay divs for the soft glow orbs (they complement the particles)
- All text content, CTA, risk reversal, and social proof remain unchanged

### No Other Files Affected

The particle background is entirely self-contained. No new npm dependencies. No changes to `tailwind.config.ts` or any other component.

## Performance Considerations

- Canvas is GPU-accelerated and far lighter than DOM-based particle solutions
- `requestAnimationFrame` ensures no unnecessary rendering
- Particle count scales down on mobile via `window.innerWidth` check
- Canvas resizes on window resize with proper `devicePixelRatio` handling for sharp rendering on Retina displays
- Animation pauses when tab is not visible (automatic with `requestAnimationFrame`)

