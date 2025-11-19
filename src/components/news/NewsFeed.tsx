import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NewsCard } from "./NewsCard";
import { NewsFilters, FilterState } from "./NewsFilters";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function NewsFeed() {
  const [articles, setArticles] = useState<any[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const categories = [
    'independent',
    'mainstream',
    'conservative',
    'specialized',
    'government',
    'state_government',
    'civil_rights'
  ];

  useEffect(() => {
    loadArticles();
    loadSources();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('published_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setArticles(data || []);
      setFilteredArticles(data || []);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Error loading articles",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSources = async () => {
    try {
      const { data, error } = await supabase
        .from('rss_sources')
        .select('id, name, category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSources(data || []);
    } catch (err: any) {
      console.error('Error loading sources:', err);
    }
  };

  const fetchNewArticles = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase.functions.invoke('fetch-rss-feeds');

      if (error) throw error;

      toast({
        title: "RSS feeds updated",
        description: `Added ${data.articlesAdded} new articles from ${data.sourcesProcessed} sources`,
      });

      await loadArticles();
    } catch (err: any) {
      toast({
        title: "Error fetching feeds",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setFetching(false);
    }
  };

  const detectDuplicates = async () => {
    try {
      toast({
        title: "Detecting duplicates",
        description: "This may take a moment...",
      });
      
      const { data, error } = await supabase.functions.invoke('detect-duplicates', {
        body: { lookbackHours: 24, similarityThreshold: 0.75 }
      });
      
      if (error) throw error;
      
      toast({
        title: "Duplicate detection complete",
        description: `Found ${data.clustersFound} duplicate clusters. ${data.clustersCreated} new clusters created.`,
      });
      
      await loadArticles();
    } catch (err: any) {
      toast({
        title: "Error detecting duplicates",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const applyFilters = (filters: FilterState) => {
    let filtered = [...articles];

    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(article =>
        article.title?.toLowerCase().includes(search) ||
        article.description?.toLowerCase().includes(search)
      );
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(article => article.category === filters.category);
    }

    // Source filter
    if (filters.sourceId !== 'all') {
      filtered = filtered.filter(article => article.source_id === filters.sourceId);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const ranges: Record<string, number> = {
        today: 1,
        week: 7,
        month: 30
      };
      const days = ranges[filters.dateRange] || 0;
      if (days > 0) {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(article => new Date(article.published_date) >= cutoff);
      }
    }

    // Tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(article =>
        filters.tags.some(tag => article.tags?.includes(tag))
      );
    }

    setFilteredArticles(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" label="Loading news feed..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">News Feed</h2>
          <p className="text-muted-foreground mt-1">
            {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={detectDuplicates}
            variant="outline"
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Detect Duplicates
          </Button>
          <Button
            onClick={fetchNewArticles}
            disabled={fetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Fetching...' : 'Refresh Feed'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <NewsFilters
        categories={categories}
        sources={sources}
        onFilterChange={applyFilters}
      />

      {filteredArticles.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No articles found. Try adjusting your filters or click "Refresh Feed" to fetch new articles.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
