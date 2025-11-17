import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SentimentTrendCard } from "./SentimentIndicator";
import { LoadingCard } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function SentimentDashboard() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('sentiment_trends')
        .select('*')
        .eq('date', today);

      if (error) throw error;
      setTrends(data || []);
    } catch (error) {
      console.error('Error fetching sentiment trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setAnalyzing(true);
      toast({
        title: "Analyzing articles...",
        description: "Running sentiment analysis and duplicate detection",
      });

      const { data, error } = await supabase.functions.invoke('analyze-articles');

      if (error) throw error;

      toast({
        title: "Analysis complete",
        description: `${data.processed} articles analyzed, ${data.duplicates} duplicates found`,
      });

      await fetchTrends();
    } catch (error) {
      console.error('Error running analysis:', error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze articles",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <LoadingCard />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sentiment Analysis Dashboard</CardTitle>
              <CardDescription>
                AI-powered sentiment tracking across news sources
              </CardDescription>
            </div>
            <Button onClick={runAnalysis} disabled={analyzing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${analyzing ? 'animate-spin' : ''}`} />
              Analyze Articles
            </Button>
          </div>
        </CardHeader>
      </Card>

      {trends.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              No sentiment data available yet
            </p>
            <Button onClick={runAnalysis} disabled={analyzing}>
              Run Analysis
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trends.map((trend) => (
            <SentimentTrendCard
              key={trend.id}
              category={trend.category}
              data={{
                positive_count: trend.positive_count,
                neutral_count: trend.neutral_count,
                negative_count: trend.negative_count,
                avg_sentiment_score: trend.avg_sentiment_score,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
