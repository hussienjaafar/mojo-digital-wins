import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TodaysBriefingProps {
  className?: string;
}

export function TodaysBriefing({ className }: TodaysBriefingProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchBriefing();
  }, []);

  const fetchBriefing = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-daily-briefing');

      if (fnError) {
        throw fnError;
      }

      setSummary(data?.summary || 'No briefing available.');
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching briefing:', err);
      setError('Unable to load briefing');
      // Set a fallback summary
      setSummary('Check the trending topics below for today\'s key developments.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border-primary/20", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border-primary/20",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Today's Briefing
                <span className="text-xs font-normal text-muted-foreground">
                  AI-generated
                </span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={fetchBriefing}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              </Button>
            </div>
            
            {error ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : (
              <p className="text-sm text-foreground/90 leading-relaxed">
                {summary}
              </p>
            )}
            
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-2">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
