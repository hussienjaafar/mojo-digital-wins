import { FLOATING_PORTAL_ROOT_ID } from "@/lib/floating-portal";

/**
 * Global Portal Root Component
 * 
 * This component creates a single, centralized container for all Radix UI portals
 * (Dialog, Popover, Sheet, Dropdown, Tooltip, Select, etc.).
 * 
 * CRITICAL: This element MUST be rendered inside the .portal-theme wrapper
 * so that all portaled content inherits the correct CSS custom properties.
 * 
 * The `portal-theme` class provides:
 * - --portal-bg-primary/secondary/tertiary (opaque backgrounds)
 * - --portal-text-primary/secondary/muted (readable text colors)
 * - --portal-border (visible borders)
 * - All portal-specific shadows and spacing
 */
export function PortalRoot() {
  return (
    <div 
      id={FLOATING_PORTAL_ROOT_ID}
      className="portal-theme"
      style={{
        // Position fixed at top-left, zero dimensions
        // Content will be absolutely positioned by Radix
        position: "fixed",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        // Ensure portal content is above everything
        zIndex: 9999,
        // Don't capture pointer events on the container itself
        pointerEvents: "none",
      }}
    >
      {/* Radix portals will render their content here */}
    </div>
  );
}
