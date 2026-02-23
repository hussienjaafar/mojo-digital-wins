

# Add a Landing/Sales Page Before the Intake Funnel

## Why This Change

Research and competitive analysis show that cold Meta ad traffic converts significantly better when they see a value-driven landing page before being asked for personal information. Your current funnel (email capture on step 1) is optimized for warm traffic but creates friction for users who just clicked an ad and don't yet understand the offering.

MNTN (mountain.com) and other high-performing B2B ad funnels follow a consistent pattern: **sell first, capture second**.

## What Changes

### 1. New Landing Page Component (`src/pages/GetStarted.tsx`)

A scrollable, single-page sales/landing page that Meta ads will link to. Sections:

- **Hero**: Bold headline + subheadline + primary CTA ("Get Your Free Report") + optional short video or animated visual
- **Logo Bar**: Client/partner logos for instant credibility (scrolling marquee)
- **Stats Section**: Key numbers (e.g., "500M+ records," "50+ organizations served," audience reach metrics)
- **How It Works**: 3-step visual breakdown (Choose your channels -> Get audience intelligence -> Launch campaigns)
- **Segment Cards**: Preview of Commercial vs. Political paths with brief value props for each
- **Testimonials**: Named quotes from real clients with titles and organizations (or placeholder structure for adding them)
- **Channel Showcase**: Brief cards for each channel (CTV, Digital, Direct Mail, OOH, SMS) with a one-liner benefit
- **Bottom CTA**: Repeated call-to-action that navigates to `/experience` (the existing funnel)

### 2. Route Updates (`src/App.tsx`)

- `/get-started` -> New landing page (currently redirects to `/experience`)
- `/experience` -> Existing multi-step funnel (unchanged)
- Meta ads link to `/get-started`; the CTA on that page links to `/experience`

### 3. Welcome Step Simplification (Optional, Phase 2)

Once the landing page handles persuasion, the Welcome Step can be simplified to focus purely on lead capture (email + org) without needing to re-sell the value proposition. This is a follow-up optimization, not part of the initial build.

## What Stays the Same

- The entire 6-step `/experience` funnel remains intact
- All analytics, A/B testing, abandoned lead capture, and Meta CAPI tracking continue to work
- The Qualification step, scoring, and calendar redirect are unchanged

## Page Structure (Technical)

```text
/get-started (NEW - Landing Page)
+---------------------------------------+
| Nav: Logo          [Get Started] btn  |
+---------------------------------------+
| HERO                                  |
| Headline + Subheadline                |
| [Get Your Free Report ->]             |
| Trust badge: "No commitment required" |
+---------------------------------------+
| LOGO BAR (scrolling)                  |
| [Client1] [Client2] [Client3] ...    |
+---------------------------------------+
| STATS                                 |
| 500M+     50+        5          92%   |
| Records   Orgs      Channels   Match |
+---------------------------------------+
| HOW IT WORKS                          |
| 1. Choose  2. Get     3. Launch       |
|    Path       Intel      Campaigns    |
+---------------------------------------+
| FOR COMMERCIAL  |  FOR POLITICAL      |
| CPG, Retail...  |  Campaigns, PACs... |
| Key benefits    |  Key benefits       |
+---------------------------------------+
| CHANNELS                              |
| CTV | Digital | Mail | OOH | SMS     |
+---------------------------------------+
| TESTIMONIALS                          |
| "Quote..." - Name, Title, Org        |
| "Quote..." - Name, Title, Org        |
+---------------------------------------+
| FINAL CTA                            |
| Ready to reach your audience?         |
| [Start Your Free Report ->]           |
+---------------------------------------+
| FOOTER (minimal)                      |
+---------------------------------------+

         |  CTA clicks navigate to  |
         v                          v

/experience (EXISTING - Multi-Step Funnel)
+---------------------------------------+
| Step 1: Email + Org capture           |
| Step 2: Segment + Channel selection   |
| Step 3: Opportunity stats             |
| Step 4: Social proof                  |
| Step 5: Qualification form            |
| Step 6: Thank you / Calendar          |
+---------------------------------------+
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/GetStarted.tsx` | Create | New landing page with hero, stats, testimonials, CTAs |
| `src/App.tsx` | Modify | Change `/get-started` route from redirect to new page |
| `src/components/landing/` | Create (multiple) | Reusable section components: HeroSection, LogoBar, StatsSection, HowItWorks, SegmentPreview, ChannelShowcase, TestimonialsSection, FinalCTA |

## Design Approach

- Matches the existing dark theme (`#0a0f1a` background, `#e2e8f0` text, blue/emerald accents)
- Mobile-first responsive design consistent with the funnel
- Smooth scroll animations using Framer Motion (already installed)
- UTM parameters are preserved when navigating from landing page to `/experience`

## Content Notes

The landing page will use placeholder content that you can replace with real data:
- Client logos (placeholder boxes until real logos are provided)
- Testimonial quotes (template structure ready for real quotes)
- Stats (using reasonable placeholders based on your data products)
- You can update all content directly or via the existing `content_optimization` table

