import { ChevronDown, Check, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  const [open, setOpen] = useState(false);

  const selectedOrg = organizations.find((org) => org.id === selectedId);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  // Only hide for non-admins with single org
  if (!isAdmin && organizations.length <= 1) {
    return null;
  }

  // Mobile: Use bottom sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
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
            <ChevronDown className={cn("h-3.5 w-3.5", !isAdmin && "portal-text-muted")} />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[60vh] bg-background border-t">
          <SheetHeader>
            <SheetTitle className="text-left">Switch Organization</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelect(org.id)}
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
                {selectedId === org.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Clean dropdown with admin-aware styling
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button 
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
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-64 bg-popover border shadow-lg z-50"
        sideOffset={8}
      >
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
          {isAdmin ? "Admin: Switch Organization" : "Switch Organization"}
        </div>
        <div className="py-1 max-h-[300px] overflow-y-auto">
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSelect(org.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 cursor-pointer",
                selectedId === org.id && "bg-accent"
              )}
            >
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt=""
                  className="h-6 w-6 rounded object-contain shrink-0"
                />
              ) : (
                <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                  {org.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="flex-1 truncate text-sm">{org.name}</span>
              {selectedId === org.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
