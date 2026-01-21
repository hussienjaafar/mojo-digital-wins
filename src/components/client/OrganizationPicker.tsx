import { useState, useEffect, useMemo } from "react";
import { Check, Building2, Search, Clock, ChevronRight } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const RECENT_ORGS_KEY = "recentOrganizationIds";
const MAX_RECENT = 5;

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: Organization[];
  selectedId: string;
  onSelect: (id: string) => void;
};

function getRecentOrgIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_ORGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToRecent(orgId: string) {
  const recent = getRecentOrgIds().filter((id) => id !== orgId);
  recent.unshift(orgId);
  localStorage.setItem(RECENT_ORGS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export const OrganizationPicker = ({
  open,
  onOpenChange,
  organizations,
  selectedId,
  onSelect,
}: Props) => {
  const [search, setSearch] = useState("");

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (orgId: string) => {
    addToRecent(orgId);
    onSelect(orgId);
    onOpenChange(false);
  };

  // Get recent organizations
  const recentOrgs = useMemo(() => {
    const recentIds = getRecentOrgIds();
    return recentIds
      .map((id) => organizations.find((org) => org.id === id))
      .filter((org): org is Organization => org !== undefined)
      .slice(0, MAX_RECENT);
  }, [organizations]);

  // Filter organizations based on search
  const filteredOrgs = useMemo(() => {
    if (!search.trim()) return organizations;
    const searchLower = search.toLowerCase();
    return organizations.filter((org) =>
      org.name.toLowerCase().includes(searchLower)
    );
  }, [organizations, search]);

  // Separate recent from all for display
  const recentOrgIds = new Set(recentOrgs.map((o) => o.id));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <input
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <CommandList className="max-h-[400px]">
        <CommandEmpty>
          <div className="py-6 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No organizations found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Try a different search term
            </p>
          </div>
        </CommandEmpty>

        {/* Recent Organizations (only show when not searching) */}
        {!search.trim() && recentOrgs.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentOrgs.map((org) => (
                <CommandItem
                  key={`recent-${org.id}`}
                  value={`recent-${org.name}`}
                  onSelect={() => handleSelect(org.id)}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
                  <span className="flex-1 truncate">{org.name}</span>
                  {selectedId === org.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* All Organizations */}
        <CommandGroup heading={`All Organizations (${filteredOrgs.length})`}>
          {filteredOrgs.map((org) => (
            <CommandItem
              key={org.id}
              value={org.name}
              onSelect={() => handleSelect(org.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
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
              <div className="flex-1 min-w-0">
                <span className="block truncate">{org.name}</span>
                {org.role && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {org.role}
                  </span>
                )}
              </div>
              {selectedId === org.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Keyboard hints */}
        <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
            <span>Select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">esc</kbd>
            <span>Close</span>
          </span>
        </div>
      </CommandList>
    </CommandDialog>
  );
};
