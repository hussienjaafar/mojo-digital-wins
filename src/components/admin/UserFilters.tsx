import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X } from "lucide-react";
import { V3Button } from "@/components/v3/V3Button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Organization {
  id: string;
  name: string;
}

interface UserFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedOrg: string;
  onOrgChange: (value: string) => void;
  selectedRoles: string[];
  onRolesChange: (roles: string[]) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  organizations: Organization[];
  totalCount: number;
  filteredCount: number;
}

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

export function UserFilters({
  searchQuery,
  onSearchChange,
  selectedOrg,
  onOrgChange,
  selectedRoles,
  onRolesChange,
  selectedStatus,
  onStatusChange,
  organizations,
  totalCount,
  filteredCount,
}: UserFiltersProps) {
  const [orgSearchOpen, setOrgSearchOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter((r) => r !== role));
    } else {
      onRolesChange([...selectedRoles, role]);
    }
  };

  const clearFilters = () => {
    onSearchChange("");
    onOrgChange("all");
    onRolesChange([]);
    onStatusChange("all");
  };

  const hasActiveFilters = searchQuery || selectedOrg !== "all" || selectedRoles.length > 0 || selectedStatus !== "all";

  const selectedOrgName = selectedOrg === "all" 
    ? "All Organizations" 
    : organizations.find(o => o.id === selectedOrg)?.name || "Select Organization";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Organization Selector with Search */}
        <Popover open={orgSearchOpen} onOpenChange={setOrgSearchOpen}>
          <PopoverTrigger asChild>
            <V3Button variant="outline" className="w-full sm:w-[220px] justify-start">
              <Filter className="h-4 w-4 mr-2" />
              <span className="truncate">{selectedOrgName}</span>
            </V3Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search organizations..." 
                value={orgSearch}
                onValueChange={setOrgSearch}
              />
              <CommandList>
                <CommandEmpty>No organizations found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onOrgChange("all");
                      setOrgSearchOpen(false);
                      setOrgSearch("");
                    }}
                  >
                    All Organizations
                  </CommandItem>
                  {filteredOrgs.map((org) => (
                    <CommandItem
                      key={org.id}
                      onSelect={() => {
                        onOrgChange(org.id);
                        setOrgSearchOpen(false);
                        setOrgSearch("");
                      }}
                    >
                      {org.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <Select value={selectedStatus} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Role Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Roles:</span>
        {ROLES.map((role) => (
          <Badge
            key={role.value}
            variant={selectedRoles.includes(role.value) ? "default" : "outline"}
            className="cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => toggleRole(role.value)}
          >
            {role.label}
          </Badge>
        ))}
        
        {hasActiveFilters && (
          <V3Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="ml-auto text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </V3Button>
        )}
      </div>

      {/* Results Count */}
      {hasActiveFilters && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredCount} of {totalCount} members
        </div>
      )}
    </div>
  );
}
