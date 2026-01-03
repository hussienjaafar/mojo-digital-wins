/**
 * Resolves CSS custom property color tokens to computed RGB/RGBA strings
 * that ECharts can reliably parse.
 * 
 * ECharts' color parser doesn't support:
 * - Space-separated HSL syntax: hsl(213 90% 45%)
 * - CSS variable references: hsl(var(--portal-accent-blue))
 * 
 * This utility converts portal tokens to computed rgb()/rgba() strings.
 */

/**
 * Resolve a CSS custom property to its computed RGB/RGBA value
 * @param tokenName - The CSS variable name without -- prefix (e.g., "portal-accent-blue")
 * @param alpha - Optional alpha value (0-1)
 * @returns Computed color string like "rgb(59, 130, 246)" or "rgba(59, 130, 246, 0.5)"
 */
export function resolveTokenToRgb(tokenName: string, alpha?: number): string {
  if (typeof document === "undefined") {
    // SSR fallback - return a safe default
    return alpha !== undefined ? `rgba(128, 128, 128, ${alpha})` : "rgb(128, 128, 128)";
  }

  // Create a temporary element to compute the color
  const temp = document.createElement("div");
  temp.style.position = "absolute";
  temp.style.visibility = "hidden";
  temp.style.pointerEvents = "none";
  
  // Set the color using the CSS variable
  if (alpha !== undefined && alpha < 1) {
    temp.style.color = `hsl(var(--${tokenName}) / ${alpha})`;
  } else {
    temp.style.color = `hsl(var(--${tokenName}))`;
  }
  
  // Append to body to get computed styles
  document.body.appendChild(temp);
  const computed = getComputedStyle(temp).color;
  document.body.removeChild(temp);
  
  return computed;
}

/**
 * Resolve multiple tokens at once for efficiency
 * @param tokens - Array of token configurations
 * @returns Object mapping token names to resolved colors
 */
export function resolveTokens(
  tokens: Array<{ name: string; alpha?: number }>
): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const token of tokens) {
    const key = token.alpha !== undefined ? `${token.name}/${token.alpha}` : token.name;
    result[key] = resolveTokenToRgb(token.name, token.alpha);
  }
  
  return result;
}

/**
 * Pre-defined portal color tokens commonly used in charts
 * Returns computed colors that work reliably with ECharts
 */
export function getPortalChartColors(): {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentBlue: string;
  accentBlueLight: string;
  accentBlueMuted: string;
  success: string;
  warning: string;
  error: string;
} {
  return {
    bgPrimary: resolveTokenToRgb("portal-bg-primary"),
    bgSecondary: resolveTokenToRgb("portal-bg-secondary"),
    bgTertiary: resolveTokenToRgb("portal-bg-tertiary"),
    bgElevated: resolveTokenToRgb("portal-bg-elevated"),
    border: resolveTokenToRgb("portal-border"),
    textPrimary: resolveTokenToRgb("portal-text-primary"),
    textSecondary: resolveTokenToRgb("portal-text-secondary"),
    textMuted: resolveTokenToRgb("portal-text-muted"),
    accentBlue: resolveTokenToRgb("portal-accent-blue"),
    accentBlueLight: resolveTokenToRgb("portal-accent-blue", 0.3),
    accentBlueMuted: resolveTokenToRgb("portal-accent-blue", 0.15),
    success: resolveTokenToRgb("portal-success"),
    warning: resolveTokenToRgb("portal-warning"),
    error: resolveTokenToRgb("portal-error"),
  };
}

/**
 * Generate a gradient color array for ECharts visualMap
 * Uses the portal accent blue at different intensities
 */
export function getMapGradientColors(): string[] {
  return [
    resolveTokenToRgb("portal-accent-blue", 0.08),
    resolveTokenToRgb("portal-accent-blue", 0.25),
    resolveTokenToRgb("portal-accent-blue", 0.45),
    resolveTokenToRgb("portal-accent-blue", 0.70),
    resolveTokenToRgb("portal-accent-blue", 0.92),
  ];
}
