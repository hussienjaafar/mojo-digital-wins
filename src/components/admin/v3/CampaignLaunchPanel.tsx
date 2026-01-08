import { useState } from 'react';
import { 
  Send, 
  Mail, 
  MessageSquare, 
  Zap, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  TrendingUp,
  Target,
  Clock,
  Loader2,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle, V3CardDescription } from '@/components/v3/V3Card';
import { cn } from '@/lib/utils';
import { useCampaignGenerator, type GeneratedMessage } from '@/hooks/useCampaignGenerator';
import { useToast } from '@/hooks/use-toast';

type Channel = 'sms' | 'email' | 'social';

interface CampaignLaunchPanelProps {
  trendId: string;
  trendTitle: string;
  organizationId?: string;
  opportunityContext?: string;
  className?: string;
}

const CHANNEL_CONFIG: Record<Channel, { 
  icon: typeof Send; 
  label: string; 
  charLimit: number;
  color: string;
  bgColor: string;
}> = {
  sms: { 
    icon: Send, 
    label: 'SMS', 
    charLimit: 160,
    color: 'text-[hsl(var(--portal-accent-blue))]',
    bgColor: 'bg-[hsl(var(--portal-accent-blue))]/10',
  },
  email: { 
    icon: Mail, 
    label: 'Email', 
    charLimit: 500,
    color: 'text-[hsl(var(--portal-accent-purple))]',
    bgColor: 'bg-[hsl(var(--portal-accent-purple))]/10',
  },
  social: { 
    icon: MessageSquare, 
    label: 'Social', 
    charLimit: 280,
    color: 'text-[hsl(var(--portal-success))]',
    bgColor: 'bg-[hsl(var(--portal-success))]/10',
  },
};

const APPROACH_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  emotional: { 
    label: 'Emotional', 
    color: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
    description: 'Appeals to feelings and values'
  },
  factual: { 
    label: 'Factual', 
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    description: 'Uses data and concrete details'
  },
  urgent: { 
    label: 'Urgent', 
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    description: 'Creates time-sensitive pressure'
  },
};

function MessageVariantCard({ 
  variant, 
  index, 
  isSelected, 
  onSelect,
  onCopy,
  isCopied,
  channel,
}: { 
  variant: GeneratedMessage; 
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  isCopied: boolean;
  channel: Channel;
}) {
  const approachConfig = APPROACH_CONFIG[variant.approach] || APPROACH_CONFIG.factual;
  const charLimit = CHANNEL_CONFIG[channel].charLimit;
  const charCount = variant.message.length;
  const isOverLimit = charCount > charLimit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onSelect}
      className={cn(
        "p-4 rounded-lg border cursor-pointer transition-all",
        isSelected 
          ? "border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue))]/5 ring-1 ring-[hsl(var(--portal-accent-blue))]/20"
          : "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-text-tertiary))] hover:bg-[hsl(var(--portal-bg-elevated))]"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Variant {index + 1}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px]", approachConfig.color)}>
            {approachConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-[hsl(var(--portal-text-tertiary))]" />
            <span className={cn(
              "text-xs font-medium",
              variant.predicted_performance >= 70 ? "text-[hsl(var(--portal-success))]" :
              variant.predicted_performance >= 40 ? "text-[hsl(var(--portal-warning))]" :
              "text-[hsl(var(--portal-text-secondary))]"
            )}>
              {variant.predicted_performance}%
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-[hsl(var(--portal-text-primary))] leading-relaxed mb-3">
        "{variant.message}"
      </p>

      <div className="flex items-center justify-between">
        <span className={cn(
          "text-xs",
          isOverLimit ? "text-[hsl(var(--portal-error))]" : "text-[hsl(var(--portal-text-tertiary))]"
        )}>
          {charCount}/{charLimit} chars
          {isOverLimit && <AlertCircle className="h-3 w-3 inline ml-1" />}
        </span>

        {isSelected && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className="h-7 text-xs gap-1.5"
          >
            {isCopied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--portal-success))]" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function CampaignLaunchPanel({
  trendId,
  trendTitle,
  organizationId,
  opportunityContext,
  className,
}: CampaignLaunchPanelProps) {
  const [channel, setChannel] = useState<Channel>('sms');
  const [customMessage, setCustomMessage] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();
  
  const {
    messages,
    isGenerating,
    error,
    selectedVariant,
    generateMessages,
    selectVariant,
    copyToClipboard,
  } = useCampaignGenerator();

  const handleGenerate = async () => {
    if (!organizationId) {
      toast({
        title: 'Organization required',
        description: 'Please select an organization to generate campaign messages.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await generateMessages({
        organizationId,
        entityName: trendTitle,
        entityType: 'trend',
        opportunityContext: opportunityContext || `Trending topic: ${trendTitle}`,
        numVariants: 3,
        trendEventId: trendId,
      });
      
      toast({
        title: 'Messages generated',
        description: 'AI generated 3 campaign variants for you.',
      });
    } catch (err) {
      toast({
        title: 'Generation failed',
        description: error || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async (message: string, index: number) => {
    const success = await copyToClipboard(message, {
      trendEventId: trendId,
      organizationId,
      channel,
    });

    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast({ title: 'Copied to clipboard' });
    }
  };

  const handleCopyCustom = async () => {
    if (customMessage) {
      await navigator.clipboard.writeText(customMessage);
      toast({ title: 'Copied to clipboard' });
    }
  };

  const channelConfig = CHANNEL_CONFIG[channel];
  const ChannelIcon = channelConfig.icon;

  return (
    <V3Card accent="blue" className={className}>
      <V3CardHeader>
        <V3CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
          Campaign Launcher
        </V3CardTitle>
        <V3CardDescription>
          Generate AI-powered campaign messages linked to this trend
        </V3CardDescription>
      </V3CardHeader>
      
      <V3CardContent className="pt-0 space-y-4">
        {/* Channel Selection */}
        <div className="flex gap-2">
          {(Object.keys(CHANNEL_CONFIG) as Channel[]).map((ch) => {
            const config = CHANNEL_CONFIG[ch];
            const Icon = config.icon;
            return (
              <Button
                key={ch}
                variant={channel === ch ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChannel(ch)}
                className={cn(
                  "gap-1.5",
                  channel === ch && config.bgColor
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
              </Button>
            );
          })}
        </div>

        {/* Generation Button or Results */}
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className={cn("w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4", channelConfig.bgColor)}>
              <ChannelIcon className={cn("h-8 w-8", channelConfig.color)} />
            </div>
            <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-4">
              Generate AI-powered {channelConfig.label} messages for "{trendTitle}"
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !organizationId}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Generate {channelConfig.label} Variants
                </>
              )}
            </Button>
            {!organizationId && (
              <p className="text-xs text-[hsl(var(--portal-text-tertiary))] mt-2">
                Organization context required
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Performance Summary */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
                  Best predicted: <strong className="text-[hsl(var(--portal-text-primary))]">
                    {Math.max(...messages.map(m => m.predicted_performance))}%
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Clock className="h-4 w-4 text-[hsl(var(--portal-text-tertiary))]" />
                <span className="text-xs text-[hsl(var(--portal-text-tertiary))]">
                  Based on historical performance
                </span>
              </div>
            </div>

            {/* Message Variants */}
            <div className="space-y-3">
              {messages.map((variant, index) => (
                <MessageVariantCard
                  key={index}
                  variant={variant}
                  index={index}
                  isSelected={selectedVariant === index}
                  onSelect={() => selectVariant(index)}
                  onCopy={() => handleCopy(variant.message, index)}
                  isCopied={copiedIndex === index}
                  channel={channel}
                />
              ))}
            </div>

            {/* Regenerate Button */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="gap-1.5"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-[hsl(var(--portal-text-secondary))]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Switchboard
              </Button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--portal-error))]/10 border border-[hsl(var(--portal-error))]/20">
            <AlertCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
            <span className="text-sm text-[hsl(var(--portal-error))]">{error}</span>
          </div>
        )}

        {/* Custom Message Section */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-2 text-[hsl(var(--portal-text-tertiary))]">
              <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
              Write custom message
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <Textarea
              placeholder={`Write your own ${channelConfig.label} message...`}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-xs",
                customMessage.length > channelConfig.charLimit 
                  ? "text-[hsl(var(--portal-error))]" 
                  : "text-[hsl(var(--portal-text-tertiary))]"
              )}>
                {customMessage.length}/{channelConfig.charLimit} chars
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCustom}
                disabled={!customMessage}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </V3CardContent>
    </V3Card>
  );
}
