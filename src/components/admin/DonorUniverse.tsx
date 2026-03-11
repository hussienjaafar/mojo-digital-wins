import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader, AdminLoadingState } from "./v3";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { V3Button } from "@/components/v3/V3Button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, Search, Users, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { toast } from "sonner";
import { DonorUniverseDetail } from "./DonorUniverseDetail";

interface DonorRow {
  identity_key: string;
  donor_email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  employer: string | null;
  occupation: string | null;
  age: number | null;
  gender: string | null;
  party_affiliation: string | null;
  voter_score: number | null;
  voter_file_matched: boolean | null;
  total_donated: number | null;
  donation_count: number | null;
  is_recurring: boolean | null;
  first_donation_date: string | null;
  last_donation_date: string | null;
  all_orgs: string[];
  crossover_count: number;
  channels: string[];
  topics: string[] | null;
  issues: string[] | null;
  pain_points: string[] | null;
  values_appealed: string[] | null;
}

interface DonorUniverseResult {
  donors: DonorRow[];
  total_count: number;
  crossover_count: number;
}

interface Org {
  id: string;
  name: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  sms: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  meta: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  organic: "bg-muted text-muted-foreground border-border",
  email: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

const PAGE_SIZE = 100;

export function DonorUniverse() {
  const [data, setData] = useState<DonorUniverseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [recurringFilter, setRecurringFilter] = useState<string>("all");
  const [crossoverOnly, setCrossoverOnly] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch orgs once
  useEffect(() => {
    supabase
      .from("client_organizations")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setOrgs(data || []));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        _page: page,
        _page_size: PAGE_SIZE,
        _crossover_only: crossoverOnly,
      };
      if (debouncedSearch) params._search = debouncedSearch;
      if (stateFilter) params._state_filter = stateFilter;
      if (channelFilter) params._channel_filter = channelFilter;
      if (orgFilter) params._org_filter = [orgFilter];
      if (recurringFilter === "yes") params._recurring_filter = true;
      if (recurringFilter === "no") params._recurring_filter = false;

      const { data: result, error } = await supabase.rpc("get_donor_universe", params);
      if (error) throw error;
      setData(result as unknown as DonorUniverseResult);
    } catch (err: any) {
      toast.error("Failed to load donor universe: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, stateFilter, channelFilter, orgFilter, recurringFilter, crossoverOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total_count / PAGE_SIZE) : 0;

  const handleExport = () => {
    if (!data?.donors?.length) return;
    exportToCSV(
      data.donors.map((d) => ({
        ...d,
        all_orgs: d.all_orgs?.join("; ") || "",
        channels: d.channels?.join("; ") || "",
      })) as any,
      `donor-universe-${new Date().toISOString().split("T")[0]}.csv`,
      [
        { key: "donor_email", label: "Email" },
        { key: "first_name", label: "First Name" },
        { key: "last_name", label: "Last Name" },
        { key: "phone", label: "Phone" },
        { key: "state", label: "State" },
        { key: "zip", label: "Zip" },
        { key: "employer", label: "Employer" },
        { key: "occupation", label: "Occupation" },
        { key: "total_donated", label: "Total Donated" },
        { key: "donation_count", label: "# Donations" },
        { key: "is_recurring", label: "Recurring" },
        { key: "first_donation_date", label: "First Donation" },
        { key: "last_donation_date", label: "Last Donation" },
        { key: "all_orgs", label: "Organizations" },
        { key: "crossover_count", label: "# Orgs" },
        { key: "channels", label: "Channels" },
        { key: "party_affiliation", label: "Party" },
        { key: "voter_score", label: "Voter Score" },
      ]
    );
    toast.success("Export started");
  };

  const formatCurrency = (val: number | null) =>
    val != null ? `$${val.toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "—";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Donor Universe"
        description={`Cross-organization donor view${data ? ` — ${data.total_count.toLocaleString()} donors, ${data.crossover_count.toLocaleString()} crossover` : ""}`}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={orgFilter} onValueChange={(v) => { setOrgFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="All Orgs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orgs</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channelFilter || "all"} onValueChange={(v) => { setChannelFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="All Channels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="meta">Meta Ads</SelectItem>
            <SelectItem value="organic">Organic</SelectItem>
          </SelectContent>
        </Select>
        <Select value={recurringFilter} onValueChange={(v) => { setRecurringFilter(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Recurring" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Donors</SelectItem>
            <SelectItem value="yes">Recurring Only</SelectItem>
            <SelectItem value="no">One-time Only</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={crossoverOnly} onCheckedChange={(v) => { setCrossoverOnly(v); setPage(1); }} id="crossover" />
          <Label htmlFor="crossover" className="text-sm whitespace-nowrap">Crossover Only</Label>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `Showing ${((page - 1) * PAGE_SIZE) + 1}–${Math.min(page * PAGE_SIZE, data.total_count)} of ${data.total_count.toLocaleString()}` : "Loading..."}
        </p>
        <V3Button variant="secondary" size="sm" onClick={handleExport} disabled={!data?.donors?.length}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </V3Button>
      </div>

      {/* Table */}
      {loading && !data ? (
        <AdminLoadingState />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground w-8" />
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">State</th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground"># Dons</th>
                   <th className="px-3 py-3 text-left font-medium text-muted-foreground">Channels</th>
                   <th className="px-3 py-3 text-left font-medium text-muted-foreground">Top Topic</th>
                   <th className="px-3 py-3 text-left font-medium text-muted-foreground">Orgs</th>
                </tr>
              </thead>
              <tbody>
                {data?.donors?.map((d) => {
                  const isExpanded = expandedRow === d.identity_key;
                  return (
                    <>
                      <tr
                        key={d.identity_key}
                        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : d.identity_key)}
                      >
                        <td className="px-3 py-2.5">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {[d.first_name, d.last_name].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">{d.donor_email}</td>
                        <td className="px-3 py-2.5">{d.state || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(d.total_donated)}</td>
                        <td className="px-3 py-2.5 text-right">{d.donation_count ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {d.channels?.map((ch) => (
                              <Badge
                                key={ch}
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${CHANNEL_COLORS[ch] || CHANNEL_COLORS.organic}`}
                              >
                                {ch === "meta" ? "Meta" : ch.toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {d.crossover_count > 1 && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                                <Users className="h-3 w-3 mr-0.5" />
                                {d.crossover_count}
                              </Badge>
                            )}
                            <span className="text-muted-foreground text-xs truncate max-w-[120px]">
                              {d.all_orgs?.join(", ")}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${d.identity_key}-detail`}>
                          <td colSpan={8} className="p-0">
                            <DonorUniverseDetail donor={d} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {data?.donors?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      No donors match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
              <V3Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </V3Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages.toLocaleString()}
              </span>
              <V3Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </V3Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
