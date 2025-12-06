import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Video, 
  Image as ImageIcon, 
  Play, 
  Eye, 
  MousePointer, 
  DollarSign,
  MessageSquare,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Palette,
  User,
  Type
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Creative = {
  id: string;
  campaign_id: string;
  ad_id: string | null;
  primary_text: string | null;
  headline: string | null;
  description: string | null;
  call_to_action_type: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  creative_type: string;
  audio_transcript: string | null;
  transcription_status: string | null;
  topic: string | null;
  tone: string | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  urgency_level: string | null;
  emotional_appeal: string | null;
  key_themes: string[] | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number | null;
  roas: number | null;
  analyzed_at: string | null;
  effectiveness_score: number | null;
  performance_tier: string | null;
  visual_analysis: any | null;
  detected_text: string | null;
  color_palette: string[] | null;
  has_faces: boolean | null;
};

type Props = {
  creative: Creative;
};

function getTierColor(tier: string | null) {
  switch (tier) {
    case 'top': return 'bg-green-500 text-white';
    case 'high': return 'bg-blue-500 text-white';
    case 'medium': return 'bg-yellow-500 text-white';
    case 'low': return 'bg-red-500 text-white';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getSentimentColor(sentiment: string | null) {
  switch (sentiment?.toLowerCase()) {
    case 'positive': return 'text-green-500';
    case 'negative': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

export function CreativeCard({ creative }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const isVideo = creative.creative_type === 'video';
  const isAnalyzed = !!creative.analyzed_at;
  const hasTranscript = !!creative.audio_transcript;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 group cursor-pointer" onClick={() => setShowDetails(true)}>
        {/* Thumbnail/Preview */}
        <div className="relative aspect-video bg-muted">
          {creative.thumbnail_url ? (
            <img 
              src={creative.thumbnail_url} 
              alt={creative.headline || 'Creative thumbnail'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? (
                <Video className="h-12 w-12 text-muted-foreground" />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
          )}
          
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Type Badge */}
          <Badge className="absolute top-2 left-2" variant="secondary">
            {isVideo ? <Video className="h-3 w-3 mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
            {creative.creative_type}
          </Badge>

          {/* Performance Tier */}
          {creative.performance_tier && (
            <Badge className={cn("absolute top-2 right-2", getTierColor(creative.performance_tier))}>
              {creative.performance_tier}
            </Badge>
          )}

          {/* Play button for video */}
          {isVideo && creative.video_url && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="p-3 rounded-full bg-white/90 shadow-lg">
                <Play className="h-6 w-6 text-primary" />
              </div>
            </div>
          )}

          {/* Transcript indicator */}
          {isVideo && (
            <div className="absolute bottom-2 right-2">
              {hasTranscript ? (
                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Transcribed
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          )}
        </div>

        <CardContent className="p-4 space-y-3">
          {/* Headline */}
          <div>
            <h3 className="font-medium text-sm line-clamp-2">
              {creative.headline || creative.primary_text?.slice(0, 60) || 'Untitled Creative'}
            </h3>
          </div>

          {/* Analysis Tags */}
          {isAnalyzed && (
            <div className="flex flex-wrap gap-1.5">
              {creative.topic && (
                <Badge variant="outline" className="text-xs">
                  {creative.topic}
                </Badge>
              )}
              {creative.tone && (
                <Badge variant="outline" className="text-xs capitalize">
                  {creative.tone}
                </Badge>
              )}
              {creative.emotional_appeal && (
                <Badge variant="outline" className="text-xs capitalize">
                  {creative.emotional_appeal}
                </Badge>
              )}
            </div>
          )}

          {!isAnalyzed && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Not analyzed yet
            </div>
          )}

          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center">
              <div className="text-sm font-semibold">{formatNumber(creative.impressions)}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" />
                Impr.
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold">
                {creative.ctr ? `${(creative.ctr * 100).toFixed(2)}%` : '-'}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <MousePointer className="h-3 w-3" />
                CTR
              </div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-sm font-semibold",
                (creative.roas || 0) >= 2 ? "text-green-500" : (creative.roas || 0) >= 1 ? "text-yellow-500" : "text-red-500"
              )}>
                {creative.roas ? `$${creative.roas.toFixed(2)}` : '-'}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <DollarSign className="h-3 w-3" />
                ROAS
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isVideo ? <Video className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
              Creative Details
            </DialogTitle>
            <DialogDescription>
              {creative.campaign_id}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Preview */}
              {creative.thumbnail_url && (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={creative.thumbnail_url}
                    alt="Creative preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Text Content */}
              <div className="space-y-3">
                {creative.headline && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Headline</h4>
                    <p className="text-sm">{creative.headline}</p>
                  </div>
                )}
                {creative.primary_text && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Primary Text</h4>
                    <p className="text-sm whitespace-pre-wrap">{creative.primary_text}</p>
                  </div>
                )}
                {creative.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                    <p className="text-sm">{creative.description}</p>
                  </div>
                )}
              </div>

              {/* Transcript */}
              {creative.audio_transcript && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Audio Transcript
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {creative.audio_transcript}
                  </p>
                </div>
              )}

              {/* AI Analysis */}
              {isAnalyzed && (
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Analysis
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">Topic</span>
                      <p className="font-medium capitalize">{creative.topic || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Tone</span>
                      <p className="font-medium capitalize">{creative.tone || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Emotional Appeal</span>
                      <p className="font-medium capitalize">{creative.emotional_appeal || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Urgency</span>
                      <p className="font-medium capitalize">{creative.urgency_level || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Sentiment</span>
                      <p className={cn("font-medium capitalize", getSentimentColor(creative.sentiment_label))}>
                        {creative.sentiment_label || '-'}
                        {creative.sentiment_score && ` (${creative.sentiment_score.toFixed(2)})`}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">CTA</span>
                      <p className="font-medium capitalize">{creative.call_to_action_type || '-'}</p>
                    </div>
                  </div>

                  {creative.key_themes && creative.key_themes.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Key Themes</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {creative.key_themes.map((theme, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Effectiveness Score */}
                  {creative.effectiveness_score !== null && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">Effectiveness Score</span>
                        <span className={cn(
                          "text-sm font-bold",
                          creative.effectiveness_score >= 80 ? "text-green-500" :
                          creative.effectiveness_score >= 60 ? "text-blue-500" :
                          creative.effectiveness_score >= 40 ? "text-yellow-500" :
                          "text-red-500"
                        )}>
                          {creative.effectiveness_score.toFixed(0)}/100
                        </span>
                      </div>
                      <Progress 
                        value={creative.effectiveness_score} 
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Visual Analysis */}
              {creative.visual_analysis && (
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    Visual Analysis
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {creative.visual_analysis.composition_style && (
                      <div>
                        <span className="text-xs text-muted-foreground">Composition</span>
                        <p className="font-medium capitalize">{creative.visual_analysis.composition_style}</p>
                      </div>
                    )}
                    {creative.has_faces !== null && (
                      <div>
                        <span className="text-xs text-muted-foreground">Has Faces</span>
                        <p className="font-medium flex items-center gap-1">
                          <User className={cn("h-4 w-4", creative.has_faces ? "text-green-500" : "text-muted-foreground")} />
                          {creative.has_faces ? 'Yes' : 'No'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Detected Text */}
                  {creative.detected_text && (
                    <div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Type className="h-3 w-3" />
                        Detected Text
                      </span>
                      <p className="text-sm mt-1 p-2 bg-muted/50 rounded">
                        {creative.detected_text}
                      </p>
                    </div>
                  )}

                  {/* Color Palette */}
                  {creative.color_palette && creative.color_palette.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Color Palette</span>
                      <div className="flex gap-1 mt-1">
                        {creative.color_palette.slice(0, 5).map((color: string, i: number) => (
                          <div 
                            key={i}
                            className="w-8 h-8 rounded-md border shadow-sm"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visual Elements */}
                  {creative.visual_analysis.visual_elements && (
                    <div>
                      <span className="text-xs text-muted-foreground">Visual Elements</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {creative.visual_analysis.visual_elements.map((element: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {element}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Performance */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-3">
                  <div className="text-lg font-bold">{formatNumber(creative.impressions)}</div>
                  <div className="text-xs text-muted-foreground">Impressions</div>
                </Card>
                <Card className="p-3">
                  <div className="text-lg font-bold">{formatNumber(creative.clicks)}</div>
                  <div className="text-xs text-muted-foreground">Clicks</div>
                </Card>
                <Card className="p-3">
                  <div className="text-lg font-bold">${creative.spend.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Spend</div>
                </Card>
                <Card className="p-3">
                  <div className={cn(
                    "text-lg font-bold",
                    (creative.roas || 0) >= 2 ? "text-green-500" : (creative.roas || 0) >= 1 ? "text-yellow-500" : ""
                  )}>
                    ${creative.roas?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-muted-foreground">ROAS</div>
                </Card>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
