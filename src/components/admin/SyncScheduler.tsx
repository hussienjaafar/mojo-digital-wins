import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, Pause, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Organization = {
  id: string;
  name: string;
};

type ScheduledSync = {
  job_id: number;
  organization_id: string;
  sync_type: string;
  cron_schedule: string;
  is_active: boolean;
};

const SyncScheduler = () => {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [schedules, setSchedules] = useState<ScheduledSync[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

      // In a real implementation, you would query a schedules table
      // For now, we'll show a placeholder
      setSchedules([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupCronJob = async (orgId: string, syncType: string) => {
    toast({
      title: "Setting up scheduled sync",
      description: "Configuring automatic data synchronization...",
    });

    try {
      // Example SQL for setting up pg_cron job
      const cronSchedule = '0 2 * * *'; // 2 AM daily
      
      const setupSQL = `
-- Enable pg_cron extension (run once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule Meta Ads sync
SELECT cron.schedule(
  'sync-meta-ads-${orgId}',
  '${cronSchedule}',
  $$
  SELECT net.http_post(
    url := '${window.location.origin.replace('lovable.app', 'supabase.co')}/functions/v1/sync-meta-ads',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}"}'::jsonb,
    body := '{"organization_id": "${orgId}"}'::jsonb
  );
  $$
);

-- Schedule Switchboard SMS sync
SELECT cron.schedule(
  'sync-switchboard-${orgId}',
  '${cronSchedule}',
  $$
  SELECT net.http_post(
    url := '${window.location.origin.replace('lovable.app', 'supabase.co')}/functions/v1/sync-switchboard-sms',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}"}'::jsonb,
    body := '{"organization_id": "${orgId}"}'::jsonb
  );
  $$
);

-- Schedule ROI calculation (runs after syncs)
SELECT cron.schedule(
  'calculate-roi-${orgId}',
  '0 3 * * *', -- 3 AM daily, after syncs complete
  $$
  SELECT net.http_post(
    url := '${window.location.origin.replace('lovable.app', 'supabase.co')}/functions/v1/calculate-roi',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}"}'::jsonb,
    body := '{"organization_id": "${orgId}"}'::jsonb
  );
  $$
);
      `;

      toast({
        title: "SQL Generated",
        description: "Copy the SQL below and run it in your Supabase SQL Editor",
      });

      // Copy to clipboard
      await navigator.clipboard.writeText(setupSQL);

      toast({
        title: "Copied to Clipboard",
        description: "SQL has been copied. Run it in your Supabase SQL Editor to set up automated syncing.",
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate cron setup",
        variant: "destructive",
      });
    }
  };

  const getOrganizationName = (orgId: string) => {
    return organizations.find(o => o.id === orgId)?.name || 'Unknown';
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading schedules...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Sync Scheduler
          </CardTitle>
          <CardDescription>
            Set up automated daily syncing for client organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h3 className="font-medium">Setup Instructions</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Select an organization below</li>
                <li>Click "Generate Cron SQL" to copy the setup script</li>
                <li>Open your Supabase SQL Editor</li>
                <li>Paste and run the SQL to enable automated syncing</li>
                <li>Data will sync automatically every night at 2 AM UTC</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label>Select Organization</Label>
              {organizations.map((org) => (
                <div key={org.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <span className="font-medium">{org.name}</span>
                  <Button onClick={() => setupCronJob(org.id, 'all')} size="sm">
                    Generate Cron SQL
                  </Button>
                </div>
              ))}
            </div>

            {organizations.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No organizations found. Create an organization first.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>View Scheduled Jobs</CardTitle>
          <CardDescription>
            Check active cron jobs in your Supabase SQL Editor with this query
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            value={`-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;

-- Unschedule a job (replace job_name)
SELECT cron.unschedule('sync-meta-ads-org-id');`}
            className="font-mono text-xs h-32"
          />
          <Button
            onClick={() => {
              navigator.clipboard.writeText(`SELECT * FROM cron.job;`);
              toast({ title: "Copied", description: "Query copied to clipboard" });
            }}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Copy View Jobs Query
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncScheduler;
