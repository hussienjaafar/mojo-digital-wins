import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NewsCard } from "./NewsCard";
import { NewsFilters, FilterState } from "./NewsFilters";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, AlertCircle, Sparkles, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNewsFilters } from "@/contexts/NewsFilterContext";

const ARTICLES_PER_PAGE = 50;

export function NewsFeed() {
  const { searchTerm, setSearchTerm, navigateToTab } = useNewsFilters();

  const [articles, setArticles] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(null);
  const [trendingCount, setTrendingCount] = useState<number>(0);
  const { toast } = useToast();
  const observerTarget = useRef<HTMLDivElement>(null);

  const categories = [
    'independent',
    'mainstream',
    'conservative',
    'specialized',
    'government',
    'state_government',
    'civil_rights'
  ];

  // Listen for search term from Analytics (cross-tab navigation)
  useEffect(() => {
    if (searchTerm) {
      console.log('📍 Applying search term from Analytics:', searchTerm);

      // Create filter with the search term
      const filterWithSearch: FilterState = {
        search: searchTerm,
        category: 'all',
        sourceId: 'all',
        dateRange: 'all',
        tags: [],
        geographicScope: 'all',
        affectedGroup: 'all',
        relevanceCategory: 'all',
        politicalLeaning: 'all'
      };
      };

      // Apply the filter
      applyFilters(filterWithSearch);

      // Clear the search term from context after applying
      setSearchTerm(null);

      toast({
        title: "Search applied",
        description: `Filtering articles by "${searchTerm}"`,
      });
    }
  }, [searchTerm]);

  useEffect(() => {
    loadArticles();
    loadSources();
    loadTrendingCount();

    // Set up real-time subscription for new articles
    const articlesChannel = supabase
      .channel('news-feed-articles')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'articles'
        },
        (payload) => {
          console.log('New article received:', payload.new);
          const newArticle = payload.new as any;

          // Check if article matches current filters before inserting
          if (currentFilters) {
            let matchesFilters = true;

            // Search filter
            if (currentFilters.search) {
              const searchLower = currentFilters.search.toLowerCase();
              const titleMatch = newArticle.title?.toLowerCase().includes(searchLower);
              const descMatch = newArticle.description?.toLowerCase().includes(searchLower);
              if (!titleMatch && !descMatch) {
                matchesFilters = false;
              }
            }

            // Category filter
            if (matchesFilters && currentFilters.category !== 'all') {
              if (newArticle.category !== currentFilters.category) {
                matchesFilters = false;
              }
            }

            // Source filter
            if (matchesFilters && currentFilters.sourceId !== 'all') {
              if (newArticle.source_id !== currentFilters.sourceId) {
                matchesFilters = false;
              }
            }

            // Date range filter
            if (matchesFilters && currentFilters.dateRange !== 'all') {
              const now = new Date();
              const ranges: Record<string, number> = {
                today: 1,
                week: 7,
                month: 30
              };
              const days = ranges[currentFilters.dateRange] || 0;
              if (days > 0) {
                const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
                const articleDate = new Date(newArticle.published_date);
                if (articleDate < cutoff) {
                  matchesFilters = false;
                }
              }
            }

            // Tags filter
            if (matchesFilters && currentFilters.tags.length > 0) {
              const articleTags = newArticle.tags || [];
              const hasMatchingTag = currentFilters.tags.some(tag => articleTags.includes(tag));
              if (!hasMatchingTag) {
                matchesFilters = false;
              }
            }

            // Geographic scope filter
            if (matchesFilters && currentFilters.geographicScope && currentFilters.geographicScope !== 'all') {
              if (newArticle.geographic_scope !== currentFilters.geographicScope) {
                matchesFilters = false;
              }
            }

            // Don't insert if article doesn't match filters
            if (!matchesFilters) {
              console.log('New article filtered out:', newArticle.title);
              return;
            }
          }

          // Insert article in correct chronological order by published_date
          const insertSorted = (prev: any[]) => {
            const newList = [...prev];
            const newDate = new Date(newArticle.published_date).getTime();

            // Find the correct position to insert (descending order)
            let insertIndex = newList.findIndex(article =>
              new Date(article.published_date).getTime() < newDate
            );

            // If not found, add to end; otherwise insert at position
            if (insertIndex === -1) {
              newList.push(newArticle);
            } else {
              newList.splice(insertIndex, 0, newArticle);
            }

            return newList;
          };

          setArticles(prev => insertSorted(prev));

          toast({
            title: "New article added",
            description: newArticle.title,
          });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(articlesChannel);
    };
  }, []);

  // Infinite scroll observer
  const loadMoreArticles = useCallback(() => {
    if (!loadingMore && hasMore) {
      console.log(`📜 Infinite scroll triggered - loading page ${page + 1}`);
      loadArticles(page + 1, currentFilters);
    } else {
      console.log(`📜 Infinite scroll blocked - loadingMore: ${loadingMore}, hasMore: ${hasMore}`);
    }
  }, [loadingMore, hasMore, page, currentFilters]);

  useEffect(() => {
    console.log('🔧 Setting up IntersectionObserver...', {
      hasRef: !!observerTarget.current,
      hasMore,
      loadingMore,
      page,
      displayedCount: articles.length
    });

    const currentTarget = observerTarget.current;

    if (!currentTarget) {
      console.warn('⚠️ Observer target ref is null, will retry on next render');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        console.log('👁️ IntersectionObserver callback fired', {
          isIntersecting: entries[0].isIntersecting,
          intersectionRatio: entries[0].intersectionRatio,
          hasMore,
          loadingMore
        });

        if (entries[0].isIntersecting) {
          loadMoreArticles();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentTarget);
    console.log('✅ IntersectionObserver attached successfully to trigger div');

    return () => {
      observer.disconnect();
      console.log('🔌 IntersectionObserver disconnected');
    };
  }, [loadMoreArticles, hasMore, loadingMore, articles.length]);

  const loadArticles = async (pageNum: number = 0, filters: FilterState | null = null) => {
    try {
      if (pageNum === 0) {
        setLoading(true);
        setPage(0);
        console.log('📰 Loading articles (page 0)...');
      } else {
        setLoadingMore(true);
        console.log(`📰 Loading more articles (page ${pageNum})...`);
      }

      const from = pageNum * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      // Build query with filters
      let query = supabase
        .from('articles')
        .select('*', { count: 'exact' });

      // Apply filters to query
      if (filters) {
        // Search filter
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
        }

        // Category filter
        if (filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }

        // Source filter
        if (filters.sourceId !== 'all') {
          query = query.eq('source_id', filters.sourceId);
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
            query = query.gte('published_date', cutoff.toISOString());
          }
        }

        // Tags filter
        if (filters.tags.length > 0) {
          // Use overlaps for array containment check
          query = query.overlaps('tags', filters.tags);
        }

        // Geographic scope filter
        if (filters.geographicScope && filters.geographicScope !== 'all') {
          query = query.eq('geographic_scope', filters.geographicScope);
        }
      }

      const { data, error, count } = await query
        .order('published_date', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('❌ Error loading articles:', error);
        throw error;
      }

      const newArticles = data || [];
      console.log(`✅ Loaded ${newArticles.length} articles (page ${pageNum}, range: ${from}-${to}, total in DB: ${count})`);

      // Save total count for display
      setTotalCount(count || 0);

      if (pageNum === 0) {
        setArticles(newArticles);
      } else {
        setArticles(prev => [...prev, ...newArticles]);
      }

      // Check if there are more articles
      const loadedSoFar = from + newArticles.length;
      const moreAvailable = count ? loadedSoFar < count : false;
      console.log(`📊 Pagination state: loaded ${loadedSoFar} of ${count} total, hasMore: ${moreAvailable}`);
      setHasMore(moreAvailable);
      setPage(pageNum);

    } catch (err: any) {
      console.error('❌ Error in loadArticles:', err);
      setError(err.message);
      toast({
        title: "Error loading articles",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
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

  const loadTrendingCount = async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count, error } = await supabase
        .from('trending_topics')
        .select('*', { count: 'exact', head: true })
        .gte('hour_timestamp', yesterday.toISOString())
        .gt('velocity_score', 50); // Only count topics with significant velocity

      if (error) throw error;
      setTrendingCount(count || 0);
    } catch (err: any) {
      console.error('Error loading trending count:', err);
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
    // Save current filters
    setCurrentFilters(filters);

    // Reload articles with new filters applied at query level
    loadArticles(0, filters);
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
            Showing {articles.length} of {totalCount.toLocaleString()} {totalCount === 1 ? 'article' : 'articles'}
            {hasMore && ' • Scroll for more'}
          </p>
        </div>
        <TooltipProvider>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={detectDuplicates}
                  variant="outline"
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Detect Duplicates
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Find and cluster duplicate articles across sources</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => loadArticles(0, currentFilters)}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Articles
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reload articles from database (RSS syncs every 5 min automatically)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {trendingCount > 0 && (
        <Alert className="bg-primary/5 border-primary/20">
          <TrendingUp className="h-4 w-4 text-primary" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{trendingCount}</strong> trending topic{trendingCount > 1 ? 's' : ''} detected in the last 24 hours
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-primary"
              onClick={() => {
                if (navigateToTab) {
                  navigateToTab('analytics');
                  toast({
                    title: "Switched to Analytics",
                    description: "View trending topics and sentiment analysis",
                  });
                }
              }}
            >
              View Analytics →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <NewsFilters
        categories={categories}
        sources={sources}
        onFilterChange={applyFilters}
      />

      {articles.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No articles found. Try adjusting your filters or click "Reload Articles" to refresh the view.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>

          {/* Infinite scroll trigger */}
          <div ref={observerTarget} className="flex flex-col items-center gap-4 py-8 min-h-[100px]">
            {loadingMore && (
              <LoadingSpinner size="md" label="Loading more articles..." />
            )}
            {!loadingMore && hasMore && (
              <p className="text-muted-foreground text-sm">
                Scroll down to load more • {articles.length} of {totalCount.toLocaleString()} articles
              </p>
            )}
            {!hasMore && articles.length > 0 && (
              <p className="text-muted-foreground text-sm">
                ✓ All {totalCount.toLocaleString()} articles loaded
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
