import * as React from "react";
import { 
  Sun, 
  Moon, 
  ArrowLeft, 
  LogOut, 
  MoreHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateRangeControl } from "@/components/ui/DateRangeControl";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// Types
// ============================================================================

export interface ClientHeaderControlsProps {
  /** Show date controls */
  showDateControls?: boolean;
  /** Show back to admin button */
  showBackToAdmin?: boolean;
  /** Current theme */
  theme: string;
  /** Theme toggle handler */
  onThemeToggle: () => void;
  /** Back to admin handler */
  onBackToAdmin?: () => void;
  /** Logout handler */
  onLogout: () => void;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Icon Button Component
// ============================================================================

interface IconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  tooltip: string;
  variant?: "default" | "danger";
  children: React.ReactNode;
}

const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  ariaLabel,
  tooltip,
  variant = "default",
  children,
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <motion.button
        onClick={onClick}
        className={cn(
          "portal-icon-btn",
          variant === "danger" && "portal-icon-btn-danger"
        )}
        aria-label={ariaLabel}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {children}
      </motion.button>
    </TooltipTrigger>
    <TooltipContent 
      side="bottom"
      className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
    >
      <p>{tooltip}</p>
    </TooltipContent>
  </Tooltip>
);

// ============================================================================
// Overflow Menu Component
// ============================================================================

interface OverflowMenuProps {
  theme: string;
  onThemeToggle: () => void;
  onLogout: () => void;
  showAdminInOverflow?: boolean;
  onBackToAdmin?: () => void;
}

const OverflowMenu: React.FC<OverflowMenuProps> = ({
  theme,
  onThemeToggle,
  onLogout,
  showAdminInOverflow,
  onBackToAdmin,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <motion.button
        className="portal-icon-btn"
        aria-label="More options"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </motion.button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className={cn(
        "min-w-[160px] z-50",
        "bg-[hsl(var(--portal-bg-secondary))]",
        "border-[hsl(var(--portal-border))]",
        "rounded-[var(--portal-radius-md)]",
        "shadow-[var(--portal-shadow-lg)]"
      )}
    >
      {showAdminInOverflow && onBackToAdmin && (
        <>
          <DropdownMenuItem
            onClick={onBackToAdmin}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              "text-[hsl(var(--portal-text-primary))]",
              "focus:bg-[hsl(var(--portal-bg-hover))]",
              "focus:text-[hsl(var(--portal-text-primary))]"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(var(--portal-border))]" />
        </>
      )}
      <DropdownMenuItem
        onClick={onThemeToggle}
        className={cn(
          "flex items-center gap-2 cursor-pointer",
          "text-[hsl(var(--portal-text-primary))]",
          "focus:bg-[hsl(var(--portal-bg-hover))]",
          "focus:text-[hsl(var(--portal-text-primary))]"
        )}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="bg-[hsl(var(--portal-border))]" />
      <DropdownMenuItem
        onClick={onLogout}
        className={cn(
          "flex items-center gap-2 cursor-pointer",
          "text-[hsl(var(--portal-error))]",
          "focus:bg-[hsl(var(--portal-error)/0.1)]",
          "focus:text-[hsl(var(--portal-error))]"
        )}
      >
        <LogOut className="h-4 w-4" />
        <span>Logout</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * ClientHeaderControls - Responsive header toolbar for the client portal
 * 
 * Responsive Behavior:
 * - Desktop (≥1024px): Full controls visible with quick presets + date picker + admin + theme + logout
 * - Tablet (768-1023px): Same as desktop but may show presets in dropdown
 * - Small (420-767px): Date control visible, admin icon only, theme + logout visible
 * - Extra small (<420px): Date control, overflow menu with theme/logout/admin
 * 
 * Priority order:
 * 1. Date Range Control (always visible on sm+)
 * 2. Quick range presets (handled by DateRangeControl internally)
 * 3. Admin button (icon on xs, icon+text on sm+, in overflow on <xs)
 * 4. Theme toggle + Logout (in overflow on <xs)
 */
export const ClientHeaderControls: React.FC<ClientHeaderControlsProps> = ({
  showDateControls = true,
  showBackToAdmin = false,
  theme,
  onThemeToggle,
  onBackToAdmin,
  onLogout,
  className,
}) => {
  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className={cn(
          // Container: flex with controlled gaps, prevent overflow
          "flex items-center flex-shrink-0",
          // Responsive gaps
          "gap-1 xs:gap-1.5 sm:gap-2",
          className
        )}
        aria-label="Header actions"
      >
        {/* ================================================================
            Date Range Control
            - Hidden on extra small (<420px) to prevent overflow
            - Visible on xs+ (≥420px)
            - DateRangeControl handles its own responsive behavior internally
            ================================================================ */}
        {showDateControls && (
          <div className="hidden xs:block">
            <DateRangeControl size="sm" />
          </div>
        )}

        {/* ================================================================
            Back to Admin Button
            - Hidden on extra small (<420px), shown in overflow menu
            - Icon only on xs (420-639px)
            - Icon + "Admin" text on sm+ (≥640px)
            ================================================================ */}
        {showBackToAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToAdmin}
                className={cn(
                  // Touch target sizing (44px min)
                  "h-9 min-w-[44px]",
                  // Padding responsive
                  "px-2 sm:px-3",
                  // Gap for icon + text
                  "gap-1.5",
                  // V3 Portal styling
                  "bg-[hsl(var(--portal-bg-elevated))]",
                  "border-[hsl(var(--portal-border))]",
                  "text-[hsl(var(--portal-text-primary))]",
                  "hover:bg-[hsl(var(--portal-bg-hover))]",
                  "hover:border-[hsl(var(--portal-accent-blue))]",
                  // Hidden by default (<420px), visible on xs+ 
                  "hidden xs:inline-flex"
                )}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent 
              side="bottom"
              className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
            >
              <p>Back to Admin Dashboard</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* ================================================================
            Theme Toggle
            - Hidden on extra small (<420px), shown in overflow menu
            - Visible on xs+ (≥420px)
            ================================================================ */}
        <div className="hidden xs:block">
          <IconButton
            onClick={onThemeToggle}
            ariaLabel="Toggle theme"
            tooltip={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </IconButton>
        </div>

        {/* ================================================================
            Logout Button
            - Hidden on extra small (<420px), shown in overflow menu
            - Visible on xs+ (≥420px)
            ================================================================ */}
        <div className="hidden xs:block">
          <IconButton
            onClick={onLogout}
            ariaLabel="Log out of your account"
            tooltip="Logout"
            variant="danger"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          </IconButton>
        </div>

        {/* ================================================================
            Overflow Menu (Extra Small Only - <420px)
            Contains: Admin (if applicable), Theme toggle, Logout
            ================================================================ */}
        <div className="block xs:hidden">
          <OverflowMenu
            theme={theme}
            onThemeToggle={onThemeToggle}
            onLogout={onLogout}
            showAdminInOverflow={showBackToAdmin}
            onBackToAdmin={onBackToAdmin}
          />
        </div>
      </nav>
    </TooltipProvider>
  );
};

ClientHeaderControls.displayName = "ClientHeaderControls";

export default ClientHeaderControls;
