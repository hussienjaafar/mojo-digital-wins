import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, Sparkles } from "lucide-react";
import { BookmarkButton } from "./BookmarkButton";
import { SentimentBadge } from "./SentimentIndicator";
import { formatDistanceToNow } from "date-fns";

interface NewsCardProps {
  article: {
    id: string;
    title: string;
    description: string | null;
    source_name: string;
    source_url: string;
    published_date: string;
    image_url: string | null;
    tags: string[];
    category: string | null;
    sentiment_label?: string | null;
    sentiment_confidence?: number | null;
    ai_summary?: string | null;
    is_duplicate?: boolean;
  };
}

export function NewsCard({ article }: NewsCardProps) {
  if (article.is_duplicate) {
    return null;
  }

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'independent': return 'bg-secondary/20 text-secondary';
      case 'mainstream': return 'bg-info/20 text-info';
      case 'conservative': return 'bg-destructive/20 text-destructive';
      case 'specialized': return 'bg-success/20 text-success';
      case 'government': return 'bg-warning/20 text-warning';
      case 'state_government': return 'bg-accent/20 text-accent-foreground';
      case 'civil_rights': return 'bg-primary/20 text-primary';
      default: return 'bg-muted/50 text-muted-foreground';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {article.image_url && (
        <div className="w-full h-48 overflow-hidden">
          <img 
            src={article.image_url} 
            alt={article.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={getCategoryColor(article.category)}>
              {article.source_name}
            </Badge>
            <SentimentBadge 
              sentiment={article.sentiment_label} 
              confidence={article.sentiment_confidence}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(article.published_date), { addSuffix: true })}</span>
            </div>
            <BookmarkButton articleId={article.id} />
          </div>
        </div>
        
        <CardTitle className="text-lg leading-tight hover:text-primary transition-colors">
          <a 
            href={article.source_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-start gap-2"
          >
            {article.title}
            <ExternalLink className="h-4 w-4 flex-shrink-0 mt-1" />
          </a>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* AI Summary */}
        {article.ai_summary && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">AI Summary</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {article.ai_summary}
            </p>
          </div>
        )}

        {/* Original Description */}
        {article.description && !article.ai_summary && (
          <CardDescription className="line-clamp-3">
            {article.description}
          </CardDescription>
        )}
        
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {article.tags.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{article.tags.length - 5} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
