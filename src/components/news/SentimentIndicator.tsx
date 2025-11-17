import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    color: "bg-green-500",
    textColor: "text-green-700 dark:text-green-400",
    label: "Positive"
  },
  neutral: {
    icon: Minus,
    color: "bg-gray-500",
    textColor: "text-gray-700 dark:text-gray-400",
    label: "Neutral"
  },
  negative: {
    icon: TrendingDown,
    color: "bg-red-500",
    textColor: "text-red-700 dark:text-red-400",
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg capitalize">{category}</CardTitle>
          <SentimentBadge sentiment={overallSentiment} showConfidence={false} />
        </div>
        <CardDescription>{total} articles analyzed today</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Sentiment Distribution Bar */}
          <div className="w-full h-4 rounded-full overflow-hidden flex">
            <div 
              className="bg-green-500 h-full transition-all" 
              style={{ width: `${percentages.positive}%` }}
            />
            <div 
              className="bg-gray-500 h-full transition-all" 
              style={{ width: `${percentages.neutral}%` }}
            />
            <div 
              className="bg-red-500 h-full transition-all" 
              style={{ width: `${percentages.negative}%` }}
            />
          </div>

          {/* Sentiment Counts */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-center">
              <div className="text-green-600 font-bold">{data.positive_count}</div>
              <div className="text-muted-foreground">Positive</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600 font-bold">{data.neutral_count}</div>
              <div className="text-muted-foreground">Neutral</div>
            </div>
            <div className="text-center">
              <div className="text-red-600 font-bold">{data.negative_count}</div>
              <div className="text-muted-foreground">Negative</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
