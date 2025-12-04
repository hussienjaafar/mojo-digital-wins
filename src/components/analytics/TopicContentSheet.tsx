import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Newspaper, Users, ExternalLink } from "lucide-react";
import { TopicContentResult } from "@/hooks/useTopicContent";
import { cn } from "@/lib/utils";

interface TopicContentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string;
  isLoading: boolean;
  content: TopicContentResult | null;
}

export function TopicContentSheet({ open, onOpenChange, topic, isLoading, content }: TopicContentSheetProps) {
  const hasNews = content?.articles && content.articles.length > 0;
  const hasSocial = content?.socialPosts && content.socialPosts.length > 0;
  const defaultTab = hasNews ? 'news' : hasSocial ? 'social' : 'news';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold capitalize flex items-center gap-2">
            {topic}
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

        <div className="mt-6">
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
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
