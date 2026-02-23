

# Integrate Real Case Studies, Logos, and Testimonials into the Landing Page

## Problem
The `/get-started` landing page currently uses placeholder content:
- **LogoBar**: Generic text labels like "National Campaigns", "CPG Brands" instead of real client logos
- **TestimonialsSection**: Fabricated quotes from unnamed sources instead of the real testimonials already in `src/data/caseStudies.ts`
- **StatsSection**: Placeholder numbers instead of proven metrics from actual case studies

## What Changes

### 1. LogoBar -- Real Client Logos (Scrolling Marquee)

Replace the generic text pills with actual client logo images already imported in `src/components/ClientLogos.tsx`:

- Abdul for U.S. Senate
- Unity & Justice Fund
- Nasser for Michigan
- Preston For PA
- Rashid for Illinois
- CAIR Action
- MPAC
- The Truth Project
- A New Policy

Each logo will be rendered as an image (with a brightness/invert filter for dark background visibility), scrolling in the existing marquee animation.

### 2. TestimonialsSection -- Real Client Testimonials

Replace the 3 fabricated quotes with real testimonials from `caseStudies.ts`. There are 5 case studies with testimonials:

| Client | Quote Author | Stat |
|--------|-------------|------|
| Unity & Justice Fund | Campaign Leadership | 947% ROI |
| Nasser for Michigan | Campaign Manager | 325% ROI |
| Rashid for Illinois | State Rep. Rashid | 415% ROI |
| Arab-American Non-profit | Executive Director | 304% ROI |
| A New Policy | Founding Director | 289% ROI |

The section will import from `caseStudies` and filter for entries that have a `testimonial` property, showing 3 featured ones.

### 3. StatsSection -- Real Aggregate Numbers

Update stats to reflect actual proven results:
- **$2.7M+** raised across campaigns (sum of documented raises)
- **13,500+** new donors acquired (sum from case studies)
- **5+** channels (CTV, Digital, Direct Mail, OOH, SMS)
- **947%** peak ROI (Unity & Justice Fund)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/landing/LogoBar.tsx` | Import real logo assets, render as images in the scrolling marquee with dark-mode-compatible styling |
| `src/components/landing/TestimonialsSection.tsx` | Import `caseStudies` data, use real testimonials instead of hardcoded placeholders |
| `src/components/landing/StatsSection.tsx` | Update stat values to reflect real aggregate metrics from case studies |

## Technical Details

- Logo images are already in `src/assets/` and imported in `ClientLogos.tsx` -- we reuse the same imports
- Logos get a `brightness-0 invert` CSS filter so they display as white on the dark landing page background
- Testimonials are pulled directly from the `caseStudies` array by filtering for `study.testimonial`
- No new dependencies or database changes needed

