import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Eye, FileText } from "lucide-react";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type AuditLog = {
  id: string;
  user_id: string;
  action_type: string;
  table_affected: string | null;
  record_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export const AuditLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      logger.error('Failed to fetch audit logs', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('delete')) return 'destructive';
    if (action.includes('create') || action.includes('insert')) return 'default';
    if (action.includes('update')) return 'secondary';
    return 'outline';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Audit Logs</h2>
            <p className="text-sm portal-text-secondary">Loading activity logs...</p>
          </div>
        </div>
        <div className="portal-card p-6">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 portal-animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="portal-skeleton h-10 w-10 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="portal-skeleton h-4 w-3/4" />
                  <div className="portal-skeleton h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <CardDescription>
          Track all admin actions and system events (showing last 100 entries)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No audit logs found. Actions will be logged automatically.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action_type)}>
                        {log.action_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.table_affected || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[150px]">
                      {log.record_id || '-'}
                    </TableCell>
                    <TableCell>
                      {(log.old_value || log.new_value) && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Audit Log Details</DialogTitle>
                              <DialogDescription>
                                Changes made on {format(new Date(log.created_at), 'PPpp')}
                              </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[500px]">
                              <div className="space-y-4">
                                {log.old_value && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">Old Value:</h4>
                                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                                      {JSON.stringify(log.old_value, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.new_value && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">New Value:</h4>
                                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                                      {JSON.stringify(log.new_value, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.user_agent && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">User Agent:</h4>
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {log.user_agent}
                                    </p>
                                  </div>
                                )}
                                {log.ip_address && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2">IP Address:</h4>
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {log.ip_address}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
