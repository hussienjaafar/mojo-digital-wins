/**
 * Animation Utilities for Mojo Digital Wins
 * Claude Console-inspired smooth animations and transitions
 *
 * All animations use cubic-bezier easing for natural movement
 */

// ============================================================================
// ENTRANCE ANIMATIONS
// ============================================================================

export const entranceAnimations = {
  fadeIn: "animate-fade-in",
  fadeInUp: "animate-fade-in-up",
  fadeInDown: "animate-fade-in-down",
  slideInRight: "animate-slide-in-right",
  slideInLeft: "animate-slide-in-left",
  slideUp: "animate-slide-up",
  slideUpIn: "animate-slide-up-in",
  scaleIn: "animate-scale-in",
  bounceIn: "animate-bounce-in",
  popIn: "animate-pop-in",
} as const;

// ============================================================================
// CONTINUOUS ANIMATIONS
// ============================================================================

export const continuousAnimations = {
  pulse: "animate-pulse",
  pulseSubtle: "animate-pulse-subtle",
  glowPulse: "animate-glow-pulse",
  float: "animate-float",
  gradientShift: "animate-gradient-shift",
  parallaxSlow: "animate-parallax-slow",
  circleFloat1: "animate-circle-float-1",
  circleFloat2: "animate-circle-float-2",
  circleFloat3: "animate-circle-float-3",
} as const;

// ============================================================================
// LOADING ANIMATIONS
// ============================================================================

export const loadingAnimations = {
  shimmer: "animate-shimmer",
  wave: "animate-wave",
  pulse: "animate-pulse",
} as const;

// ============================================================================
// INTERACTION ANIMATIONS
// ============================================================================

export const interactionAnimations = {
  smoothScale: "animate-smooth-scale",
  shake: "animate-shake",
} as const;

// ============================================================================
// TRANSITION CLASSES (For hover/focus states)
// ============================================================================

export const transitions = {
  all: "transition-all duration-200",
  allMedium: "transition-all duration-300",
  allSlow: "transition-all duration-500",
  colors: "transition-colors duration-200",
  transform: "transition-transform duration-200",
  opacity: "transition-opacity duration-200",
  shadow: "transition-shadow duration-200",
} as const;

// ============================================================================
// HOVER EFFECTS (Combine with transitions)
// ============================================================================

export const hoverEffects = {
  lift: "hover:-translate-y-1 hover:shadow-lg",
  liftSubtle: "hover:-translate-y-0.5 hover:shadow-md",
  scale: "hover:scale-105",
  scaleSubtle: "hover:scale-[1.02]",
  glow: "hover:shadow-glow-red",
  brighten: "hover:brightness-110",
  opacity: "hover:opacity-80",
} as const;

// ============================================================================
// FOCUS EFFECTS (For inputs and interactive elements)
// ============================================================================

export const focusEffects = {
  ring: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ringPrimary: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
  border: "focus-visible:border-primary focus-visible:outline-none",
  glow: "focus-visible:shadow-lg focus-visible:shadow-primary/50",
} as const;

// ============================================================================
// COMBINATION PRESETS (Ready-to-use classes)
// ============================================================================

export const animationPresets = {
  // Card hover effects
  cardHover: `${transitions.all} ${hoverEffects.lift}`,
  cardHoverSubtle: `${transitions.all} ${hoverEffects.liftSubtle}`,

  // Button hover effects
  buttonHover: `${transitions.all} ${hoverEffects.scaleSubtle} hover:shadow-md`,
  buttonHoverBold: `${transitions.all} ${hoverEffects.scale} hover:shadow-lg`,

  // Input focus effects
  inputFocus: `${transitions.all} ${focusEffects.ring}`,
  inputFocusBorder: `${transitions.all} ${focusEffects.border}`,

  // Page entrance
  pageEntrance: entranceAnimations.fadeInUp,
  sectionEntrance: entranceAnimations.slideUpIn,

  // Loading states
  loadingShimmer: loadingAnimations.shimmer,
  loadingPulse: loadingAnimations.pulse,

  // Background animations
  backgroundFloat: continuousAnimations.circleFloat1,
  backgroundGradient: continuousAnimations.gradientShift,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Combines multiple animation classes safely
 */
export function combineAnimations(...animations: string[]): string {
  return animations.filter(Boolean).join(" ");
}

/**
 * Creates a stagger delay for list items
 * @param index - Item index in the list
 * @param delayMs - Base delay in milliseconds (default: 50ms)
 */
export function staggerDelay(index: number, delayMs: number = 50): string {
  return `style-[animation-delay:${index * delayMs}ms]`;
}

/**
 * Gets entrance animation with optional delay
 */
export function getEntranceAnimation(
  animation: keyof typeof entranceAnimations,
  delayMs?: number
): string {
  const baseAnimation = entranceAnimations[animation];
  if (delayMs) {
    return `${baseAnimation} [animation-delay:${delayMs}ms]`;
  }
  return baseAnimation;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Card with hover effect
 * <Card className={animationPresets.cardHover}>
 *
 * EXAMPLE 2: Button with custom animation
 * <Button className={combineAnimations(transitions.all, hoverEffects.scale, "hover:shadow-xl")}>
 *
 * EXAMPLE 3: List with stagger animation
 * {items.map((item, i) => (
 *   <div className={combineAnimations(entranceAnimations.fadeInUp, staggerDelay(i))}>
 *
 * EXAMPLE 4: Input with smooth focus
 * <Input className={animationPresets.inputFocus} />
 *
 * EXAMPLE 5: Loading skeleton
 * <Skeleton variant="shimmer" className="h-20 w-full" />
 *
 * EXAMPLE 6: Page entrance animation
 * <div className={animationPresets.pageEntrance}>
 */
