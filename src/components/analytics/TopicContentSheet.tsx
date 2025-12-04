import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Newspaper, Users, ExternalLink, Target, Bell, Clock, TrendingUp, Minus, TrendingDown, 
  Tag, Share2, Copy, BookmarkPlus, Filter, ArrowUpRight
} from "lucide-react";
import { TopicContentResult, TopicArticle } from "@/hooks/useTopicContent";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href + `?topic=${encodeURIComponent(topic)}`);
    toast.success('Link copied to clipboard');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Topic: ${topic}`,
          text: `Check out coverage on "${topic}" - ${content?.totalCount || 0} items found`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  // Get the most impactful headline (longest description or first)
  const getKeyHeadline = (): TopicArticle | null => {
    if (!content?.articles.length) return null;
    return content.articles.reduce((best, current) => {
      const bestLength = (best.description?.length || 0);
      const currentLength = (current.description?.length || 0);
      return currentLength > bestLength ? current : best;
    }, content.articles[0]);
  };

  const keyHeadline = getKeyHeadline();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
        <div className="p-6 pb-4 border-b">
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

          {/* Quick Actions */}
          {!isLoading && content && content.totalCount > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {!content.isOnWatchlist && onAddToWatchlist && (
                <Button variant="default" size="sm" onClick={() => onAddToWatchlist(topic)}>
                  <Target className="h-4 w-4 mr-2" />
                  Add to Watchlist
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSetAlert}>
                <Bell className="h-4 w-4 mr-2" />
                Set Alert
              </Button>
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" label="Loading content..." />
              </div>
            ) : !content || content.totalCount === 0 ? (
              <div className="text-center py-12">
                <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium">No content found for this topic</p>
                <p className="text-sm text-muted-foreground mt-2">Try searching for related terms or check back later</p>
              </div>
            ) : (
              <>
                {/* Key Headline Highlight */}
                {keyHeadline && (
                  <a
                    href={keyHeadline.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-5 hover:border-primary/40 transition-all group"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        Key Story
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{keyHeadline.source_name}</span>
                    </div>
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {keyHeadline.title}
                    </h3>
                    {keyHeadline.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {keyHeadline.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <span>{format(new Date(keyHeadline.published_date), 'MMM d, yyyy')}</span>
                      {keyHeadline.sentiment_label && (
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          keyHeadline.sentiment_label === 'positive' && "border-green-500/50 text-green-600",
                          keyHeadline.sentiment_label === 'negative' && "border-red-500/50 text-red-600"
                        )}>
                          {keyHeadline.sentiment_label}
                        </Badge>
                      )}
                    </div>
                  </a>
                )}

                {/* Summary Cards */}
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
                      <div className="bg-green-500 h-full transition-all" style={{ width: `${positivePercent}%` }} />
                      <div className="bg-gray-400 h-full transition-all" style={{ width: `${neutralPercent}%` }} />
                      <div className="bg-red-500 h-full transition-all" style={{ width: `${negativePercent}%` }} />
                    </div>
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        {content.sentiment.positive} pos
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        {content.sentiment.neutral} neu
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {content.sentiment.negative} neg
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
                          Trending since {format(new Date(content.trendingStarted), 'MMM d')}
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
                        <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80">
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
                      content.articles.filter(a => a.id !== keyHeadline?.id).map((article) => (
                        <a
                          key={article.id}
                          href={article.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                                {article.title}
                              </h3>
                              {article.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                  {article.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium">{article.source_name}</span>
                                <span>•</span>
                                <span>{format(new Date(article.published_date), 'MMM d')}</span>
                                {article.sentiment_label && (
                                  <Badge variant="outline" className={cn(
                                    "text-xs ml-auto",
                                    article.sentiment_label === 'positive' && "border-green-500/50 text-green-600",
                                    article.sentiment_label === 'negative' && "border-red-500/50 text-red-600"
                                  )}>
                                    {article.sentiment_label}
                                  </Badge>
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
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-purple-600 dark:text-purple-400">
                                  {post.description}
                                </span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(post.published_date), { addSuffix: true })}</span>
                                {post.sentiment_label && (
                                  <Badge variant="outline" className={cn(
                                    "text-xs ml-auto",
                                    post.sentiment_label === 'positive' && "border-green-500/50 text-green-600",
                                    post.sentiment_label === 'negative' && "border-red-500/50 text-red-600"
                                  )}>
                                    {post.sentiment_label}
                                  </Badge>
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
