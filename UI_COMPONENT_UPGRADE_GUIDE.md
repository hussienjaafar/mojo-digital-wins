# UI Component Upgrade Guide
**Claude Console-Inspired Design System**

This guide shows how to use the enhanced UI components with glassmorphism, smooth animations, and modern design patterns.

---

## 🎨 Enhanced Components Overview

### ✅ Button Component
6 new variants for different use cases

### ✅ Card Component
6 variants with hover effects

### ✅ Skeleton Component
3 loading animation styles with shape presets

### ✅ Input Component
6 variants with smooth focus transitions

### ✅ Animation Utilities
Ready-to-use animation classes and presets

---

## 📦 Button Variants

### Import
```tsx
import { Button } from "@/components/ui/button";
```

### Available Variants

#### **gradient** - Claude Console style gradient button
```tsx
<Button variant="gradient">
  Premium Action
</Button>
```
- Gradient background with scale effect
- Best for: Primary CTAs, important actions

#### **glass** - Glassmorphism effect
```tsx
<Button variant="glass">
  Transparent Action
</Button>
```
- Backdrop blur with transparency
- Best for: Overlays, floating UI, modern aesthetics

#### **smooth** - Subtle hover states
```tsx
<Button variant="smooth">
  Gentle Action
</Button>
```
- Soft background with smooth transitions
- Best for: Secondary actions, non-intrusive buttons

#### **shine** - Animated shine effect
```tsx
<Button variant="shine">
  Highlight Action
</Button>
```
- Animated shimmer on hover
- Best for: Featured content, special promotions

### Combining with Sizes
```tsx
<Button variant="gradient" size="lg">Large Gradient</Button>
<Button variant="glass" size="sm">Small Glass</Button>
<Button variant="smooth" size="xl">Extra Large Smooth</Button>
```

---

## 🎴 Card Variants

### Import
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
```

### Available Variants

#### **glass** - Glassmorphism card
```tsx
<Card variant="glass">
  <CardHeader>
    <CardTitle>Glass Card</CardTitle>
  </CardHeader>
  <CardContent>
    Transparent, modern aesthetic
  </CardContent>
</Card>
```
- Backdrop blur with semi-transparent background
- Best for: Hero sections, featured content, modern dashboards

#### **elevated** - Hover lift effect
```tsx
<Card variant="elevated">
  <CardHeader>
    <CardTitle>Elevated Card</CardTitle>
  </CardHeader>
  <CardContent>
    Lifts on hover with shadow transition
  </CardContent>
</Card>
```
- Smooth lift animation on hover
- Best for: Interactive cards, clickable content, gallery items

#### **gradient** - Subtle gradient background
```tsx
<Card variant="gradient">
  <CardHeader>
    <CardTitle>Gradient Card</CardTitle>
  </CardHeader>
  <CardContent>
    Smooth gradient with border accent
  </CardContent>
</Card>
```
- Gradient background with hover effect
- Best for: Premium content, feature highlights

#### **smooth** - Semi-transparent with blur
```tsx
<Card variant="smooth">
  <CardHeader>
    <CardTitle>Smooth Card</CardTitle>
  </CardHeader>
  <CardContent>
    Subtle transparency with smooth states
  </CardContent>
</Card>
```
- Balanced opacity with backdrop blur
- Best for: Overlays, sections, grouped content

#### **outline** - Transparent with border
```tsx
<Card variant="outline">
  <CardHeader>
    <CardTitle>Outline Card</CardTitle>
  </CardHeader>
  <CardContent>
    Transparent background, emphasis on border
  </CardContent>
</Card>
```
- Transparent with border hover effect
- Best for: Minimal designs, secondary content

---

## ⏳ Skeleton (Loading States)

### Import
```tsx
import { Skeleton } from "@/components/ui/skeleton";
```

### Variants

#### **shimmer** (default) - Smooth gradient shimmer
```tsx
<Skeleton variant="shimmer" className="h-20 w-full" />
```
- Modern shimmer effect (Claude Console style)
- Best for: Most loading states

#### **wave** - Animated wave overlay
```tsx
<Skeleton variant="wave" className="h-20 w-full" />
```
- Wave animation across element
- Best for: Premium loading experiences

#### **pulse** - Classic pulsing
```tsx
<Skeleton variant="pulse" className="h-20 w-full" />
```
- Gentle opacity pulse
- Best for: Simple, clean loading states

### Shape Presets

```tsx
{/* Circle avatar skeleton */}
<Skeleton shape="circle" className="w-12" />

{/* Text line skeleton */}
<Skeleton shape="text" className="w-3/4" />

{/* Heading skeleton */}
<Skeleton shape="heading" className="w-1/2" />

{/* Button skeleton */}
<Skeleton shape="button" className="w-32" />

{/* Card skeleton */}
<Skeleton shape="card" className="w-full" />
```

### Loading Card Example
```tsx
<Card>
  <CardHeader>
    <Skeleton shape="circle" className="w-12 mb-4" />
    <Skeleton shape="heading" className="w-2/3" />
    <Skeleton shape="text" className="w-full mt-2" />
  </CardHeader>
  <CardContent>
    <Skeleton shape="card" className="w-full mb-4" />
    <Skeleton shape="button" className="w-32" />
  </CardContent>
</Card>
```

---

## 📝 Input Variants

### Import
```tsx
import { Input } from "@/components/ui/input";
```

### Available Variants

#### **ghost** - Transparent with hover
```tsx
<Input variant="ghost" placeholder="Search..." />
```
- No border, hover background
- Best for: Search bars, inline editing

#### **filled** - Muted background fill
```tsx
<Input variant="filled" placeholder="Email address" />
```
- Subtle filled background
- Best for: Forms, clean UI

#### **outline** - Bold border emphasis
```tsx
<Input variant="outline" placeholder="Username" />
```
- Thicker border, border-focused
- Best for: Important inputs, emphasized fields

#### **smooth** - Subtle with backdrop blur
```tsx
<Input variant="smooth" placeholder="Password" />
```
- Semi-transparent with smooth transitions
- Best for: Modern forms, overlays

#### **glass** - Glassmorphism input
```tsx
<Input variant="glass" placeholder="Enter code" />
```
- Transparent with backdrop blur
- Best for: Hero sections, modern aesthetics

### Combining with Sizes
```tsx
<Input variant="smooth" inputSize="sm" />
<Input variant="glass" inputSize="lg" />
<Input variant="filled" inputSize="xl" />
```

---

## 🎬 Animation Utilities

### Import
```tsx
import { animationPresets, transitions, hoverEffects } from "@/lib/animations";
```

### Ready-to-Use Presets

#### Card Hover
```tsx
<Card className={animationPresets.cardHover}>
  {/* Lifts and adds shadow on hover */}
</Card>
```

#### Button Hover
```tsx
<Button className={animationPresets.buttonHover}>
  {/* Scales and adds shadow on hover */}
</Button>
```

#### Page Entrance
```tsx
<div className={animationPresets.pageEntrance}>
  {/* Fades in and slides up */}
</div>
```

#### Loading States
```tsx
<div className={animationPresets.loadingShimmer}>
  {/* Shimmer animation */}
</div>
```

### Individual Animation Classes

#### Entrance Animations
```tsx
<div className="animate-fade-in">Fade In</div>
<div className="animate-fade-in-up">Fade In Up</div>
<div className="animate-slide-in-right">Slide In Right</div>
<div className="animate-pop-in">Pop In (bouncy)</div>
```

#### Hover Effects
```tsx
<div className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
  Lifts on hover
</div>

<div className="transition-all duration-200 hover:scale-105">
  Scales on hover
</div>
```

#### Continuous Animations
```tsx
<div className="animate-float">Floating element</div>
<div className="animate-pulse-subtle">Subtle pulse</div>
<div className="animate-glow-pulse">Glowing pulse</div>
```

---

## 🏗️ Real-World Examples

### Modern Dashboard Card
```tsx
<Card variant="elevated" className={animationPresets.cardHover}>
  <CardHeader>
    <div className="flex items-center gap-4">
      <Skeleton shape="circle" className="w-12" />
      <div className="flex-1">
        <CardTitle>Revenue Overview</CardTitle>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">$127,450</p>
    <Button variant="smooth" className="mt-4">View Details</Button>
  </CardContent>
</Card>
```

### Glassmorphism Hero Section
```tsx
<div className="relative bg-gradient-to-br from-primary to-secondary min-h-screen">
  <Card variant="glass" className="max-w-2xl mx-auto mt-20">
    <CardHeader>
      <CardTitle className="text-4xl">Welcome to Mojo Digital Wins</CardTitle>
      <p className="text-lg">AI-powered intelligence for political campaigns</p>
    </CardHeader>
    <CardContent>
      <Input variant="glass" placeholder="Enter your email" className="mb-4" />
      <Button variant="gradient" size="lg" className="w-full">
        Get Started
      </Button>
    </CardContent>
  </Card>
</div>
```

### Loading State Pattern
```tsx
function LoadingDashboard() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton shape="heading" className="w-2/3" />
            <Skeleton shape="text" className="w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton variant="shimmer" className="h-32 w-full mb-4" />
            <Skeleton shape="button" className="w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Form with Smooth Inputs
```tsx
<form className="space-y-4 animate-fade-in-up">
  <div>
    <label className="text-sm font-medium">Email</label>
    <Input variant="smooth" type="email" placeholder="you@example.com" />
  </div>

  <div>
    <label className="text-sm font-medium">Password</label>
    <Input variant="smooth" type="password" placeholder="••••••••" />
  </div>

  <Button variant="gradient" className="w-full">
    Sign In
  </Button>
</form>
```

### Staggered List Animation
```tsx
{items.map((item, index) => (
  <Card
    key={item.id}
    variant="elevated"
    className="animate-fade-in-up"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    <CardContent>{item.title}</CardContent>
  </Card>
))}
```

---

## 🎯 Best Practices

### 1. **Don't Over-Animate**
- Use animations sparingly
- Choose 1-2 signature effects per page
- Entrance animations should be subtle

### 2. **Match Variants to Context**
- `glass` / `gradient`: Hero sections, premium features
- `elevated` / `smooth`: Main content, interactive cards
- `outline`: Secondary content, minimalist sections

### 3. **Consistent Loading States**
- Use `shimmer` variant by default for skeletons
- Match skeleton shapes to actual content
- Keep loading animations smooth and non-distracting

### 4. **Accessibility**
- Ensure sufficient contrast with glass/smooth variants
- Test focus states are clearly visible
- Consider reduced motion preferences

### 5. **Performance**
- Avoid animating large numbers of elements simultaneously
- Use `will-change` sparingly (handled by Tailwind)
- Prefer transforms over layout-affecting properties

---

## 📊 Migration Guide

### Updating Existing Buttons
```tsx
// Before
<Button>Click Me</Button>

// After (choose based on context)
<Button variant="gradient">Premium Action</Button>
<Button variant="smooth">Secondary Action</Button>
```

### Updating Existing Cards
```tsx
// Before
<Card>...</Card>

// After
<Card variant="elevated">...</Card>  {/* Interactive cards */}
<Card variant="glass">...</Card>     {/* Hero/premium sections */}
```

### Adding Loading States
```tsx
// Before
{loading && <div>Loading...</div>}

// After
{loading && (
  <Skeleton variant="shimmer" shape="card" className="h-32 w-full" />
)}
```

---

## 🚀 Quick Start Checklist

- [ ] Replace default buttons with appropriate variants
- [ ] Add hover effects to interactive cards
- [ ] Implement skeleton loading states
- [ ] Update form inputs with smooth variants
- [ ] Add page entrance animations
- [ ] Test all variants in dark mode
- [ ] Verify accessibility (contrast, focus states)

---

**Created:** November 2025
**Based on:** Claude Console design principles
**Components Updated:** Button, Card, Skeleton, Input
**New Utilities:** Animation presets, transitions, hover effects
