import { ChevronDown, Building2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { OrganizationPicker } from "./OrganizationPicker";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

type Props = {
  organizations: Organization[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** When true, shows a more prominent admin-style switcher */
  isAdmin?: boolean;
};

export const OrganizationSelector = ({
  organizations,
  selectedId,
  onSelect,
  isAdmin = false,
}: Props) => {
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + K to open picker (admin only)
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPickerOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin]);

  // Only hide for non-admins with single org
  if (!isAdmin && organizations.length <= 1) {
    return null;
  }

  const handleMobileSelect = (id: string) => {
    onSelect(id);
    setMobileSheetOpen(false);
  };

  // Mobile: Use bottom sheet for simple selection
  if (isMobile) {
    return (
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1 transition-colors",
              isAdmin
                ? "px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium"
                : "portal-icon-btn !w-auto !h-auto p-1"
            )}
            aria-label="Switch organization"
          >
            {isAdmin && <Building2 className="h-3 w-3" />}
            {isAdmin && <span>Switch</span>}
            <ChevronDown
              className={cn("h-3.5 w-3.5", !isAdmin && "portal-text-muted")}
            />
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[60vh] bg-background border-t"
        >
          <SheetHeader>
            <SheetTitle className="text-left">Switch Organization</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1 overflow-y-auto max-h-[calc(60vh-80px)]">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleMobileSelect(org.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                  "hover:bg-muted/50",
                  selectedId === org.id && "bg-muted"
                )}
              >
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt=""
                    className="h-6 w-6 rounded object-contain"
                  />
                ) : (
                  <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
                    {org.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{org.name}</div>
                  {org.role && (
                    <div className="text-xs text-muted-foreground capitalize">
                      {org.role}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use command palette picker
  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors",
          isAdmin
            ? "px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Switch organization"
      >
        {isAdmin && <Building2 className="h-3 w-3" />}
        {isAdmin && <span>Switch</span>}
        <ChevronDown className="h-3.5 w-3.5" />
        {isAdmin && (
          <kbd className="ml-1 px-1 py-0.5 bg-primary/20 rounded text-[10px] font-mono hidden sm:inline">
            ⌘K
          </kbd>
        )}
      </button>

      <OrganizationPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        organizations={organizations}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </>
  );
};
