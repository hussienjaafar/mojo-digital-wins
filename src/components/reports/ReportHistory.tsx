import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  FileSpreadsheet,
  FileJson,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Plus,
  History,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ExportDialog } from "./ExportDialog";

interface GeneratedReport {
  id: string;
  report_type: string;
  report_name: string;
  report_format: string;
  date_range_start: string;
  date_range_end: string;
  file_size_bytes: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function ReportHistory() {
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("generated_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error loading reports",
        description: "Could not load report history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "csv":
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case "json":
        return <FileJson className="h-4 w-4 text-blue-600" />;
      case "pdf":
        return <FileText className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "generating":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getReportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      critical_alerts: "Critical Alerts",
      executive_orders: "Executive Orders",
      state_actions: "State Actions",
      organization_mentions: "Org Mentions",
      daily_briefing: "Daily Briefing",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <History className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Report History</h2>
            <p className="text-sm portal-text-secondary">Loading generated reports...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="portal-card p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                  <div className="portal-skeleton h-5 w-48" />
                  <div className="portal-skeleton h-4 w-32" />
                </div>
                <div className="portal-skeleton h-8 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-7 w-7" />
            Reports & Exports
          </h2>
          <p className="text-muted-foreground mt-1">
            Generate and download intelligence reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchReports}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Export</CardTitle>
          <CardDescription>Generate a new report from your intelligence data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ExportDialog
              reportType="critical_alerts"
              title="Critical Alerts"
              trigger={
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <FileSpreadsheet className="h-6 w-6 text-red-600" />
                  <span>Critical Alerts</span>
                </Button>
              }
            />
            <ExportDialog
              reportType="executive_orders"
              title="Executive Orders"
              trigger={
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                  <span>Executive Orders</span>
                </Button>
              }
            />
            <ExportDialog
              reportType="state_actions"
              title="State Actions"
              trigger={
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <FileSpreadsheet className="h-6 w-6 text-purple-600" />
                  <span>State Actions</span>
                </Button>
              }
            />
            <ExportDialog
              reportType="organization_mentions"
              title="Organization Mentions"
              trigger={
                <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                  <span>Org Mentions</span>
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report History</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm">Use the quick export buttons above to create your first report</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getFormatIcon(report.report_format)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{report.report_name}</span>
                          {getStatusIcon(report.status)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {getReportTypeLabel(report.report_type)}
                          </Badge>
                          <span>
                            {format(new Date(report.date_range_start), "MMM d")} -{" "}
                            {format(new Date(report.date_range_end), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">
                          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatBytes(report.file_size_bytes)}
                        </div>
                      </div>
                      {report.status === "completed" && (
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {report.status === "failed" && (
                        <Badge variant="destructive" className="text-xs">
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
