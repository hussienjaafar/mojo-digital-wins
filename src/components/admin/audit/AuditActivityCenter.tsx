import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Search, 
  Download, 
  RefreshCw, 
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  Building2,
  FileText,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  table_affected: string | null;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
}

interface Organization {
  id: string;
  name: string;
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-600 border-green-500/20",
  update: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  delete: "bg-red-500/10 text-red-600 border-red-500/20",
  login: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  test: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

export function AuditActivityCenter() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("7d");

  useEffect(() => {
    fetchOrganizations();
    fetchLogs();
  }, [dateRange]);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from("client_organizations")
      .select("id, name")
      .order("name");
    
    if (data) setOrganizations(data);
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    
    // Calculate date filter
    const now = new Date();
    let fromDate = new Date();
    switch (dateRange) {
      case "24h": fromDate.setHours(now.getHours() - 24); break;
      case "7d": fromDate.setDate(now.getDate() - 7); break;
      case "30d": fromDate.setDate(now.getDate() - 30); break;
      case "90d": fromDate.setDate(now.getDate() - 90); break;
      default: fromDate.setDate(now.getDate() - 7);
    }

    const { data, error } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .gte("created_at", fromDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error("Failed to load audit logs");
      setIsLoading(false);
      return;
    }

    // Fetch user emails for display
    const userIds = [...new Set(data?.map(l => l.user_id) || [])];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);
    
    const enriched = (data || []).map(log => ({
      ...log,
      user_email: emailMap.get(log.user_id) || log.user_id,
      old_value: log.old_value as Record<string, unknown> | null,
      new_value: log.new_value as Record<string, unknown> | null,
    }));

    setLogs(enriched);
    setIsLoading(false);
  };

  // Get unique action types and tables for filters
  const actionTypes = useMemo(() => 
    [...new Set(logs.map(l => l.action_type))].sort(), 
    [logs]
  );
  
  const tables = useMemo(() => 
    [...new Set(logs.map(l => l.table_affected).filter(Boolean))].sort() as string[], 
    [logs]
  );

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (searchTerm && !JSON.stringify(log).toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (selectedAction !== "all" && log.action_type !== selectedAction) {
        return false;
      }
      if (selectedTable !== "all" && log.table_affected !== selectedTable) {
        return false;
      }
      return true;
    });
  }, [logs, searchTerm, selectedAction, selectedTable]);

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exportToCSV = () => {
    const headers = ["Timestamp", "User", "Action", "Table", "Record ID", "Details"];
    const csvData = filteredLogs.map(log => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.user_email || log.user_id,
      log.action_type,
      log.table_affected || "-",
      log.record_id || "-",
      JSON.stringify(log.new_value || {}).replace(/,/g, ";"),
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Audit logs exported to CSV");
  };

  const getActionBadge = (actionType: string) => {
    const colorClass = ACTION_TYPE_COLORS[actionType.split("_")[0]] || "bg-muted text-muted-foreground";
    return <Badge variant="outline" className={colorClass}>{actionType}</Badge>;
  };

  const renderDiff = (oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) => {
    if (!oldValue && !newValue) return null;
    
    const allKeys = new Set([
      ...Object.keys(oldValue || {}),
      ...Object.keys(newValue || {})
    ]);

    // Filter out sensitive keys
    const sensitiveKeys = ['encrypted_credentials', 'password', 'secret', 'token', 'api_key'];
    const safeKeys = [...allKeys].filter(key => 
      !sensitiveKeys.some(sk => key.toLowerCase().includes(sk))
    );

    if (safeKeys.length === 0) {
      return <p className="text-muted-foreground text-sm italic">No visible changes (sensitive data redacted)</p>;
    }

    return (
      <div className="space-y-2 text-sm font-mono">
        {safeKeys.map(key => {
          const oldVal = oldValue?.[key];
          const newVal = newValue?.[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          
          return (
            <div key={key} className={`p-2 rounded ${changed ? 'bg-muted/50' : ''}`}>
              <span className="text-muted-foreground">{key}: </span>
              {oldVal !== undefined && (
                <span className="text-red-500 line-through mr-2">
                  {JSON.stringify(oldVal)}
                </span>
              )}
              {newVal !== undefined && (
                <span className="text-green-500">
                  {JSON.stringify(newVal)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit & Activity Center</h2>
          <p className="text-muted-foreground">
            Immutable log of all admin actions and system events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="icon" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {tables.map(table => (
                  <SelectItem key={table} value={table}>{table}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Activity Log</CardTitle>
            <Badge variant="secondary">{filteredLogs.length} events</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No audit logs found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <React.Fragment key={log.id}>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRowExpansion(log.id)}
                      >
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(log.id);
                            }}
                          >
                            {expandedRows.has(log.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {log.user_email}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action_type)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.table_affected || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[100px] truncate">
                          {log.record_id || "-"}
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(log.id) && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-4">
                              {log.ip_address && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">IP: </span>
                                  <span className="font-mono">{log.ip_address}</span>
                                </div>
                              )}
                              <div>
                                <h4 className="text-sm font-medium mb-2">Changes</h4>
                                {renderDiff(log.old_value, log.new_value)}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
