import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BillCard } from "./BillCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingCard } from "@/components/ui/loading-spinner";
import { RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BillTracker() {
  const [bills, setBills] = useState<any[]>([]);
  const [filteredBills, setFilteredBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("relevance");
  const { toast } = useToast();

  useEffect(() => {
    fetchBills();
  }, []);

  useEffect(() => {
    filterAndSortBills();
  }, [bills, searchTerm, statusFilter, sortBy]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('relevance_score', { ascending: false })
        .limit(100);

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching bills:', error);
      }
      toast({
        title: "Error",
        description: "Failed to fetch bills",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncBills = async () => {
    try {
      setSyncing(true);
      toast({
        title: "Syncing bills...",
        description: "Fetching latest bills from Congress.gov",
      });

      const { data, error } = await supabase.functions.invoke('sync-congress-bills');

      if (error) throw error;

      toast({
        title: "Sync complete",
        description: `${data.billsInserted} relevant bills synced`,
      });

      await fetchBills();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing bills:', error);
      }
      toast({
        title: "Sync failed",
        description: "Failed to sync bills from Congress.gov",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const filterAndSortBills = () => {
    let filtered = [...bills];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(bill =>
        bill.title.toLowerCase().includes(search) ||
        bill.bill_number.toLowerCase().includes(search) ||
        bill.sponsor_name?.toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(bill => bill.current_status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "relevance":
          return b.relevance_score - a.relevance_score;
        case "date":
          return new Date(b.introduced_date || 0).getTime() - new Date(a.introduced_date || 0).getTime();
        case "action":
          return new Date(b.latest_action_date || 0).getTime() - new Date(a.latest_action_date || 0).getTime();
        default:
          return 0;
      }
    });

    setFilteredBills(filtered);
  };

  if (loading) {
    return <LoadingCard />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">Congressional Bill Tracker</h2>
          <p className="text-muted-foreground mt-1">
            Tracking {filteredBills.length} relevant bills
          </p>
        </div>
        <Button onClick={syncBills} disabled={syncing} variant="smooth">
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          Sync Bills
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bills, sponsors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="introduced">Introduced</SelectItem>
            <SelectItem value="in_committee">In Committee</SelectItem>
            <SelectItem value="passed_house">Passed House</SelectItem>
            <SelectItem value="passed_senate">Passed Senate</SelectItem>
            <SelectItem value="passed_both">Passed Both</SelectItem>
            <SelectItem value="enacted">Enacted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="date">Introduced Date</SelectItem>
            <SelectItem value="action">Latest Action</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bills Grid */}
      {filteredBills.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No bills found matching your criteria</p>
          <Button onClick={syncBills} className="mt-4" variant="smooth">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Bills from Congress.gov
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBills.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      )}
    </div>
  );
}
