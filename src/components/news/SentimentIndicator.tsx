import { V3Card, V3CardContent, V3CardDescription, V3CardHeader, V3CardTitle } from "@/components/v3/V3Card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SentimentBadgeProps {
  sentiment: string | null;
  confidence?: number | null;
  showConfidence?: boolean;
}

const SENTIMENT_CONFIG = {
  positive: {
    icon: TrendingUp,
    color: "bg-success",
    textColor: "text-success",
    label: "Positive"
  },
  neutral: {
    icon: Minus,
    color: "bg-muted",
    textColor: "text-muted-foreground",
    label: "Neutral"
  },
  negative: {
    icon: TrendingDown,
    color: "bg-destructive",
    textColor: "text-destructive",
    label: "Negative"
  }
};

export function SentimentBadge({ sentiment, confidence, showConfidence = true }: SentimentBadgeProps) {
  if (!sentiment) return null;

  const config = SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.textColor} border-current`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
      {showConfidence && confidence && (
        <span className="ml-1 opacity-75">
          ({Math.round(confidence * 100)}%)
        </span>
      )}
    </Badge>
  );
}

interface SentimentTrendCardProps {
  category: string;
  data: {
    positive_count: number;
    neutral_count: number;
    negative_count: number;
    avg_sentiment_score: number;
  };
}

export function SentimentTrendCard({ category, data }: SentimentTrendCardProps) {
  const total = data.positive_count + data.neutral_count + data.negative_count;
  
  const percentages = {
    positive: total > 0 ? (data.positive_count / total) * 100 : 0,
    neutral: total > 0 ? (data.neutral_count / total) * 100 : 0,
    negative: total > 0 ? (data.negative_count / total) * 100 : 0,
  };

  const overallSentiment = 
    data.avg_sentiment_score > 0.6 ? 'positive' :
    data.avg_sentiment_score < 0.4 ? 'negative' : 'neutral';

  return (
    <V3Card>
      <V3CardHeader>
        <div className="flex items-center justify-between">
          <V3CardTitle className="text-lg capitalize">{category}</V3CardTitle>
          <SentimentBadge sentiment={overallSentiment} showConfidence={false} />
        </div>
        <V3CardDescription>{total} articles analyzed today</V3CardDescription>
      </V3CardHeader>
      <V3CardContent>
        <div className="space-y-3">
          {/* Sentiment Distribution Bar */}
          <div className="w-full h-4 rounded-full overflow-hidden flex">
            <div 
              className="bg-success h-full transition-all" 
              style={{ width: `${percentages.positive}%` }}
            />
            <div 
              className="bg-muted h-full transition-all" 
              style={{ width: `${percentages.neutral}%` }}
            />
            <div 
              className="bg-destructive h-full transition-all" 
              style={{ width: `${percentages.negative}%` }}
            />
          </div>

          {/* Sentiment Counts */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center">
              <div className="text-success font-bold">{data.positive_count}</div>
              <div className="text-muted-foreground">Positive</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground font-bold">{data.neutral_count}</div>
              <div className="text-muted-foreground">Neutral</div>
            </div>
            <div className="text-center">
              <div className="text-destructive font-bold">{data.negative_count}</div>
              <div className="text-muted-foreground">Negative</div>
            </div>
          </div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
