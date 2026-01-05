// Centralized Radix Portal container lookup so portaled content stays within
// the `.portal-theme` scope (where V3 --portal-* CSS variables are defined).

export const FLOATING_PORTAL_ROOT_ID = "portal-floating-root";

export function getFloatingPortalContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.getElementById(FLOATING_PORTAL_ROOT_ID) ?? undefined;
}
