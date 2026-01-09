import { useState } from "react";
import { V3Button } from "@/components/v3/V3Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminCard } from "./v3";

interface BackfillResult {
  total_organizations: number;
  already_tracked: number;
  newly_created: number;
  inferred_completed: number;
  inferred_in_progress: number;
  inferred_not_started: number;
  errors: string[];
}

export function OnboardingBackfillPanel() {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const { toast } = useToast();

  const startBackfill = async () => {
    try {
      setIsBackfilling(true);
      toast({
        title: "Starting onboarding backfill",
        description: "Analyzing organizations and inferring onboarding state...",
      });

      const { data, error } = await supabase.functions.invoke('backfill-onboarding-state');

      if (error) throw error;

      setResult(data);
      
      toast({
        title: "Backfill complete",
        description: `Created ${data.newly_created} onboarding records. ${data.already_tracked} already tracked.`,
      });

    } catch (error: any) {
      console.error('Backfill error:', error);
      toast({
        title: "Backfill failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  return (
    <AdminCard
      title="Onboarding State Backfill"
      description="Create onboarding tracking records for existing organizations"
      icon={Users}
      interactive
    >
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Why backfill?</strong> Organizations created before the onboarding wizard don't have tracking records. This analyzes existing data (users, integrations, watchlists) to infer their setup status.
          </AlertDescription>
        </Alert>

        {result && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>Backfill Complete:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>✓ {result.total_organizations} total organizations</li>
                <li>✓ {result.already_tracked} already had tracking</li>
                <li>✓ {result.newly_created} new records created</li>
                <li className="ml-4 text-muted-foreground">
                  → {result.inferred_completed} inferred as completed
                </li>
                <li className="ml-4 text-muted-foreground">
                  → {result.inferred_in_progress} inferred as in progress
                </li>
                <li className="ml-4 text-muted-foreground">
                  → {result.inferred_not_started} inferred as not started
                </li>
              </ul>
              {result.errors.length > 0 && (
                <div className="mt-2 text-destructive">
                  <strong>Errors ({result.errors.length}):</strong>
                  <ul className="list-disc list-inside">
                    {result.errors.slice(0, 3).map((err, i) => (
                      <li key={i} className="text-xs">{err}</li>
                    ))}
                    {result.errors.length > 3 && (
                      <li className="text-xs">...and {result.errors.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <V3Button
          onClick={startBackfill}
          isLoading={isBackfilling}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4" />
          Run Onboarding Backfill
        </V3Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>What happens:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Scans all organizations without onboarding records</li>
            <li>Checks for existing users, integrations, and watchlists</li>
            <li>Infers which onboarding steps are complete</li>
            <li>Creates tracking records with inferred status</li>
            <li>Safe to run multiple times (skips existing records)</li>
          </ul>
        </div>
      </div>
    </AdminCard>
  );
}
