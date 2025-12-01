import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, AlertCircle, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DataBackfillPanel() {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const { toast } = useToast();

  const startBackfill = async (daysBack: number = 7) => {
    try {
      setIsBackfilling(true);
      toast({
        title: "Starting data backfill",
        description: `Reanalyzing articles from the last ${daysBack} days...`,
      });

      const { data, error } = await supabase.functions.invoke('backfill-analysis', {
        body: { daysBack }
      });

      if (error) throw error;

      setProgress(data);
      
      toast({
        title: "Backfill initiated",
        description: `${data.articles_marked} articles and ${data.posts_marked} posts marked for reanalysis. Processing will continue automatically.`,
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
    <Card className="hover-scale transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 portal-text-primary">
          <Database className="h-5 w-5" />
          Data Quality Backfill
        </CardTitle>
        <CardDescription className="portal-text-secondary">
          Reanalyze existing articles to populate demographic and policy category filters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Why backfill?</strong> Your filtering system needs demographic data (affected_groups) and policy categories (relevance_category) to work properly. This will reanalyze existing articles to extract this data using the updated AI prompts.
          </AlertDescription>
        </Alert>

        {progress && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>Backfill Status:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>✓ {progress.articles_marked} articles marked for reanalysis</li>
                <li>✓ {progress.posts_marked} Bluesky posts marked for reanalysis</li>
                <li>⏳ Processing in {progress.article_batches} article batches</li>
                <li>⏳ Processing in {progress.post_batches} post batches</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Analysis runs every 10 minutes. Check back in 1-2 hours for completion.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2">
          <Button
            onClick={() => startBackfill(7)}
            disabled={isBackfilling}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-spin' : ''}`} />
            Backfill Last 7 Days (Recommended)
          </Button>
          
          <Button
            onClick={() => startBackfill(30)}
            disabled={isBackfilling}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-spin' : ''}`} />
            Backfill Last 30 Days (Slow)
          </Button>

          <Button
            onClick={() => startBackfill(1)}
            disabled={isBackfilling}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-spin' : ''}`} />
            Backfill Last 24 Hours (Test)
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>What happens:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Marks articles/posts missing demographic or category data</li>
            <li>Triggers automatic reanalysis using improved AI prompts</li>
            <li>Processes in batches of 50 every 10 minutes</li>
            <li>Updates will appear in News Feed as analysis completes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
