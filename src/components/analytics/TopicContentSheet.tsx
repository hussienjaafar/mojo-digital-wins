import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Newspaper, Users, ExternalLink, Target, Bell, Clock, TrendingUp, Minus, TrendingDown, Tag } from "lucide-react";
import { TopicContentResult } from "@/hooks/useTopicContent";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface TopicContentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  isLoading: boolean;
  content: TopicContentResult | null;
  onAddToWatchlist?: (topic: string) => void;
}

export function TopicContentSheet({ open, onOpenChange, topic, isLoading, content, onAddToWatchlist }: TopicContentSheetProps) {
  const hasNews = content?.articles && content.articles.length > 0;
  const hasSocial = content?.socialPosts && content.socialPosts.length > 0;
  const defaultTab = hasNews ? 'news' : hasSocial ? 'social' : 'news';

  const getSentimentIcon = (avgScore: number) => {
    if (avgScore > 0.2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (avgScore < -0.2) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getSentimentLabel = (avgScore: number) => {
    if (avgScore > 0.2) return 'Positive';
    if (avgScore < -0.2) return 'Negative';
    return 'Neutral';
  };

  const totalSentiment = content ? content.sentiment.positive + content.sentiment.neutral + content.sentiment.negative : 0;
  const positivePercent = totalSentiment > 0 ? (content!.sentiment.positive / totalSentiment) * 100 : 0;
  const neutralPercent = totalSentiment > 0 ? (content!.sentiment.neutral / totalSentiment) * 100 : 0;
  const negativePercent = totalSentiment > 0 ? (content!.sentiment.negative / totalSentiment) * 100 : 0;

  const handleSetAlert = () => {
    toast.info('Alert functionality coming soon', { description: `You'll be notified when "${topic}" spikes` });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold capitalize flex items-center gap-2">
            {topic}
            {content?.isOnWatchlist && (
              <Badge variant="secondary" className="text-xs font-normal">
                <Target className="h-3 w-3 mr-1" />
                Watchlist
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {isLoading
              ? 'Loading content...'
              : content
                ? `${content.totalCount} items found • ${content.articles.length} news, ${content.socialPosts.length} social`
                : 'No content found'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" label="Loading content..." />
            </div>
          ) : !content || content.totalCount === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No content found for this topic</p>
              <p className="text-sm text-muted-foreground mt-2">Try searching for related terms</p>
            </div>
          ) : (
            <>
              {/* Actions Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                {!content.isOnWatchlist && onAddToWatchlist && (
                  <Button variant="outline" size="sm" onClick={() => onAddToWatchlist(topic)}>
                    <Target className="h-4 w-4 mr-2" />
                    Add to Watchlist
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleSetAlert}>
                  <Bell className="h-4 w-4 mr-2" />
                  Set Alert
                </Button>
              </div>

              {/* Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sentiment Breakdown */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Sentiment</span>
                    <div className="flex items-center gap-1">
                      {getSentimentIcon(content.sentiment.avgScore)}
                      <span className="text-sm font-medium">{getSentimentLabel(content.sentiment.avgScore)}</span>
                    </div>
                  </div>
                  
                  {/* Stacked bar */}
                  <div className="h-2 rounded-full overflow-hidden flex bg-muted">
                    <div 
                      className="bg-green-500 h-full transition-all" 
                      style={{ width: `${positivePercent}%` }} 
                    />
                    <div 
                      className="bg-gray-400 h-full transition-all" 
                      style={{ width: `${neutralPercent}%` }} 
                    />
                    <div 
                      className="bg-red-500 h-full transition-all" 
                      style={{ width: `${negativePercent}%` }} 
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      {content.sentiment.positive} positive
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400" />
                      {content.sentiment.neutral} neutral
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      {content.sentiment.negative} negative
                    </span>
                  </div>
                </div>

                {/* Timeline & Stats */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Timeline</span>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  {content.trendingStarted ? (
                    <div>
                      <p className="text-lg font-semibold">
                        {formatDistanceToNow(new Date(content.trendingStarted), { addSuffix: false })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Trending since {new Date(content.trendingStarted).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Recently emerged</p>
                  )}
                  
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-blue-600">{content.articles.length}</span>
                      <span className="text-muted-foreground ml-1">articles</span>
                    </div>
                    <div>
                      <span className="font-semibold text-purple-600">{content.socialPosts.length}</span>
                      <span className="text-muted-foreground ml-1">posts</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Related Entities */}
              {content.relatedEntities.length > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Related Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {content.relatedEntities.map((entity, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Tabs */}
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="news" className="flex-1 gap-2">
                    <Newspaper className="h-4 w-4" />
                    News ({content.articles.length})
                  </TabsTrigger>
                  <TabsTrigger value="social" className="flex-1 gap-2">
                    <Users className="h-4 w-4" />
                    Social ({content.socialPosts.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="news" className="mt-4 space-y-3">
                  {content.articles.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No news articles found</p>
                  ) : (
                    content.articles.map((article) => (
                      <a
                        key={article.id}
                        href={article.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                              {article.title}
                            </h3>
                            {article.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {article.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-medium">{article.source_name}</span>
                              <span>•</span>
                              <span>{new Date(article.published_date).toLocaleDateString()}</span>
                              {article.sentiment_label && (
                                <>
                                  <span>•</span>
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded text-xs",
                                      article.sentiment_label === 'positive'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : article.sentiment_label === 'negative'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                        : 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    {article.sentiment_label}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                        </div>
                      </a>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="social" className="mt-4 space-y-3">
                  {content.socialPosts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No social posts found</p>
                  ) : (
                    content.socialPosts.map((post) => (
                      <a
                        key={post.id}
                        href={post.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm mb-2 line-clamp-3">
                              {post.title}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-medium text-purple-600 dark:text-purple-400">
                                {post.description}
                              </span>
                              <span>•</span>
                              <span>{new Date(post.published_date).toLocaleString()}</span>
                              {post.sentiment_label && (
                                <>
                                  <span>•</span>
                                  <span
                                    className={cn(
                                      "px-2 py-0.5 rounded text-xs",
                                      post.sentiment_label === 'positive'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : post.sentiment_label === 'negative'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                        : 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    {post.sentiment_label}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                        </div>
                      </a>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}