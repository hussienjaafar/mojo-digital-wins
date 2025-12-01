import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, XCircle, Users } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from "@/lib/logger";

type LoginHistory = {
  id: string;
  user_id: string;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  login_successful: boolean;
  failure_reason: string | null;
  created_at: string;
};

export const SessionManagement = () => {
  const { toast } = useToast();
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLogins: 0,
    successfulLogins: 0,
    failedLogins: 0,
  });

  useEffect(() => {
    fetchLoginHistory();
  }, []);

  const fetchLoginHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('login_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const history = data || [];
      setLoginHistory(history);
      
      // Calculate stats
      const successful = history.filter(h => h.login_successful).length;
      const failed = history.filter(h => !h.login_successful).length;
      
      setStats({
        totalLogins: history.length,
        successfulLogins: successful,
        failedLogins: failed,
      });
    } catch (error) {
      logger.error('Failed to fetch login history', error);
      toast({
        title: "Error",
        description: "Failed to load login history.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Session Management</h2>
            <p className="text-sm portal-text-secondary">Loading login history...</p>
          </div>
        </div>
        <div className="portal-card p-6">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 portal-animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="portal-skeleton h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="portal-skeleton h-4 w-2/3" />
                  <div className="portal-skeleton h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLogins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.successfulLogins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.failedLogins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Login History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Login History</CardTitle>
          <CardDescription>
            Recent login attempts (showing last 100 entries)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginHistory.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No login history found. Login attempts will be logged automatically.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Failure Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(entry.created_at), 'MMM dd, yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-medium">{entry.email}</TableCell>
                      <TableCell>
                        {entry.login_successful ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.ip_address || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.failure_reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
