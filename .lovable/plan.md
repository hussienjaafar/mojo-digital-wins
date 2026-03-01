

# Fix Unreadable Favorability Chart

## Problem

The "Sam Rasoul Favorability" chart uses a stacked horizontal bar for a **single data row** with 5 segments (27%, 22%, 10%, 1%, 1%). On mobile, all segment labels pile up on one bar, making it unreadable. A stacked bar is simply the wrong chart type for single-entity favorability data.

## Best Visualization: Individual Horizontal Bars

The most readable way to show a favorability breakdown for one candidate is to give **each favorability level its own horizontal bar row**. This is how polling firms (Gallup, Pew, FiveThirtyEight) present single-candidate favorability data. Each row gets clear space for its label and value.

```text
Very Favorable         |████████████████████████████| 27%
Somewhat Favorable     |██████████████████████|       22%
Neutral                |██████████|                   10%
Somewhat Unfavorable   |█|                             1%
Very Unfavorable       |█|                             1%
```

## Implementation

### File: `src/data/polls/va6-2026.ts`

Transform the favorability section from `stacked-bar` to `horizontal-bar` type with one series and multiple data rows:

```typescript
{
  type: "horizontal-bar",
  title: "Sam Rasoul Favorability",
  description: "Nearly 60% of voters in the district are familiar with Rasoul...",
  xAxisKey: "level",
  series: [
    { dataKey: "value", name: "Response %", color: "hsl(var(--portal-accent-blue))" },
  ],
  data: [
    { level: "Very Favorable", value: 27 },
    { level: "Somewhat Favorable", value: 22 },
    { level: "Neutral", value: 10 },
    { level: "Somewhat Unfavorable", value: 1 },
    { level: "Very Unfavorable", value: 1 },
  ],
  netLabel: "Net Favorability: +47%",
  valueType: "percent",
}
```

### File: `src/pages/PollDetail.tsx`

Update the `HorizontalBar` component to support the `netLabel` property (currently only on `StackedBarSection`). Add the net favorability badge below the chart, same as the current stacked bar rendering.

### File: `src/data/polls/types.ts`

Add `netLabel?: string` to the `HorizontalBarSection` type so it can display the favorability summary badge.

### Color Treatment

Use a single consistent color (portal blue) for all bars. The favorability sentiment is conveyed by the category labels themselves ("Very Favorable" vs "Very Unfavorable"), so color-coding individual bars is unnecessary and would add visual noise. The relative bar lengths tell the story clearly.

## Result

- Each favorability level gets its own row with full label visibility
- Values display cleanly at the end of each bar
- The "Net Favorability: +47%" badge remains below the chart
- Works perfectly on mobile -- no overlapping labels
- Consistent with how the "Progressive Figure Favorability" chart already renders

## Files Modified

| File | Change |
|------|--------|
| `src/data/polls/va6-2026.ts` | Convert favorability from stacked-bar to horizontal-bar with individual rows |
| `src/data/polls/types.ts` | Add optional `netLabel` to `HorizontalBarSection` type |
| `src/pages/PollDetail.tsx` | Render `netLabel` badge on horizontal bar sections |

