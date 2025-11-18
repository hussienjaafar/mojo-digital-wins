import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingCard } from "@/components/ui/loading-spinner";
import { Shield, RefreshCw, Search, ExternalLink, FileText, Calendar, Download } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ExportDialog } from "@/components/reports/ExportDialog";

import type { Database } from "@/integrations/supabase/types";

type ExecutiveOrderRow = Database['public']['Tables']['executive_orders']['Row'];

interface ExecutiveOrder extends ExecutiveOrderRow {
  document_number?: string;
  abstract?: string;
  signing_date?: string;
  publication_date?: string;
  president?: string;
  executive_order_number?: number;
  document_type?: string;
  agencies?: string[];
  topics?: string[];
  auto_tags?: string[];
  html_url?: string;
  pdf_url?: string;
  threat_level?: string;
}

const threatLevelColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-gray-100 text-gray-800 border-gray-300',
};

export function ExecutiveOrders() {
  const [orders, setOrders] = useState<ExecutiveOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ExecutiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [threatFilter, setThreatFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, threatFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('executive_orders')
        .select('*')
        .order('issued_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching executive orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncOrders = async () => {
    try {
      setSyncing(true);
      toast({
        title: "Syncing executive orders...",
        description: "Fetching from Federal Register",
      });

      const { data, error } = await supabase.functions.invoke('fetch-executive-orders', {
        body: { daysBack: 30 }
      });

      if (error) throw error;

      toast({
        title: "Sync complete",
        description: `${data.relevantInserted} relevant orders found, ${data.criticalFound} critical`,
      });

      await fetchOrders();
    } catch (error) {
      console.error('Error syncing orders:', error);
      toast({
        title: "Sync failed",
        description: "Failed to fetch executive orders",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.title.toLowerCase().includes(search) ||
        order.abstract?.toLowerCase().includes(search) ||
        order.auto_tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }

    if (threatFilter !== "all") {
      filtered = filtered.filter(order => order.threat_level === threatFilter);
    }

    setFilteredOrders(filtered);
  };

  if (loading) {
    return <LoadingCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7" />
            Executive Orders
          </h2>
          <p className="text-muted-foreground mt-1">
            Tracking {filteredOrders.length} relevant presidential actions
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDialog
            reportType="executive_orders"
            title="Executive Orders"
            trigger={
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            }
          />
          <Button onClick={syncOrders} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Orders
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders, topics, keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={threatFilter} onValueChange={setThreatFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Threat Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No executive orders found</p>
          <Button onClick={syncOrders} className="mt-4" variant="outline">
            Sync from Federal Register
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className={`${
              order.threat_level === 'critical' ? 'border-red-300' :
              order.threat_level === 'high' ? 'border-orange-300' : ''
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={threatLevelColors[order.threat_level]}>
                        {order.threat_level.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {order.document_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {order.executive_order_number && (
                        <Badge variant="secondary" className="text-xs">
                          EO {order.executive_order_number}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base line-clamp-2">
                      {order.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {order.abstract && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {order.abstract}
                  </p>
                )}

                {/* Tags */}
                {order.auto_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {order.auto_tags.slice(0, 5).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {order.auto_tags.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{order.auto_tags.length - 5}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {order.signing_date && format(new Date(order.signing_date), 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-2">
                    {order.html_url && (
                      <a
                        href={order.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {order.pdf_url && (
                      <a
                        href={order.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" /> PDF
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
