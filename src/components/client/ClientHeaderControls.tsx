import * as React from "react";
import { 
  Sun, 
  Moon, 
  ArrowLeft, 
  LogOut, 
  MoreHorizontal,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import { format, parse } from "date-fns";
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
import { useDashboardStore } from "@/stores/dashboardStore";
import {
  formatResponsiveDate,
  getFullDateRangeLabel,
} from "@/hooks/useResponsiveDateFormat";

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
  className?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  ariaLabel,
  tooltip,
  variant = "default",
  children,
  className,
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <motion.button
        onClick={onClick}
        className={cn(
          "portal-icon-btn",
          variant === "danger" && "portal-icon-btn-danger",
          className
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
// Compact Date Display (for extra small screens)
// ============================================================================

interface CompactDateDisplayProps {
  startDate: Date;
  endDate: Date;
  onClick: () => void;
}

const CompactDateDisplay: React.FC<CompactDateDisplayProps> = ({
  startDate,
  endDate,
  onClick,
}) => {
  const fullLabel = getFullDateRangeLabel(startDate, endDate);
  const compactLabel = formatResponsiveDate(startDate, endDate, "xs");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1.5",
            "h-9 px-2.5",
            "text-xs font-medium",
            "bg-[hsl(var(--portal-bg-secondary))]",
            "border border-[hsl(var(--portal-border))]",
            "rounded-[var(--portal-radius-sm)]",
            "text-[hsl(var(--portal-text-primary))]",
            "hover:bg-[hsl(var(--portal-bg-hover))]",
            "hover:border-[hsl(var(--portal-border-hover))]",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]",
            "focus-visible:ring-offset-1",
            "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]"
          )}
          aria-label={`Date range: ${fullLabel}. Click to change.`}
        >
          <Calendar className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
          <span className="whitespace-nowrap">{compactLabel}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent 
        side="bottom"
        className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
      >
        <p>{fullLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
};

// ============================================================================
// Overflow Menu Component
// ============================================================================

interface OverflowMenuProps {
  theme: string;
  onThemeToggle: () => void;
  onLogout: () => void;
  showAdminInOverflow?: boolean;
  onBackToAdmin?: () => void;
  showDateInOverflow?: boolean;
  onOpenDatePicker?: () => void;
  dateRangeLabel?: string;
}

const OverflowMenu: React.FC<OverflowMenuProps> = ({
  theme,
  onThemeToggle,
  onLogout,
  showAdminInOverflow,
  onBackToAdmin,
  showDateInOverflow,
  onOpenDatePicker,
  dateRangeLabel,
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
        "min-w-[180px] z-50",
        "bg-[hsl(var(--portal-bg-secondary))]",
        "border-[hsl(var(--portal-border))]",
        "rounded-[var(--portal-radius-md)]",
        "shadow-[var(--portal-shadow-lg)]"
      )}
    >
      {showDateInOverflow && onOpenDatePicker && (
        <>
          <DropdownMenuItem
            onClick={onOpenDatePicker}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              "text-[hsl(var(--portal-text-primary))]",
              "focus:bg-[hsl(var(--portal-bg-hover))]",
              "focus:text-[hsl(var(--portal-text-primary))]"
            )}
          >
            <Calendar className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            <span className="flex flex-col items-start">
              <span className="text-sm">Date Range</span>
              {dateRangeLabel && (
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {dateRangeLabel}
                </span>
              )}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(var(--portal-border))]" />
        </>
      )}
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
 * Follows V3 design system and WAI-ARIA toolbar patterns.
 * 
 * Responsive Behavior:
 * - Desktop (≥1024px): Full controls visible with quick presets + date picker + admin + theme + logout
 * - Tablet (768-1023px): Same as desktop
 * - Small (420-767px): Compact date, admin icon only, theme + logout visible
 * - Extra small (<420px): Compact date + overflow menu with theme/logout/admin
 * 
 * Priority order:
 * 1. Date Range Control (always visible)
 * 2. Quick range presets (handled by DateRangeControl internally on sm+)
 * 3. Admin button (icon on xs, icon+text on sm+, in overflow on <xs with date)
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
  const { dateRange } = useDashboardStore();
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  // Parse dates for display
  const parseStoreDate = (dateStr: string): Date =>
    parse(dateStr, "yyyy-MM-dd", new Date());
  
  const startDate = parseStoreDate(dateRange.startDate);
  const endDate = parseStoreDate(dateRange.endDate);
  const compactDateLabel = formatResponsiveDate(startDate, endDate, "xs");

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        role="toolbar"
        aria-label="Dashboard controls"
        aria-orientation="horizontal"
        className={cn(
          // Container: flex with controlled gaps, prevent overflow
          "portal-toolbar",
          "flex items-center flex-shrink-0",
          // Responsive gaps
          "gap-1 xs:gap-1.5 sm:gap-2",
          className
        )}
      >
        {/* ================================================================
            Date Range Control
            - Extra small (<420px): Compact numeric display
            - Small (420-767px): DateRangeControl with compact presets
            - Desktop (≥768px): Full DateRangeControl with presets
            ================================================================ */}
        {showDateControls && (
          <>
            {/* Extra small: Compact date button */}
            <div className="xs:hidden">
              <CompactDateDisplay
                startDate={startDate}
                endDate={endDate}
                onClick={() => setIsDatePickerOpen(true)}
              />
            </div>
            
            {/* Small+: Full DateRangeControl */}
            <div className="hidden xs:block">
              <DateRangeControl size="sm" />
            </div>
          </>
        )}

        {/* ================================================================
            Back to Admin Button
            - Hidden on extra small (<420px), shown in overflow menu
            - Icon only on xs-sm (420-767px)
            - Icon + "Admin" text on md+ (≥768px)
            ================================================================ */}
        {showBackToAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToAdmin}
                className={cn(
                  // Touch target sizing (44px min height)
                  "h-9 min-w-[44px]",
                  // Padding responsive
                  "px-2 md:px-3",
                  // Gap for icon + text
                  "gap-1.5",
                  // V3 Portal styling
                  "bg-[hsl(var(--portal-bg-secondary))]",
                  "border-[hsl(var(--portal-border))]",
                  "text-[hsl(var(--portal-text-primary))]",
                  "hover:bg-[hsl(var(--portal-bg-hover))]",
                  "hover:border-[hsl(var(--portal-accent-blue))]",
                  // Focus styling
                  "focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]",
                  "focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
                  // Hidden on extra small, visible on xs+ 
                  "hidden xs:inline-flex"
                )}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">Admin</span>
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
            ariaLabel={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
            showDateInOverflow={false}
            dateRangeLabel={compactDateLabel}
          />
        </div>
      </nav>
    </TooltipProvider>
  );
};

ClientHeaderControls.displayName = "ClientHeaderControls";

export default ClientHeaderControls;
