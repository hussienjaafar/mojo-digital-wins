# Theme System Best Practices

## Quick Reference Guide for Developers

This guide provides practical examples and rules for maintaining WCAG-compliant themes across the Molitico application.

---

## Golden Rules

### ✅ DO

1. **Use `text-foreground` for primary text**
   ```tsx
   // Good
   <p className="text-foreground">Main content</p>

   // Bad
   <p className="text-primary-foreground">Main content</p>  // White on white in light mode!
   ```

2. **Use `bg-muted` for subtle backgrounds**
   ```tsx
   // Good - Maintains contrast in both themes
   <div className="bg-muted text-foreground">

   // Bad - Low contrast
   <div className="bg-primary-foreground/10">  // Nearly invisible in light mode!
   ```

3. **Use semantic color tokens from CSS variables**
   ```tsx
   // Good - Adapts to theme automatically
   className="text-muted-foreground"

   // Bad - Hardcoded, doesn't adapt
   className="text-gray-500"
   ```

4. **Test both light AND dark modes**
   - Always toggle theme during development
   - Use ThemeToggle in top-right navigation (public pages) or bottom of AdminSidebar (admin pages)

5. **Use Tailwind color utilities from the design system**
   ```tsx
   // Good - From index.css :root variables
   bg-background, bg-card, bg-muted
   text-foreground, text-muted-foreground
   border-border

   // Bad - Raw Tailwind colors
   bg-gray-100, bg-white, bg-black
   text-gray-900, text-white
   ```

### ❌ DON'T

1. **Don't use `text-primary-foreground` on light backgrounds**
   ```tsx
   // Bad - White text on white background
   <Button className="bg-background text-primary-foreground">  // INVISIBLE!
   ```

2. **Don't use raw opacity on text for "muted" effect**
   ```tsx
   // Bad - Reduces contrast below WCAG minimums
   <span className="text-foreground opacity-50">Secondary text</span>

   // Good - Use semantic token
   <span className="text-muted-foreground">Secondary text</span>
   ```

3. **Don't hardcode colors**
   ```tsx
   // Bad
   <div className="bg-white text-black">  // Breaks dark mode

   // Good
   <div className="bg-background text-foreground">  // Works in both modes
   ```

4. **Don't use `bg-transparent` for interactive elements**
   ```tsx
   // Bad - Poor contrast against varying backgrounds
   <Button className="bg-transparent">

   // Good - Maintains contrast
   <Button variant="ghost">  // Has defined bg-muted on hover
   ```

---

## Component Patterns

### Buttons

```tsx
// Primary action - High contrast
<Button variant="default">Submit</Button>
// Uses: bg-primary text-primary-foreground (15.8:1 contrast)

// Secondary action - Smooth professional appearance
<Button variant="smooth">Cancel</Button>
// Uses: bg-muted text-foreground (13.5:1 contrast)

// Destructive action
<Button variant="destructive">Delete</Button>
// Uses: bg-destructive text-destructive-foreground (4.8:1 contrast)

// Ghost (minimal) - Use for tertiary actions
<Button variant="ghost">Details</Button>
// Uses: transparent hover:bg-accent (maintains foreground contrast)
```

### Cards

```tsx
// Standard card - Clean background
<Card>
  <CardHeader>
    <CardTitle className="text-foreground">Title</CardTitle>
    <CardDescription className="text-muted-foreground">Subtitle</CardDescription>
  </CardHeader>
  <CardContent className="text-foreground">
    Content
  </CardContent>
</Card>

// Elevated card - Hover lift effect
<Card variant="elevated" className="animate-fade-in-up">
  {/* Automatic shadow transitions */}
</Card>

// Smooth card - Glassmorphism
<Card variant="smooth">
  {/* Semi-transparent with backdrop-blur */}
</Card>

// Gradient card - Premium feel
<Card variant="gradient">
  {/* Purple-to-blue gradient background */}
</Card>
```

### Inputs

```tsx
// Default input - Always readable
<Input
  className="bg-background text-foreground border-border"
  placeholder="Enter text..."
/>

// Muted background variant
<Input variant="filled" />  // bg-muted text-foreground

// Search with icon
<div className="relative">
  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
  <Input className="pl-9" placeholder="Search..." />
</div>
```

### Text Hierarchy

```tsx
// H1 - Main headings
<h1 className="text-4xl font-bold text-foreground">
  Page Title
</h1>

// H2 - Section headings
<h2 className="text-2xl font-semibold text-foreground">
  Section Title
</h2>

// Body text
<p className="text-base text-foreground">
  Main content goes here.
</p>

// Secondary/metadata text
<p className="text-sm text-muted-foreground">
  Last updated 5 minutes ago
</p>

// Caption text
<span className="text-xs text-muted-foreground">
  Additional details
</span>
```

### Badges

```tsx
// Status badges - Always use semantic variants
<Badge variant="default">Active</Badge>        // Primary color
<Badge variant="secondary">Pending</Badge>     // Muted color
<Badge variant="destructive">Critical</Badge>  // Red color
<Badge variant="outline">Draft</Badge>         // Border only

// Custom colored badge (maintain contrast)
<Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400">
  Info
</Badge>
```

### Alerts

```tsx
// Info alert
<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>
    General information message.
  </AlertDescription>
</Alert>

// Warning/Error alert
<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertDescription>
    Error or warning message.
  </AlertDescription>
</Alert>
```

---

## Theme Toggle Placement

### Public Pages (Navigation.tsx)
```tsx
// Desktop: In header next to CTA
<div className="hidden md:flex items-center gap-3">
  <ThemeToggle />
  <Button>Work With Us</Button>
</div>

// Mobile: In menu footer with label
<div className="flex justify-center pt-3">
  <div className="flex items-center gap-3 px-5 py-3 rounded-lg bg-primary-foreground/15">
    <span className="text-base font-semibold text-primary-foreground">Theme</span>
    <ThemeToggle />
  </div>
</div>
```

### Admin Pages (AdminSidebar.tsx)
```tsx
// Fixed at bottom of sidebar
<div className="mt-auto pt-4 border-t border-border">
  <div className="px-4 py-3 flex items-center justify-between">
    {isEffectivelyExpanded && (
      <span className="text-sm font-medium text-muted-foreground">Theme</span>
    )}
    <ThemeToggle />
  </div>
</div>
```

---

## Common Mistakes & Fixes

### Mistake #1: Invisible ThemeToggle
```tsx
// ❌ Before (white on white in light mode)
<Button className="bg-primary-foreground/10 text-primary-foreground">
  <Sun />
</Button>

// ✅ Fixed (visible in both modes)
<Button className="bg-muted text-foreground">
  <Sun />
</Button>
```

### Mistake #2: Poor Card Contrast
```tsx
// ❌ Bad (low contrast in dark mode)
<Card className="bg-gray-900 text-gray-400">
  Content
</Card>

// ✅ Good (semantic tokens adapt)
<Card className="bg-card text-card-foreground">
  Content
</Card>
```

### Mistake #3: Opacity for Muted Text
```tsx
// ❌ Bad (reduces contrast below WCAG minimum)
<p className="text-foreground opacity-60">
  Secondary text
</p>

// ✅ Good (maintains adequate contrast)
<p className="text-muted-foreground">
  Secondary text
</p>
```

### Mistake #4: Hardcoded Border Colors
```tsx
// ❌ Bad (doesn't adapt to theme)
<div className="border-2 border-gray-300">

// ✅ Good (adapts automatically)
<div className="border-2 border-border">
```

### Mistake #5: Icon Colors
```tsx
// ❌ Bad (poor contrast)
<AlertCircle className="text-primary-foreground" />

// ✅ Good (adapts to context)
<AlertCircle className="text-foreground" />          // Primary icon
<AlertCircle className="text-muted-foreground" />    // Secondary icon
<AlertCircle className="text-destructive" />         // Error icon
```

---

## Animation & Transitions

### Theme Transition
All theme changes animate smoothly via global CSS:
```css
/* In index.css */
* {
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

This ensures smooth transitions between light and dark modes automatically.

### Glassmorphism (Smooth Variant)
```tsx
// Backdrop blur requires solid backgrounds underneath
<div className="relative">
  {/* Solid background */}
  <div className="bg-background">
    {/* Glassmorphism layer */}
    <Card variant="smooth">
      {/* backdrop-blur-xl bg-card/95 */}
    </Card>
  </div>
</div>
```

---

## Testing Checklist

Before committing component changes:

- [ ] Toggle to dark mode - is text readable?
- [ ] Toggle to light mode - is text readable?
- [ ] Check ThemeToggle - is it visible in both modes?
- [ ] Hover states - do they maintain contrast?
- [ ] Focus states - are focus rings visible?
- [ ] Error states - are destructive colors clear?
- [ ] Glassmorphism - is there a solid background underneath?
- [ ] Mobile responsive - does layout work in both themes?

---

## Color Token Reference

### Backgrounds
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-background` | White | Very Dark | Page background |
| `bg-card` | White | Dark Gray | Card backgrounds |
| `bg-muted` | Light Gray | Medium Dark | Subtle backgrounds |
| `bg-accent` | Yellow Tint | Yellow Dark | Hover states |

### Text
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `text-foreground` | Dark Blue | Almost White | Primary text |
| `text-muted-foreground` | Medium Gray | Light Gray | Secondary text |
| `text-primary-foreground` | White | White | Text on primary bg |

### Interactive
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-primary` | Dark Blue | Desaturated Blue | Primary buttons |
| `bg-secondary` | Medium Blue | Dark Gray | Secondary buttons |
| `bg-destructive` | Red | Desaturated Red | Delete/error |

### Borders
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `border-border` | Light Gray | Medium Gray | Standard borders |
| `border-input` | Light Gray | Dark Gray | Input borders |

---

## Gradients

All gradients defined in `index.css` adapt to theme:

```tsx
// Gradient backgrounds (use sparingly)
<div className="bg-gradient-to-r from-primary to-secondary">

// Using CSS variable gradients
<div style={{ background: 'var(--gradient-hero)' }}>  // Adapts to theme
```

**Note**: Gradients should always use high-contrast text colors:
```tsx
<div className="bg-gradient-to-r from-primary to-secondary text-primary-foreground">
  White text on dark gradient ✅
</div>
```

---

## Accessibility Tips

1. **Always provide alt text for icons used alone**
   ```tsx
   <Button size="icon" aria-label="Toggle theme">
     <Sun className="h-4 w-4" />
   </Button>
   ```

2. **Use semantic HTML elements**
   ```tsx
   // Good
   <button>Click me</button>

   // Avoid (unless absolutely necessary)
   <div onClick={handleClick}>Click me</div>
   ```

3. **Maintain focus indicators**
   ```tsx
   // All interactive elements automatically get focus rings via Tailwind
   // Default: ring-ring (medium blue with good contrast)
   ```

4. **Prefer visible labels over placeholders**
   ```tsx
   // Good
   <Label htmlFor="email">Email</Label>
   <Input id="email" type="email" />

   // Less accessible
   <Input type="email" placeholder="Email" />  // No permanent label
   ```

---

## Quick Wins

### Convert Existing Components

**Old pattern** (pre-theme-audit):
```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

**New pattern** (post-theme-audit):
```tsx
<div className="bg-background text-foreground">
  Content
</div>
```

### Benefits
- ✅ Automatic theme adaptation
- ✅ Less code (no dark: modifiers needed)
- ✅ WCAG compliant by default
- ✅ Consistent with design system

---

## Resources

- **Color System**: `src/index.css` (lines 14-169)
- **ThemeProvider**: `src/components/ThemeProvider.tsx`
- **ThemeToggle**: `src/components/ThemeToggle.tsx`
- **Contrast Audit**: `THEME_CONTRAST_AUDIT.md`
- **Component Variants**: `src/components/ui/` (Button, Card, Input)

### External Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)

---

## Summary

**Key Takeaways:**
1. Always use semantic color tokens (`text-foreground`, `bg-muted`, etc.)
2. Test every component in both light AND dark modes
3. Use `text-foreground` for primary text, never `text-primary-foreground`
4. ThemeToggle now uses `bg-muted` for visibility in both themes
5. All enhanced Phase 1-3 components are WCAG AA compliant

**Theme System Health**: ✅ **EXCELLENT**
- All text meets WCAG AA standards (>4.5:1 contrast)
- ThemeToggle visibility fixed
- Available on all pages (public + admin)
- Semantic color system in place

---

**Last Updated**: November 23, 2025
**Maintained By**: Claude Code Team
**Questions?** Check `THEME_CONTRAST_AUDIT.md` for detailed analysis

🤖 Generated with [Claude Code](https://claude.com/claude-code)
