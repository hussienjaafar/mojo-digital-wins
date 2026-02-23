
# Visual Audit: Landing Page Graphics Gap Analysis

## Current State

The `/get-started` landing page uses **zero photographs, zero screenshots, and zero product visuals**. Every section relies entirely on text, Lucide icons, and CSS gradients. This is a significant conversion weakness -- research consistently shows that pages with relevant imagery convert 40-65% better than text-only pages.

## Available Assets (Already in the Project, Unused)

The project already contains substantial visual assets that are used on the main marketing site but completely absent from the landing page:

| Asset | File | Currently Used On |
|-------|------|-------------------|
| Hero rally photo | `hero-movement-rally.jpg` | Main site homepage |
| Hero movement photo | `hero-movement.jpg` | Main site homepage |
| Times Square billboard (wide) | `billboard-times-square-wide.jpg` | Services page |
| Times Square billboard (medium) | `billboard-times-square-medium.jpg` | Services page |
| Bus billboard (Mamdani) | `billboard-mamdani-bus.webp` | Services page |
| SMS mockup | `sms-mockup.jpg` | Not used anywhere |
| 7 campaign images | Various `.png/.webp/.jpg` | Case studies page |

## What's Missing vs. What We Can Fix

### Fix Now (Using Existing Assets)

**1. Hero Section -- Add a Background or Side Image**
The hero is pure dark gradient. Adding the `hero-movement-rally.jpg` as a subtle background with a dark overlay would immediately add emotional weight and visual interest without needing new photography.

**2. Channel Showcase -- Add Real Creative Examples**
The 5 channel cards (CTV, Digital, Mail, OOH, SMS) are icon-only. We already have:
- **OOH**: Times Square billboard photo and bus wrap photo
- **SMS**: SMS mockup screenshot
- These can be added as small thumbnail previews inside or adjacent to the channel cards, turning abstract descriptions into concrete visual proof

**3. Testimonials -- Add Campaign Images**
Each testimonial maps to a case study that already has a campaign image. Adding these as small thumbnails or background elements next to the quotes adds visual credibility and breaks up the text-heavy layout.

**4. Problem Section -- Add a Visual**
The problem agitation section is text-only. A simple graphic (e.g., a stylized chart showing wasted spend vs. optimized spend) would reinforce the message visually. This can be built with CSS/SVG -- no photo needed.

### Needs New Assets (Recommendations)

**5. Product/Report Preview Mockup (HIGH PRIORITY)**
The single most impactful missing visual is a preview of what the "free audience report" actually looks like. Every high-converting B2B landing page shows the deliverable. Currently there is no screenshot, mockup, or preview of the report anywhere. This could be:
- A styled screenshot of the actual opportunity report from the funnel
- A browser-frame mockup showing sample data
- Generated using AI image generation as a placeholder

**6. Channel Creative Samples (MEDIUM PRIORITY)**  
The `creative-examples/` directory exists but is empty. Real samples of SMS texts, email campaigns, display ads, and direct mail pieces would make the channel showcase section dramatically more persuasive.

## Proposed Changes

### Files to Modify

| File | Change |
|------|--------|
| `src/components/landing/HeroSection.tsx` | Add `hero-movement-rally.jpg` as a background image with dark gradient overlay |
| `src/components/landing/ChannelShowcase.tsx` | Add thumbnail images for OOH (billboard photos) and SMS (mockup) channels |
| `src/components/landing/TestimonialsSection.tsx` | Add campaign images from case studies alongside testimonial quotes |
| `src/components/landing/ProblemSection.tsx` | Add a simple CSS/SVG visual illustrating wasted spend |

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/landing/ReportPreview.tsx` | A mockup component showing what the free audience report looks like -- styled as a browser frame with sample data pulled from the existing funnel UI patterns |

### Page Assembly Update

| File | Change |
|------|--------|
| `src/pages/GetStarted.tsx` | Add `ReportPreview` component between HowItWorks and SegmentPreview sections |

## Impact Summary

- **Hero background image**: Adds emotional resonance and professional feel (existing asset, low effort)
- **Channel thumbnails**: Transforms abstract descriptions into concrete visual proof (existing assets, medium effort)  
- **Testimonial images**: Adds faces/campaigns to quotes for 35%+ higher trust (existing assets, low effort)
- **Report preview mockup**: The single highest-impact addition -- shows the deliverable before asking for conversion (new component, medium effort)
- **Problem section graphic**: Minor visual polish to break up text (CSS-only, low effort)

## Technical Approach

- All existing images will use lazy loading via standard `loading="lazy"` attributes
- Hero background will use CSS `background-image` with a gradient overlay for text readability on the dark theme
- Channel thumbnails will use `object-fit: cover` with rounded corners to match the existing card design
- Report preview will be a styled component reusing design patterns from the existing funnel UI (dark cards, blue/emerald accents)
- No new dependencies needed -- all work uses existing imports and Framer Motion for animations
