import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, DollarSign, Clock, Sparkles, Copy, CheckCircle2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface MagicMomentCardProps {
  entityName: string;
  entityType: string;
  opportunityScore: number;
  velocity: number;
  estimatedValue?: number;
  similarPastEvents: number;
  historicalContext?: string;
  aiGeneratedMessage: string;
  messageVariants?: string[];
  optimalSendTime?: {
    time: string;
    reason: string;
  };
  detectedAt: string;
  onSendMessage: (message: string) => void;
}

export function MagicMomentCard({
  entityName,
  entityType,
  opportunityScore,
  velocity,
  estimatedValue,
  similarPastEvents,
  historicalContext,
  aiGeneratedMessage,
  messageVariants = [],
  optimalSendTime,
  detectedAt,
  onSendMessage,
}: MagicMomentCardProps) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentMessage = messageVariants[selectedVariant] || aiGeneratedMessage;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Message copied to clipboard");
  };

  const handleSend = () => {
    onSendMessage(currentMessage);
    toast.success("Message ready to send!");
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 relative overflow-hidden">
      {/* Magic sparkle effect */}
      <div className="absolute top-4 right-4">
        <Sparkles className="h-6 w-6 text-primary animate-pulse" />
      </div>

      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-2xl">Magic Moment Detected</CardTitle>
            </div>
            <CardDescription className="text-base">
              {formatDistanceToNow(new Date(detectedAt), { addSuffix: true })}
            </CardDescription>
          </div>
          <Badge variant="default" className="text-lg px-4 py-1">
            {opportunityScore.toFixed(0)}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Badge variant="outline" className="text-lg capitalize">{entityType}</Badge>
          <span className="text-lg font-semibold">{entityName}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Trigger Event */}
        <div className="p-4 bg-background/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Trigger Event</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {entityName} is surging with {velocity.toFixed(0)}% velocity. 
            {similarPastEvents > 0 && ` Similar moments raised funds ${similarPastEvents} time(s) before.`}
          </p>
        </div>

        {/* Historical Context */}
        {(estimatedValue || historicalContext) && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Historical Performance</span>
            </div>
            {estimatedValue && (
              <p className="text-sm mb-2">
                <span className="text-2xl font-bold text-primary">${estimatedValue.toFixed(0)}</span>
                <span className="text-muted-foreground ml-2">raised in similar 48h windows</span>
              </p>
            )}
            {historicalContext && (
              <p className="text-sm text-muted-foreground">{historicalContext}</p>
            )}
          </div>
        )}

        <Separator />

        {/* AI-Generated Message */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold">AI-Generated Message</span>
            </div>
            {messageVariants.length > 1 && (
              <div className="flex gap-1">
                {messageVariants.map((_, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant={selectedVariant === idx ? "default" : "outline"}
                    className="h-8 w-8 p-0"
                    onClick={() => setSelectedVariant(idx)}
                  >
                    {idx + 1}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-background rounded-lg border-2 border-primary/20">
            <p className="text-base leading-relaxed">{currentMessage}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground">
                {currentMessage.length}/160 characters
              </span>
              {messageVariants.length > 1 && (
                <span className="text-xs text-muted-foreground">
                  Variant {selectedVariant + 1} of {messageVariants.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Optimal Send Time */}
        {optimalSendTime && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Best Time to Send</div>
              <div className="text-sm text-muted-foreground">
                {optimalSendTime.time} - {optimalSendTime.reason}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Message
              </>
            )}
          </Button>
          <Button onClick={handleSend} className="flex-1 gap-2">
            <Zap className="h-4 w-4" />
            Use This Message
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
