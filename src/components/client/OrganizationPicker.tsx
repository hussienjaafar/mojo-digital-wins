import { useState, useEffect, useMemo } from "react";
import { Check, Building2, Search, Clock } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
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

// Organization list item component
const OrgListItem = ({
  org,
  isSelected,
  showClockIcon,
  onSelect,
}: {
  org: Organization;
  isSelected: boolean;
  showClockIcon?: boolean;
  onSelect: () => void;
}) => (
  <button
    onClick={onSelect}
    className={cn(
      "flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-md transition-colors duration-150",
      "hover:bg-[hsl(var(--portal-bg-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:ring-inset",
      isSelected && "bg-[hsl(var(--portal-bg-elevated))] border-l-2 border-[hsl(var(--portal-accent-blue))] -ml-[2px] pl-[14px]"
    )}
  >
    {showClockIcon && (
      <Clock className="h-3.5 w-3.5 text-[hsl(var(--portal-text-muted))] shrink-0" />
    )}
    {org.logo_url ? (
      <img
        src={org.logo_url}
        alt=""
        className="h-7 w-7 rounded-md object-contain shrink-0 bg-[hsl(var(--portal-bg-elevated))]"
      />
    ) : (
      <div className="h-7 w-7 rounded-md bg-[hsl(var(--portal-bg-elevated))] flex items-center justify-center text-[10px] font-medium text-[hsl(var(--portal-text-secondary))] shrink-0">
        {org.name.substring(0, 2).toUpperCase()}
      </div>
    )}
    <span className="flex-1 truncate text-sm text-[hsl(var(--portal-text-primary))]">
      {org.name}
    </span>
    {isSelected && (
      <Check className="h-4 w-4 text-[hsl(var(--portal-accent-blue))] shrink-0" />
    )}
  </button>
);

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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex items-center border-b border-[hsl(var(--portal-border))] px-3 bg-[hsl(var(--portal-bg-secondary))]">
        <Search className="mr-2 h-4 w-4 shrink-0 text-[hsl(var(--portal-text-muted))]" />
        <input
          className="flex h-12 w-full bg-transparent py-3 text-sm text-[hsl(var(--portal-text-primary))] outline-none placeholder:text-[hsl(var(--portal-text-muted))] disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <CommandList className="max-h-[400px] bg-[hsl(var(--portal-bg-secondary))]">
        <CommandEmpty>
          <div className="py-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-[hsl(var(--portal-text-muted))] mb-3" />
            <p className="text-sm text-[hsl(var(--portal-text-secondary))]">No organizations found</p>
            <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
              Try a different search term
            </p>
          </div>
        </CommandEmpty>

        {/* Recent Organizations (only show when not searching) */}
        {!search.trim() && recentOrgs.length > 0 && (
          <>
            <CommandGroup className="px-2 py-2">
              <p className="px-2 py-1.5 text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider">
                Recent
              </p>
              <div className="space-y-0.5">
                {recentOrgs.map((org) => (
                  <OrgListItem
                    key={`recent-${org.id}`}
                    org={org}
                    isSelected={selectedId === org.id}
                    showClockIcon
                    onSelect={() => handleSelect(org.id)}
                  />
                ))}
              </div>
            </CommandGroup>
            <CommandSeparator className="bg-[hsl(var(--portal-border))]" />
          </>
        )}

        {/* All Organizations */}
        <CommandGroup className="px-2 py-2">
          <p className="px-2 py-1.5 text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider">
            All Organizations ({filteredOrgs.length})
          </p>
          <div className="space-y-0.5">
            {filteredOrgs.map((org) => (
              <OrgListItem
                key={org.id}
                org={org}
                isSelected={selectedId === org.id}
                onSelect={() => handleSelect(org.id)}
              />
            ))}
          </div>
        </CommandGroup>

        {/* Keyboard hints */}
        <div className="border-t border-[hsl(var(--portal-border))] px-3 py-2.5 text-xs text-[hsl(var(--portal-text-muted))] flex items-center gap-5 bg-[hsl(var(--portal-bg-primary))]">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono border border-[hsl(var(--portal-border))]">↑↓</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono border border-[hsl(var(--portal-border))]">↵</kbd>
            <span>Select</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono border border-[hsl(var(--portal-border))]">esc</kbd>
            <span>Close</span>
          </span>
        </div>
      </CommandList>
    </CommandDialog>
  );
};
