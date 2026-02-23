
# Molitico Branding Integration and Visual Gap Fix

## Problem

The landing page currently uses **"Mojo"** as the brand name in 6 places, but the actual organization is **Molitico**. Additionally, 3 sections (CTV, Digital, Direct Mail channels and the SegmentPreview cards) have no supporting images -- they only show Lucide icons. The page also doesn't use the main site's signature Bebas Neue typography for the brand wordmark.

## Branding Fixes (Mojo to Molitico)

Every instance of "Mojo" will be replaced with "Molitico":

| Location | Current | Updated |
|----------|---------|---------|
| `LandingNav.tsx` line 13 | "Mojo" | "MOLITICO" (using `font-bebas` to match main site nav) |
| `LandingFooter.tsx` line 5 | "Mojo. All rights reserved." | "Molitico. All rights reserved." |
| `ProblemSection.tsx` line 67 | "With Mojo" | "With Molitico" |
| `ProblemSection.tsx` comment line 38 | "Without Mojo" | (comment only, but will fix for consistency) |
| `ReportPreview.tsx` line 41 | "app.mojo.co/report/your-organization" | "app.molitico.com/report/your-organization" |
| `GetStarted.tsx` line 30 | Helmet title contains "Mojo" | Replace with "Molitico" |

## Visual Gaps -- Missing Images

Three channel cards (CTV, Digital, Direct Mail) in `ChannelShowcase.tsx` and both segment cards in `SegmentPreview.tsx` currently show only icons with no supporting imagery. The existing assets in the project don't cover these specific use cases.

### Solution: Generate images using AI

Use the Lovable AI image generation API (google/gemini-2.5-flash-image) via an edge function to create dark-themed, cinematic visuals that match the page aesthetic (dark navy `#0a0f1a` background, blue/emerald accent tones):

| Image | Description | Used In |
|-------|-------------|---------|
| CTV channel thumbnail | A living room with a large screen showing a streaming ad, dark cinematic lighting | `ChannelShowcase.tsx` CTV card |
| Digital channel thumbnail | A laptop/phone showing programmatic display ads, dark tech aesthetic | `ChannelShowcase.tsx` Digital card |
| Direct Mail thumbnail | A stylized direct mail piece on a dark surface, premium feel | `ChannelShowcase.tsx` Direct Mail card |

These will be generated once, saved to storage, and referenced as static URLs -- no runtime image generation.

For the `SegmentPreview.tsx` cards, instead of adding photos, we'll enhance them with subtle background imagery using existing assets:
- **Commercial card**: Use a subtle, darkened crop of the Times Square billboard (`billboard-times-square-wide.jpg`) as a background
- **Political card**: Use a subtle, darkened crop of the rally photo (`hero-movement-rally.jpg`) as a background

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/landing/LandingNav.tsx` | Replace "Mojo" with "MOLITICO" using `font-bebas` class |
| `src/components/landing/LandingFooter.tsx` | Replace "Mojo" with "Molitico" |
| `src/components/landing/ProblemSection.tsx` | Replace "With Mojo" with "With Molitico" |
| `src/components/landing/ReportPreview.tsx` | Replace "app.mojo.co" with "app.molitico.com" |
| `src/pages/GetStarted.tsx` | Update Helmet title from "Mojo" to "Molitico" |
| `src/components/landing/ChannelShowcase.tsx` | Add generated images for CTV, Digital, and Direct Mail cards |
| `src/components/landing/SegmentPreview.tsx` | Add subtle background images to Commercial and Political cards using existing assets |

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/generate-landing-images/index.ts` | One-time edge function to generate the 3 missing channel images using AI and save them to storage |

## Technical Approach

1. Brand text replacements are straightforward string changes
2. Nav wordmark will use `font-bebas` class (already available globally via `index.css`) with uppercase tracking to match the main site's `Navigation.tsx` styling
3. For the 3 missing channel images, create a one-time edge function that generates them via the AI image API, saves to a storage bucket, and returns public URLs. Then hardcode those URLs into the channel cards
4. SegmentPreview backgrounds will use the existing imported images with a heavy dark overlay (opacity ~10-15%) so text remains readable
5. All new images use `loading="lazy"` for performance
