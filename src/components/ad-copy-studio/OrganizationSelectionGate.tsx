/**
 * OrganizationSelectionGate - Full-page "Step 0" organization selection
 * 
 * Appears before the wizard when no organization has been deliberately chosen.
 * Features inline search, recent orgs, logos/initials, and keyboard navigation.
 */

import { useState, useMemo } from "react";
import { Building2, Search, Clock, ArrowRight, Sparkles } from "lucide-react";
import type { AdminOrganization } from "./AdminOrganizationPicker";

const RECENT_ORGS_KEY = "adminRecentOrganizationIds";
const MAX_RECENT = 5;

interface Props {
  organizations: AdminOrganization[];
  onSelect: (id: string) => void;
  onBackToAdmin: () => void;
}

function getRecentOrgIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_ORGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function OrganizationSelectionGate({ organizations, onSelect, onBackToAdmin }: Props) {
  const [search, setSearch] = useState("");

  const recentOrgs = useMemo(() => {
    const recentIds = getRecentOrgIds();
    return recentIds
      .map((id) => organizations.find((org) => org.id === id))
      .filter((org): org is AdminOrganization => org !== undefined)
      .slice(0, MAX_RECENT);
  }, [organizations]);

  const filteredOrgs = useMemo(() => {
    if (!search.trim()) return organizations;
    const q = search.toLowerCase();
    return organizations.filter((org) => org.name.toLowerCase().includes(q));
  }, [organizations, search]);

  const handleSelect = (orgId: string) => {
    // Save to recent
    const recent = getRecentOrgIds().filter((id) => id !== orgId);
    recent.unshift(orgId);
    localStorage.setItem(RECENT_ORGS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
    onSelect(orgId);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-[#a855f7] mx-auto mb-4">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">Ad Copy Studio</h1>
          <p className="text-[#94a3b8]">Select an organization to begin creating ad copy</p>
        </div>

        {/* Search + List Card */}
        <div className="rounded-2xl border border-[#1e2a45] bg-[#141b2d] overflow-hidden shadow-xl">
          {/* Search */}
          <div className="flex items-center border-b border-[#1e2a45] px-4">
            <Search className="h-4 w-4 text-[#64748b] shrink-0" />
            <input
              className="flex h-12 w-full bg-transparent py-3 px-3 text-sm text-[#e2e8f0] outline-none placeholder:text-[#64748b]"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <span className="text-xs text-[#64748b] shrink-0">{filteredOrgs.length} orgs</span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {/* Recent Organizations */}
            {!search.trim() && recentOrgs.length > 0 && (
              <div className="px-3 pt-3 pb-1">
                <p className="px-2 py-1.5 text-xs font-medium text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Recent
                </p>
                <div className="space-y-0.5">
                  {recentOrgs.map((org) => (
                    <OrgRow key={`recent-${org.id}`} org={org} onSelect={() => handleSelect(org.id)} />
                  ))}
                </div>
                <div className="h-px bg-[#1e2a45] mx-2 mt-2" />
              </div>
            )}

            {/* All Organizations */}
            <div className="px-3 py-3">
              <p className="px-2 py-1.5 text-xs font-medium text-[#64748b] uppercase tracking-wider">
                All Organizations ({filteredOrgs.length})
              </p>
              <div className="space-y-0.5">
                {filteredOrgs.length === 0 ? (
                  <div className="py-8 text-center">
                    <Building2 className="h-8 w-8 mx-auto text-[#64748b] mb-2" />
                    <p className="text-sm text-[#94a3b8]">No organizations found</p>
                  </div>
                ) : (
                  filteredOrgs.map((org) => (
                    <OrgRow key={org.id} org={org} onSelect={() => handleSelect(org.id)} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <button
            onClick={onBackToAdmin}
            className="text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            ← Back to Admin
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgRow({ org, onSelect }: { org: AdminOrganization; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full px-3 py-3 text-left rounded-lg transition-colors hover:bg-[#1e2a45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset group"
    >
      {org.logo_url ? (
        <img
          src={org.logo_url}
          alt=""
          className="h-9 w-9 rounded-lg object-contain shrink-0 bg-[#0a0f1a] border border-[#1e2a45]"
        />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-[#0a0f1a] border border-[#1e2a45] flex items-center justify-center text-[11px] font-medium text-[#94a3b8] shrink-0">
          {org.name.substring(0, 2).toUpperCase()}
        </div>
      )}
      <span className="flex-1 truncate text-sm text-[#e2e8f0] font-medium">
        {org.name}
      </span>
      <ArrowRight className="h-4 w-4 text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
