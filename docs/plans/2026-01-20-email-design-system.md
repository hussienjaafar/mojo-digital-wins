# Email Design System

**Date:** 2026-01-20
**Status:** Approved
**Author:** Claude (with user input)

## Overview

A unified email design system that matches the Molitico. dashboard aesthetic while optimizing for each email's intent (transactional, invitation, alert, report).

## Goals

1. **Brand consistency** - Emails look like they came from the same product as the dashboard
2. **Intent optimization** - Each email category optimized for its specific purpose
3. **Developer experience** - Reusable components, easy to create new templates
4. **Deliverability** - Inline CSS, web-safe fonts, email client compatibility

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#1570C8` | Primary blue (matches dashboard) |
| `primaryDark` | `#115a9e` | Hover/dark variant |
| `secondary` | `#8B5CF6` | Purple accent (sparingly) |
| `success` | `#16a34a` | Positive states |
| `warning` | `#ca8a04` | Warning states |
| `error` | `#dc2626` | Error/critical states |
| `info` | `#0EA5E9` | Informational |
| `text` | `#1a1a1a` | Primary text |
| `textSecondary` | `#525252` | Secondary text |
| `textMuted` | `#737373` | Muted/caption text |
| `background` | `#f8fafc` | Page background |
| `surface` | `#ffffff` | Card/content background |
| `border` | `#e5e7eb` | Borders |

### Typography

```
Font Stack: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
Mono Stack: ui-monospace, 'SF Mono', Monaco, monospace
```

| Size | Pixels | Usage |
|------|--------|-------|
| `xs` | 12px | Captions, fine print |
| `sm` | 14px | Secondary text |
| `base` | 16px | Body text |
| `lg` | 18px | Subheadings |
| `xl` | 20px | Section titles |
| `2xl` | 24px | Headings |

### Spacing (8px grid)

| Token | Value |
|-------|-------|
| `xs` | 8px |
| `sm` | 12px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |

### Layout

- **Max width:** 600px (email standard)
- **Border radius:** 8px (cards), 6px (buttons)
- **Content padding:** 24px (desktop), 16px (mobile)

## Branding

### Wordmark

```
MOLITICO.
```

- Font: Bold, uppercase
- The period (.) uses the primary blue color (`#1570C8`)
- No logo image required - text-based wordmark

### Footer

```
© 2026 Molitico. All rights reserved.
Manage preferences • Unsubscribe
```

## Components

### Button

**Variants:**
- `primary` - Solid blue background, white text (main CTA)
- `secondary` - White background, blue border, blue text
- `destructive` - Solid red background, white text

**Styling:**
```css
padding: 12px 24px;
border-radius: 6px;
font-weight: 600;
font-size: 14px;
text-decoration: none;
display: inline-block;
```

### Card

Content container with optional left accent border.

**Styling:**
```css
background: #ffffff;
border: 1px solid #e5e7eb;
border-radius: 8px;
padding: 16px;
```

**With accent:**
```css
border-left: 4px solid [accent-color];
```

### Info Box

Key-value display for transactional emails.

```
┌─────────────────────────────────┐
│ Email: user@example.com         │
└─────────────────────────────────┘
```

**Styling:**
```css
background: #f8fafc;
border-radius: 6px;
padding: 12px 16px;
font-family: monospace;
```

### Badge

Status indicators with semantic colors.

```css
display: inline-block;
padding: 4px 12px;
border-radius: 9999px;
font-size: 12px;
font-weight: 600;
```

### Stat Card

Metric display for reports.

```
┌────────────┐
│    $4.2K   │  ← Large value
│   Raised   │  ← Label
└────────────┘
```

### Divider

```css
border: 0;
border-top: 1px solid #e5e7eb;
margin: 24px 0;
```

## Intent-Based Templates

### 1. Transactional

**Used for:** Password reset, welcome, account deletion, contact form

**Characteristics:**
- Minimal design
- Single primary CTA
- No promotional content
- Clear expiration notices

**Header:** Wordmark + thin blue top line (4px)

**Layout:**
```
[Thin blue bar]
[Wordmark]
[Heading]
[Info box with context]
[Primary CTA button]
[Expiry/security notice]
[Footer]
```

### 2. Invitation

**Used for:** User invitations, admin invitations

**Characteristics:**
- Stronger brand presence
- Welcoming, professional tone
- Role/organization context
- Conversion-focused

**Header:** Blue background bar (48px) with white wordmark

**Layout:**
```
[Blue header bar with wordmark]
[Welcome heading]
[Personalized invitation message]
[Role/org details]
[Accept Invitation button]
[Expiry notice]
[Footer]
```

### 3. Alert

**Used for:** Spike alerts, notifications

**Characteristics:**
- Severity-coded colors
- Scannable metrics
- Quick context
- Optional CTA

**Severity Colors:**
| Level | Color | Emoji |
|-------|-------|-------|
| Critical | `#dc2626` | 🚨 |
| High | `#ea580c` | ⚠️ |
| Medium | `#ca8a04` | 📊 |
| Low | `#0EA5E9` | ℹ️ |

**Header:** Severity-colored top bar + wordmark

**Layout:**
```
[Severity-colored bar]
[Wordmark]
[Alert heading with severity + entity]
[Metrics card with left accent]
[Context summary]
[View in Dashboard button (optional)]
[Footer]
```

### 4. Report

**Used for:** Daily briefing, campaign reports

**Characteristics:**
- Data-forward presentation
- Stat cards for key metrics
- Organized sections
- Encourages dashboard visit

**Header:** Wordmark + report title + date

**Layout:**
```
[Wordmark]
[Report title + date]
[Stat cards row (2-3 columns)]
[Divider]
[Section heading]
[Content list/table]
[View Full Report button]
[Footer]
```

## File Structure

```
supabase/functions/_shared/
├── email.ts                      # Existing - sending utility
├── email-templates/
│   ├── tokens.ts                 # Design tokens
│   ├── components.ts             # Reusable components
│   ├── base.ts                   # Base template wrapper
│   └── templates/
│       ├── transactional.ts      # Password reset, welcome, etc.
│       ├── invitation.ts         # User/admin invitations
│       ├── alert.ts              # Spike alerts, notifications
│       └── report.ts             # Daily briefing, reports
```

## Migration Plan

### Phase 1: Foundation

Create core files:
1. `tokens.ts` - Design tokens
2. `components.ts` - Reusable components
3. `base.ts` - Base template wrapper

### Phase 2: Template Variants

Create intent-based templates:
1. `transactional.ts`
2. `invitation.ts`
3. `alert.ts`
4. `report.ts`

### Phase 3: Migrate Existing Functions

| Function | Template |
|----------|----------|
| `reset-client-password` | `transactional.passwordReset()` |
| `reset-admin-password` | `transactional.passwordReset()` |
| `create-client-user` | `transactional.welcome()` |
| `request-account-deletion` | `transactional.accountDeletion()` |
| `send-user-invitation` | `invitation.userInvite()` |
| `send-admin-invite` | `invitation.adminInvite()` |
| `send-spike-alerts` | `alert.spikeAlert()` |
| `send-notification-email` | `alert.notification()` |
| `send-daily-briefing` | `report.dailyBriefing()` |
| `send-email-report` | `report.campaignReport()` |
| `send-contact-notification` | `transactional.contactForm()` |

## Technical Considerations

### Email Client Compatibility

- **Inline CSS** - All styles inline for maximum compatibility
- **Web-safe fonts** - Inter with system font fallback
- **Table fallbacks** - For complex layouts in Outlook (nice-to-have)
- **Max width 600px** - Standard for email readability
- **No JavaScript** - Not supported in email clients

### Accessibility

- **Minimum font size:** 14px for body text
- **Color contrast:** WCAG AA compliant (4.5:1 ratio)
- **Alt text:** For any images
- **Semantic structure:** Proper heading hierarchy

### Testing

Before deployment, test emails in:
- Gmail (web)
- Apple Mail
- Outlook (web)
- Mobile (iOS Mail, Gmail app)

## References

- [Mailtrap: Transactional Email Best Practices](https://mailtrap.io/blog/transactional-emails-best-practices/)
- [Postmark: Email Best Practices Guide](https://postmarkapp.com/guides/transactional-email-best-practices)
- [MJML Documentation](https://mjml.io/)
- Dashboard design tokens: `src/lib/design-tokens.ts`
- Dashboard theme: `src/styles/portal-theme.css`
