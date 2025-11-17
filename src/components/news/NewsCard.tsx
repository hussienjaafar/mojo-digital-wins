import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar } from "lucide-react";
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
  };
}

export function NewsCard({ article }: NewsCardProps) {
  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'independent': return 'bg-purple-500/20 text-purple-700 dark:text-purple-300';
      case 'mainstream': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'conservative': return 'bg-red-500/20 text-red-700 dark:text-red-300';
      case 'specialized': return 'bg-green-500/20 text-green-700 dark:text-green-300';
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
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
          <Badge variant="secondary" className={getCategoryColor(article.category)}>
            {article.source_name}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(article.published_date), { addSuffix: true })}</span>
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
        {article.description && (
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
