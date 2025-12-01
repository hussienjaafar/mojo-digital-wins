# Rewardifi-Inspired Design System

A comprehensive design system built for modern SaaS dashboards, inspired by Rewardifi's clean, professional aesthetic.

## 🎨 Design Philosophy

- **Clean & Professional**: Premium SaaS aesthetic with emphasis on clarity
- **Bold Typography**: Clear hierarchy with strong font weights
- **Vibrant Accents**: Bright blue primary color for calls-to-action
- **Subtle Shadows**: Layered depth without overwhelming users
- **Smooth Interactions**: Polished micro-interactions and transitions
- **Responsive First**: Mobile-optimized with touch-friendly targets

---

## 🌈 Color System

### Light Mode
```css
--background: 0 0% 98%          /* Off-white base */
--foreground: 220 25% 10%        /* Dark text */
--card: 0 0% 100%                /* Pure white cards */
--primary: 217 91% 60%           /* Rewardifi Blue */
--muted: 220 15% 96%             /* Subtle backgrounds */
--border: 220 13% 91%            /* Soft borders */
```

### Dark Mode
```css
--background: 220 25% 6%         /* True dark */
--foreground: 0 0% 98%           /* Off-white text */
--card: 220 20% 10%              /* Elevated card surfaces */
--primary: 217 91% 60%           /* Same bright blue */
--muted: 220 15% 15%             /* Dark gray */
--border: 220 15% 20%            /* Subtle borders */
```

### Semantic Colors
```css
--success: 142 71% 45%           /* Green */
--warning: 38 92% 50%            /* Orange */
--destructive: 0 84% 60%         /* Red */
```

### Chart Colors
```css
--chart-1: 217 91% 60%           /* Primary Blue */
--chart-2: 142 71% 45%           /* Green */
--chart-3: 250 75% 60%           /* Purple */
--chart-4: 38 92% 50%            /* Orange */
--chart-5: 340 82% 52%           /* Pink */
```

---

## 📐 Layout System

### Spacing Scale
Based on 4px base unit:
- `0.5` = 2px
- `1` = 4px
- `2` = 8px
- `3` = 12px
- `4` = 16px
- `6` = 24px
- `8` = 32px
- `12` = 48px
- `16` = 64px

### Border Radius
- `--radius: 12px` - Default rounded corners for modern feel
- Cards, buttons, and inputs use `rounded-xl` (12px)
- Badges use `rounded-full`

### Container Max Width
- Dashboard: `max-w-[1800px]` for wide layouts
- Content: `max-w-7xl` (1280px) for reading

---

## 🔤 Typography

### Font Stack
```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

h1, h2 {
  font-family: 'Bebas Neue', 'Inter', sans-serif; /* Headers */
}
```

### Type Scale
```
Display: clamp(2rem, 8vw, 5.5rem)  /* Hero text */
Headline: clamp(2rem, 5vw, 3rem)   /* Page titles */
Title: 1.5rem                      /* Card titles */
Body: 1rem                         /* Default text */
Caption: 0.875rem                  /* Small text */
```

### Font Weights
- Light: 300
- Regular: 400
- Medium: 500
- Semibold: 600
- Bold: 700

---

## 🎴 Component Variants

### Button
```tsx
// Primary action
<Button variant="primary">Save Changes</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Success/Warning/Destructive
<Button variant="success">Approve</Button>
<Button variant="warning">Review</Button>
<Button variant="destructive">Delete</Button>

// Glass effect
<Button variant="glass">Subtle Action</Button>

// Gradient (hero CTAs)
<Button variant="gradient">Get Started</Button>
```

### Card
```tsx
// Default card with shadow
<Card variant="default">...</Card>

// Elevated with hover lift
<Card variant="elevated">...</Card>

// Glass effect
<Card variant="glass">...</Card>

// Gradient background
<Card variant="gradient">...</Card>

// Subtle background
<Card variant="smooth">...</Card>

// Outline only
<Card variant="outline">...</Card>

// Primary color
<Card variant="primary">...</Card>
```

### Badge
```tsx
// Status indicators
<Badge variant="default">Active</Badge>
<Badge variant="success">Completed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Error</Badge>

// Subtle variants
<Badge variant="outline">Draft</Badge>
<Badge variant="ghost">Info</Badge>
```

---

## 🌊 Shadows

### Shadow System
```css
--shadow-xs: Subtle lift (1-2px blur)
--shadow-sm: Small cards (2-4px blur)
--shadow-md: Default cards (4-12px blur)
--shadow-lg: Elevated cards (8-24px blur)
--shadow-xl: Modals/Dialogs (16-48px blur)
--shadow-glow: Primary color glow
--shadow-card: Card-specific shadow (2-layer)
```

### Usage
```tsx
// Cards automatically use shadow-card
<Card className="shadow-md">...</Card>

// Custom shadows
<div className="shadow-lg hover:shadow-xl">...</div>

// Glow effect for CTAs
<Button className="shadow-glow">...</Button>
```

---

## 🎭 Animations & Transitions

### Default Transition
```css
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

### Interactive States
```tsx
// Hover lift
<Card className="hover:-translate-y-0.5">...</Card>

// Scale on hover
<Button className="hover:scale-[1.02]">...</Button>

// Active press
<Button className="active:scale-[0.98]">...</Button>
```

### Loading States
```tsx
// Skeleton shimmer
<div className="animate-pulse bg-muted rounded-lg h-20" />

// Spinner
<RefreshCw className="animate-spin" />
```

---

## 📊 Data Visualization

### Chart Configuration
```tsx
import { COLORS } from '@/lib/utils';

<LineChart data={data}>
  <Line 
    dataKey="revenue" 
    stroke="hsl(var(--chart-1))" 
    strokeWidth={2}
  />
  <CartesianGrid 
    strokeDasharray="3 3" 
    className="stroke-border"
  />
</LineChart>
```

### Chart Colors
Use semantic chart tokens:
- `hsl(var(--chart-1))` - Primary metric
- `hsl(var(--chart-2))` - Secondary metric
- `hsl(var(--chart-3))` - Tertiary metric
- `hsl(var(--chart-4))` - Warning data
- `hsl(var(--chart-5))` - Accent data

---

## 📱 Responsive Design

### Breakpoints
```
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Mobile-First Classes
```tsx
// Stack on mobile, grid on desktop
<div className="flex flex-col md:grid md:grid-cols-3">

// Hide on mobile
<span className="hidden sm:inline">Desktop Only</span>

// Show on mobile only
<Menu className="sm:hidden" />

// Touch targets (44px minimum)
<Button size="default" className="min-h-[44px]">
```

---

## ♿ Accessibility

### Focus States
All interactive elements have visible focus rings:
```css
focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
```

### Touch Targets
Minimum 44x44px for touch:
```tsx
<Button size="default" className="min-h-[44px] min-w-[44px]">
```

### Semantic HTML
- Use proper heading hierarchy (h1 → h2 → h3)
- Use `<button>` for actions, `<a>` for navigation
- Add `aria-label` to icon-only buttons

### Color Contrast
All text meets WCAG AA standards:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Dark mode optimized for OLED screens

---

## 🔧 Implementation Guide

### Using Design Tokens
Always use CSS variables instead of hardcoded colors:

❌ **Don't:**
```tsx
<div className="bg-blue-500 text-white">
```

✅ **Do:**
```tsx
<div className="bg-primary text-primary-foreground">
```

### Component Composition
Build complex UIs from base components:

```tsx
<Card variant="elevated">
  <CardHeader>
    <CardTitle>Dashboard</CardTitle>
    <CardDescription>Overview of your metrics</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="grid gap-4 md:grid-cols-3">
      {/* Content */}
    </div>
  </CardContent>
</Card>
```

### Dark Mode Support
Components automatically adapt:
```tsx
// Light: white bg, dark text
// Dark: dark bg, white text
<Card className="bg-card text-card-foreground">
```

---

## 📚 Examples

### KPI Card
```tsx
<Card variant="elevated" className="hover:shadow-lg">
  <CardHeader className="pb-2">
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
      <DollarSign className="h-4 w-4 text-muted-foreground" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">$45,231.89</div>
    <p className="text-xs text-muted-foreground mt-1">
      <span className="text-success font-medium">+20.1%</span> from last month
    </p>
  </CardContent>
</Card>
```

### Data Table
```tsx
<Card>
  <CardHeader>
    <CardTitle>Recent Transactions</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.date}</TableCell>
            <TableCell>${row.amount}</TableCell>
            <TableCell>
              <Badge variant={row.status === 'completed' ? 'success' : 'warning'}>
                {row.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

---

## 🚀 Next Steps

1. **Navigation & Layout**: Implement Rewardifi-style sidebar and header
2. **Charts & Graphs**: Upgrade all Recharts with new color system
3. **Forms & Inputs**: Add polished form components with validation states
4. **Cards & Metrics**: Build KPI card library with variants

---

## 📖 Reference

- [Rewardifi](https://rewardifi.webflow.io/) - Design inspiration
- [Tailwind CSS](https://tailwindcss.com/) - Utility framework
- [shadcn/ui](https://ui.shadcn.com/) - Component library
- [Radix UI](https://www.radix-ui.com/) - Accessible primitives

---

**Version**: 1.0.0
**Last Updated**: 2025-12-01
