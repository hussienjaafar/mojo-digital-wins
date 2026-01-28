import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Search, ChevronUp, ChevronDown, Phone, Mail, MapPin, Briefcase, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/chart-formatters";
import type { SegmentDonor } from "@/types/donorSegment";
import { useVirtualizer } from "@tanstack/react-virtual";

type SortField = 'name' | 'email' | 'phone' | 'state' | 'city' | 'total_donated' | 'donation_count' | 'segment' | 'churn_risk_label' | 'employer' | 'occupation';
type SortDirection = 'asc' | 'desc';

interface DonorListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donors: SegmentDonor[];
  totalCount: number;
}

// Helper to check if phone is valid (at least 7 digits)
function isValidPhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7;
}

// Format phone number to (555) 123-4567 format
function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone; // Return original if can't format
}

// Format snake_case segment names to Title Case
const formatSegmentLabel = (name: string): string => {
  if (!name) return "Unknown";
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const columns = [
  { key: 'name' as SortField, label: 'Name', width: '14%' },
  { key: 'email' as SortField, label: 'Email', width: '16%' },
  { key: 'phone' as SortField, label: 'Phone', width: '11%' },
  { key: 'state' as SortField, label: 'State', width: '6%' },
  { key: 'city' as SortField, label: 'City', width: '10%' },
  { key: 'total_donated' as SortField, label: 'Lifetime $', width: '9%' },
  { key: 'donation_count' as SortField, label: 'Donations', width: '7%' },
  { key: 'segment' as SortField, label: 'Segment', width: '11%' },
  { key: 'churn_risk_label' as SortField, label: 'Risk', width: '7%' },
  { key: 'employer' as SortField, label: 'Employer', width: '9%' },
];

export function DonorListSheet({ open, onOpenChange, donors, totalCount }: DonorListSheetProps) {
  const [sortField, setSortField] = useState<SortField>('total_donated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Callback ref to detect when scroll container mounts
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    if (node) {
      setIsReady(true);
    }
  }, []);

  // Reset ready state when sheet closes
  useEffect(() => {
    if (!open) {
      setIsReady(false);
    }
  }, [open]);

  // Filter by search term
  const filteredDonors = useMemo(() => {
    if (!searchTerm.trim()) return donors;
    const lower = searchTerm.toLowerCase();
    return donors.filter(d =>
      d.name?.toLowerCase().includes(lower) ||
      d.email?.toLowerCase().includes(lower) ||
      d.phone?.includes(searchTerm) ||
      d.city?.toLowerCase().includes(lower) ||
      d.state?.toLowerCase().includes(lower) ||
      d.employer?.toLowerCase().includes(lower)
    );
  }, [donors, searchTerm]);

  // Sort filtered results
  const sortedDonors = useMemo(() => {
    return [...filteredDonors].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Special handling for phone - treat invalid phones as null
      if (sortField === 'phone') {
        const aValid = isValidPhone(aVal);
        const bValid = isValidPhone(bVal);
        
        // Both invalid/null - equal
        if (!aValid && !bValid) return 0;
        // Push invalid to end
        if (!aValid) return 1;
        if (!bValid) return -1;
        
        // Both valid - compare strings
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle nulls - push to end
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Numeric comparison
      if (sortField === 'total_donated' || sortField === 'donation_count') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredDonors, sortField, sortDirection]);

  const rowVirtualizer = useVirtualizer({
    count: sortedDonors.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 15,
    enabled: isReady,  // Only enable when container is ready
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'total_donated' || field === 'donation_count' ? 'desc' : 'asc');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'State', 'City', 'ZIP', 'Lifetime $', 'Donations', 'Segment', 'Churn Risk', 'Employer', 'Occupation'];
    const rows = sortedDonors.map(d => [
      d.name || '',
      d.email || '',
      d.phone || '',
      d.state || '',
      d.city || '',
      d.zip || '',
      d.total_donated.toString(),
      d.donation_count.toString(),
      d.segment || '',
      d.churn_risk_label || '',
      d.employer || '',
      d.occupation || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donor-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-none sm:w-[95vw] lg:w-[90vw] xl:w-[85vw] flex flex-col"
      >
        <SheetHeader className="pb-4 border-b border-[hsl(var(--portal-border))]">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl">
                Donor List
              </SheetTitle>
              <SheetDescription className="mt-1">
                {sortedDonors.length === totalCount 
                  ? `${totalCount.toLocaleString()} donors`
                  : `${sortedDonors.length.toLocaleString()} of ${totalCount.toLocaleString()} donors`
                }
              </SheetDescription>
            </div>
          </div>

          {/* Search and Export */}
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
              <Input
                placeholder="Search by name, email, phone, city, state, or employer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 h-9 bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-[hsl(var(--portal-accent-blue))] text-white hover:bg-[hsl(var(--portal-accent-blue)/0.9)] transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </SheetHeader>

        {/* Table */}
        <div className="flex-1 flex flex-col min-h-0 mt-4">
          {/* Header */}
          <div className="flex items-center px-3 py-2 bg-[hsl(var(--portal-bg-elevated))] border-b border-[hsl(var(--portal-border))] rounded-t-md">
            {columns.map(col => (
              <div
                key={col.key}
                style={{ width: col.width }}
                className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider cursor-pointer hover:text-[hsl(var(--portal-text-primary))] transition-colors select-none"
                onClick={() => handleSort(col.key)}
              >
                <span className="truncate">{col.label}</span>
                <SortIndicator field={col.key} />
              </div>
            ))}
          </div>

          {/* Virtualized rows */}
          <div
            ref={setScrollRef}
            className="flex-1 overflow-auto border-x border-b border-[hsl(var(--portal-border))] rounded-b-md"
          >
            {sortedDonors.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[hsl(var(--portal-text-muted))]">
                No donors match your search
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const donor = sortedDonors[virtualRow.index];
                  return (
                    <div
                      key={donor.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className={cn(
                        "flex items-center px-3 py-2 border-b border-[hsl(var(--portal-border))]",
                        "hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
                      )}
                    >
                      <div style={{ width: '14%' }} className="truncate text-sm text-[hsl(var(--portal-text-primary))]">
                        {donor.name || '—'}
                      </div>
                      <div style={{ width: '16%' }} className="truncate text-sm text-[hsl(var(--portal-text-muted))]">
                        {donor.email ? (
                          <a href={`mailto:${donor.email}`} className="hover:text-[hsl(var(--portal-accent-blue))] transition-colors">
                            {donor.email}
                          </a>
                        ) : '—'}
                      </div>
                      <div style={{ width: '11%' }} className="truncate text-sm text-[hsl(var(--portal-text-muted))]">
                        {donor.phone ? (
                          <a href={`tel:${donor.phone}`} className="hover:text-[hsl(var(--portal-accent-blue))] transition-colors">
                            {formatPhone(donor.phone)}
                          </a>
                        ) : '—'}
                      </div>
                      <div style={{ width: '6%' }} className="text-sm text-[hsl(var(--portal-text-muted))]">
                        {donor.state || '—'}
                      </div>
                      <div style={{ width: '10%' }} className="truncate text-sm text-[hsl(var(--portal-text-muted))]">
                        {donor.city || '—'}
                      </div>
                      <div style={{ width: '9%' }} className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                        {formatCurrency(donor.total_donated)}
                      </div>
                      <div style={{ width: '7%' }} className="text-sm text-[hsl(var(--portal-text-muted))]">
                        {donor.donation_count}
                      </div>
                      <div style={{ width: '11%' }}>
                        {donor.segment ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] truncate max-w-full">
                            {formatSegmentLabel(donor.segment)}
                          </span>
                        ) : (
                          <span className="text-sm text-[hsl(var(--portal-text-muted))]">—</span>
                        )}
                      </div>
                      <div style={{ width: '7%' }}>
                        {donor.churn_risk_label ? (
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                            donor.churn_risk_label === 'high' && "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
                            donor.churn_risk_label === 'medium' && "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
                            donor.churn_risk_label === 'low' && "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]"
                          )}>
                            {donor.churn_risk_label.charAt(0).toUpperCase() + donor.churn_risk_label.slice(1)}
                          </span>
                        ) : (
                          <span className="text-sm text-[hsl(var(--portal-text-muted))]">—</span>
                        )}
                      </div>
                      <div style={{ width: '9%' }} className="truncate text-sm text-[hsl(var(--portal-text-muted))]">
                        {donor.employer || '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}