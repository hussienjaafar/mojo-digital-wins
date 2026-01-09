import { FLOATING_PORTAL_ROOT_ID } from "@/lib/floating-portal";
import { useEffect, useState } from "react";

/**
 * Global Portal Root Component
 * 
 * This component creates a single, centralized container for all Radix UI portals
 * (Dialog, Popover, Sheet, Dropdown, Tooltip, Select, etc.).
 * 
 * CRITICAL: This element MUST be rendered inside the ThemeProvider wrapper
 * and inherits the current theme class (light/dark) for proper styling.
 * 
 * The `portal-theme` class provides all portal-specific CSS variables.
 */
export function PortalRoot() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Sync dark mode class to portal root
    const syncTheme = () => {
      const portalRoot = document.getElementById(FLOATING_PORTAL_ROOT_ID);
      const isDark = document.documentElement.classList.contains('dark');
      if (portalRoot) {
        portalRoot.classList.toggle('dark', isDark);
      }
    };

    // Initial sync
    syncTheme();

    // Watch for theme changes on documentElement
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          syncTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  if (!mounted) return null;

  return (
    <div 
      id={FLOATING_PORTAL_ROOT_ID}
      className="portal-theme"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />
  );
}
