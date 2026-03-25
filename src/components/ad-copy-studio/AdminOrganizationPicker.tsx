/**
 * AdminOrganizationPicker - Dark-themed command palette for selecting organizations
 * 
 * Features:
 * - Full-text search across all organizations
 * - Recent organizations (localStorage-backed, max 5)
 * - Org logos with initials fallback
 * - Keyboard navigation (↑↓ navigate, Enter select, Esc close)
 * - Scales to hundreds of organizations via client-side filtering
 */

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

// =============================================================================
// Constants
// =============================================================================

const RECENT_ORGS_KEY = "adminRecentOrganizationIds";
const MAX_RECENT = 5;

// =============================================================================
// Types
// =============================================================================

export type AdminOrganization = {
  id: string;
  name: string;
  logo_url: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: AdminOrganization[];
  selectedId: string;
  onSelect: (id: string) => void;
};

// =============================================================================
// localStorage helpers
// =============================================================================

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

// =============================================================================
// OrgListItem
// =============================================================================

const OrgListItem = ({
  org,
  isSelected,
  showClockIcon,
  onSelect,
  searchQuery,
}: {
  org: AdminOrganization;
  isSelected: boolean;
  showClockIcon?: boolean;
  onSelect: () => void;
  searchQuery?: string;
}) => {
  // Highlight matching text in org name
  const renderName = () => {
    if (!searchQuery?.trim()) {
      return <span>{org.name}</span>;
    }
    const q = searchQuery.toLowerCase();
    const idx = org.name.toLowerCase().indexOf(q);
    if (idx === -1) return <span>{org.name}</span>;
    return (
      <span>
        {org.name.slice(0, idx)}
        <mark className="bg-blue-500/30 text-[#e2e8f0] rounded-sm px-0.5">{org.name.slice(idx, idx + searchQuery.length)}</mark>
        {org.name.slice(idx + searchQuery.length)}
      </span>
    );
  };

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-md transition-colors duration-150",
        "hover:bg-[#1e2a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
        isSelected && "bg-[#1e2a45]/60 border-l-2 border-blue-500 -ml-[2px] pl-[14px]"
      )}
    >
      {showClockIcon && (
        <Clock className="h-3.5 w-3.5 text-[#64748b] shrink-0" />
      )}
      {org.logo_url ? (
        <img
          src={org.logo_url}
          alt=""
          className="h-7 w-7 rounded-md object-contain shrink-0 bg-[#0a0f1a]"
        />
      ) : (
        <div className="h-7 w-7 rounded-md bg-[#0a0f1a] flex items-center justify-center text-[10px] font-medium text-[#94a3b8] shrink-0">
          {org.name.substring(0, 2).toUpperCase()}
        </div>
      )}
      <span className="flex-1 truncate text-sm text-[#e2e8f0]">
        {renderName()}
      </span>
      {isSelected && (
        <Check className="h-4 w-4 text-blue-400 shrink-0" />
      )}
    </button>
  );
};

// =============================================================================
// AdminOrganizationPicker
// =============================================================================

export function AdminOrganizationPicker({
  open,
  onOpenChange,
  organizations,
  selectedId,
  onSelect,
}: Props) {
  const [search, setSearch] = useState("");

  // Reset search when dialog opens
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const handleSelect = (orgId: string) => {
    addToRecent(orgId);
    onSelect(orgId);
    onOpenChange(false);
  };

  // Recent organizations
  const recentOrgs = useMemo(() => {
    const recentIds = getRecentOrgIds();
    return recentIds
      .map((id) => organizations.find((org) => org.id === id))
      .filter((org): org is AdminOrganization => org !== undefined)
      .slice(0, MAX_RECENT);
  }, [organizations]);

  // Filtered organizations
  const filteredOrgs = useMemo(() => {
    if (!search.trim()) return organizations;
    const q = search.toLowerCase();
    return organizations.filter((org) => org.name.toLowerCase().includes(q));
  }, [organizations, search]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Search input */}
      <div className="flex items-center border-b border-[#1e2a45] px-3 bg-[#141b2d]">
        <Search className="mr-2 h-4 w-4 shrink-0 text-[#64748b]" />
        <input
          className="flex h-12 w-full bg-transparent py-3 text-sm text-[#e2e8f0] outline-none placeholder:text-[#64748b] disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <CommandList className="max-h-[400px] bg-[#141b2d]">
        <CommandEmpty>
          <div className="py-8 text-center">
            <Building2 className="h-10 w-10 mx-auto text-[#64748b] mb-3" />
            <p className="text-sm text-[#94a3b8]">No organizations found</p>
            <p className="text-xs text-[#64748b] mt-1">Try a different search term</p>
          </div>
        </CommandEmpty>

        {/* Recent Organizations (only when not searching) */}
        {!search.trim() && (
          <>
            <CommandGroup className="px-2 py-2">
              <p className="px-2 py-1.5 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                Recent
              </p>
              {recentOrgs.length > 0 ? (
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
              ) : (
                <p className="px-2 py-2 text-xs text-[#64748b] italic">
                  Your recent organizations will appear here
                </p>
              )}
            </CommandGroup>
            <CommandSeparator className="bg-[#1e2a45]" />
          </>
        )}

        {/* All Organizations */}
        <CommandGroup className="px-2 py-2">
          <p className="px-2 py-1.5 text-xs font-medium text-[#64748b] uppercase tracking-wider">
            All Organizations ({filteredOrgs.length})
          </p>
          <div className="space-y-0.5">
            {filteredOrgs.map((org) => (
              <OrgListItem
                key={org.id}
                org={org}
                isSelected={selectedId === org.id}
                onSelect={() => handleSelect(org.id)}
                searchQuery={search}
              />
            ))}
          </div>
        </CommandGroup>

        {/* Keyboard hints */}
        <div className="border-t border-[#1e2a45] px-3 py-2.5 text-xs text-[#64748b] flex items-center gap-5 bg-[#0a0f1a]">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#1e2a45] rounded text-[10px] font-mono border border-[#2d3b55]">↑↓</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#1e2a45] rounded text-[10px] font-mono border border-[#2d3b55]">↵</kbd>
            <span>Select</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#1e2a45] rounded text-[10px] font-mono border border-[#2d3b55]">esc</kbd>
            <span>Close</span>
          </span>
        </div>
      </CommandList>
    </CommandDialog>
  );
}
