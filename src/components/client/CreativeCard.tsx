import React, { useState, useRef } from "react";
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
  Type,
  Pause,
  Volume2,
  VolumeX,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  V3Card, 
  V3CardContent, 
  V3Badge, 
  V3Button, 
  getTierBadgeVariant, 
  getSentimentBadgeVariant 
} from "@/components/v3";
import { getTierClasses, iconSizes } from "@/lib/design-tokens";

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
  media_source_url?: string | null;
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

export function CreativeCard({ creative }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const isVideo = creative.creative_type === 'video' || creative.media_source_url;
  const isAnalyzed = !!creative.analyzed_at;
  const hasTranscript = !!creative.audio_transcript;
  const hasPlayableVideo = !!creative.media_source_url;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoLoad = () => {
    setIsVideoLoading(false);
    setVideoError(false);
  };

  const handleVideoError = () => {
    setIsVideoLoading(false);
    setVideoError(true);
    console.error('Video failed to load:', creative.media_source_url);
  };

  // Get ROAS color using portal tokens
  const getRoasColorClass = (roas: number | null) => {
    if (!roas || roas <= 0) return 'text-[hsl(var(--portal-text-muted))]';
    if (roas >= 2) return 'text-[hsl(var(--portal-success))]';
    if (roas >= 1) return 'text-[hsl(var(--portal-warning))]';
    return 'text-[hsl(var(--portal-error))]';
  };

  return (
    <>
      <V3Card 
        interactive 
        className="overflow-hidden cursor-pointer group" 
        onClick={() => setShowDetails(true)}
      >
        {/* Thumbnail/Preview */}
        <div className="relative aspect-video bg-[hsl(var(--portal-bg-secondary))]">
          {creative.thumbnail_url && !thumbnailError ? (
            <img 
              src={creative.thumbnail_url} 
              alt={creative.headline || 'Creative thumbnail'}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setThumbnailError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[hsl(var(--portal-bg-secondary))]">
              {isVideo ? (
                <Video className={cn(iconSizes['2xl'], "text-[hsl(var(--portal-text-muted))]")} />
              ) : (
                <ImageIcon className={cn(iconSizes['2xl'], "text-[hsl(var(--portal-text-muted))]")} />
              )}
            </div>
          )}
          
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Type Badge */}
          <V3Badge variant="secondary" className="absolute top-2 left-2">
            {isVideo ? <Video className={iconSizes.xs} /> : <ImageIcon className={iconSizes.xs} />}
            {creative.creative_type}
          </V3Badge>

          {/* Performance Tier */}
          {creative.performance_tier && (
            <V3Badge 
              variant={getTierBadgeVariant(creative.performance_tier)} 
              className="absolute top-2 right-2"
            >
              {creative.performance_tier}
            </V3Badge>
          )}

          {/* Play button for video */}
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className={cn(
                "p-3 rounded-full shadow-lg",
                hasPlayableVideo 
                  ? "bg-white/90" 
                  : "bg-white/60"
              )}>
                <Play className={cn(
                  iconSizes.lg,
                  hasPlayableVideo 
                    ? "text-[hsl(var(--portal-accent-blue))]" 
                    : "text-[hsl(var(--portal-text-muted))]"
                )} />
              </div>
            </div>
          )}

          {/* Transcript indicator */}
          {isVideo && (
            <div className="absolute bottom-2 right-2">
              {hasTranscript ? (
                <V3Badge variant="success" size="sm">
                  <CheckCircle2 className={iconSizes.xs} />
                  Transcribed
                </V3Badge>
              ) : hasPlayableVideo ? (
                <V3Badge variant="blue" size="sm">
                  <Play className={iconSizes.xs} />
                  Playable
                </V3Badge>
              ) : (
                <V3Badge variant="pending" size="sm">
                  <Clock className={iconSizes.xs} />
                  Pending
                </V3Badge>
              )}
            </div>
          )}
        </div>

        <V3CardContent className="space-y-3">
          {/* Headline */}
          <div>
            <h3 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] line-clamp-2">
              {creative.headline || creative.primary_text?.slice(0, 60) || 'Untitled Creative'}
            </h3>
          </div>

          {/* Analysis Tags */}
          {isAnalyzed && (
            <div className="flex flex-wrap gap-1.5">
              {creative.topic && (
                <V3Badge variant="outline" size="sm">
                  {creative.topic}
                </V3Badge>
              )}
              {creative.tone && (
                <V3Badge variant="outline" size="sm" className="capitalize">
                  {creative.tone}
                </V3Badge>
              )}
              {creative.emotional_appeal && (
                <V3Badge variant="outline" size="sm" className="capitalize">
                  {creative.emotional_appeal}
                </V3Badge>
              )}
            </div>
          )}

          {!isAnalyzed && (
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
              <AlertCircle className={iconSizes.xs} />
              Not analyzed yet
            </div>
          )}

          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[hsl(var(--portal-border)/0.5)]">
            <div className="text-center">
              <div className={cn(
                "text-sm font-semibold",
                creative.impressions > 0 
                  ? "text-[hsl(var(--portal-text-primary))]" 
                  : "text-[hsl(var(--portal-text-muted))]"
              )}>
                {creative.impressions > 0 ? formatNumber(creative.impressions) : '-'}
              </div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center justify-center gap-1">
                <Eye className={iconSizes.xs} />
                Impr.
              </div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-sm font-semibold",
                creative.ctr != null && creative.ctr > 0 
                  ? "text-[hsl(var(--portal-text-primary))]" 
                  : "text-[hsl(var(--portal-text-muted))]"
              )}>
                {creative.ctr != null && creative.ctr > 0 ? `${(creative.ctr * 100).toFixed(2)}%` : '-'}
              </div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center justify-center gap-1">
                <MousePointer className={iconSizes.xs} />
                Link CTR
              </div>
            </div>
            <div className="text-center">
              <div className={cn(
                "text-sm font-semibold",
                getRoasColorClass(creative.roas)
              )}>
                {creative.roas && creative.roas > 0 ? `${creative.roas.toFixed(2)}x` : '-'}
              </div>
              <div className="text-xs text-[hsl(var(--portal-text-muted))] flex items-center justify-center gap-1">
                <DollarSign className={iconSizes.xs} />
                ROAS
              </div>
            </div>
          </div>
          
          {/* No data indicator */}
          {creative.impressions === 0 && (
            <div className="text-xs text-[hsl(var(--portal-text-muted))] text-center pt-1 flex items-center justify-center gap-1">
              <Clock className={iconSizes.xs} />
              Historical creative - no recent delivery
            </div>
          )}
        </V3CardContent>
      </V3Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
              {isVideo ? <Video className={iconSizes.md} /> : <ImageIcon className={iconSizes.md} />}
              Creative Details
            </DialogTitle>
            <DialogDescription className="text-[hsl(var(--portal-text-muted))]">
              {creative.campaign_id}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Video Player or Image Preview */}
              <div className="aspect-video rounded-lg overflow-hidden bg-[hsl(var(--portal-bg-secondary))] relative">
                {hasPlayableVideo && !videoError ? (
                  <>
                    {isVideoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--portal-bg-secondary))] z-10">
                        <Loader2 className={cn(iconSizes.xl, "animate-spin text-[hsl(var(--portal-text-muted))]")} />
                      </div>
                    )}
                    <video
                      ref={videoRef}
                      src={creative.media_source_url!}
                      poster={creative.thumbnail_url || undefined}
                      className="w-full h-full object-contain bg-black"
                      muted={isMuted}
                      playsInline
                      preload="metadata"
                      onLoadedData={handleVideoLoad}
                      onError={handleVideoError}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onLoadStart={() => setIsVideoLoading(true)}
                    />
                    {/* Video Controls */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-2">
                      <V3Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-white hover:bg-white/20"
                        onClick={handlePlayPause}
                      >
                        {isPlaying ? <Pause className={iconSizes.sm} /> : <Play className={iconSizes.sm} />}
                      </V3Button>
                      <V3Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-white hover:bg-white/20"
                        onClick={handleMuteToggle}
                      >
                        {isMuted ? <VolumeX className={iconSizes.sm} /> : <Volume2 className={iconSizes.sm} />}
                      </V3Button>
                      <span className="text-xs text-white/80 ml-auto">
                        Click to {isPlaying ? 'pause' : 'play'}
                      </span>
                    </div>
                  </>
                ) : creative.thumbnail_url ? (
                  <img 
                    src={creative.thumbnail_url}
                    alt="Creative preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {isVideo ? (
                      <div className="text-center">
                        <Video className={cn(iconSizes['2xl'], "text-[hsl(var(--portal-text-muted))] mx-auto mb-2")} />
                        <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                          {videoError ? 'Video failed to load' : 'Video preview not available'}
                        </p>
                      </div>
                    ) : (
                      <ImageIcon className={cn(iconSizes['2xl'], "text-[hsl(var(--portal-text-muted))]")} />
                    )}
                  </div>
                )}
              </div>

              {/* Text Content */}
              <div className="space-y-3">
                {creative.headline && (
                  <div>
                    <h4 className="text-sm font-medium text-[hsl(var(--portal-text-muted))]">Headline</h4>
                    <p className="text-sm text-[hsl(var(--portal-text-primary))]">{creative.headline}</p>
                  </div>
                )}
                {creative.primary_text && (
                  <div>
                    <h4 className="text-sm font-medium text-[hsl(var(--portal-text-muted))]">Primary Text</h4>
                    <p className="text-sm text-[hsl(var(--portal-text-primary))] whitespace-pre-wrap">{creative.primary_text}</p>
                  </div>
                )}
                {creative.description && (
                  <div>
                    <h4 className="text-sm font-medium text-[hsl(var(--portal-text-muted))]">Description</h4>
                    <p className="text-sm text-[hsl(var(--portal-text-primary))]">{creative.description}</p>
                  </div>
                )}
              </div>

              {/* Transcript */}
              {creative.audio_transcript && (
                <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary)/0.5)]">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2 text-[hsl(var(--portal-text-primary))]">
                    <MessageSquare className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-blue))]")} />
                    Audio Transcript
                  </h4>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))] whitespace-pre-wrap">
                    {creative.audio_transcript}
                  </p>
                </div>
              )}

              {/* AI Analysis */}
              {isAnalyzed && (
                <V3Card className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                    <Sparkles className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-blue))]")} />
                    AI Analysis
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">Topic</span>
                      <p className="font-medium capitalize text-[hsl(var(--portal-text-primary))]">{creative.topic || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">Tone</span>
                      <p className="font-medium capitalize text-[hsl(var(--portal-text-primary))]">{creative.tone || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">Emotional Appeal</span>
                      <p className="font-medium capitalize text-[hsl(var(--portal-text-primary))]">{creative.emotional_appeal || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">Urgency</span>
                      <p className="font-medium capitalize text-[hsl(var(--portal-text-primary))]">{creative.urgency_level || '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">Sentiment</span>
                      <V3Badge variant={getSentimentBadgeVariant(creative.sentiment_label)} className="capitalize">
                        {creative.sentiment_label || '-'}
                        {creative.sentiment_score != null && ` (${(creative.sentiment_score * 100).toFixed(0)}%)`}
                      </V3Badge>
                    </div>
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">CTA</span>
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">{creative.call_to_action_type || '-'}</p>
                    </div>
                  </div>

                  {/* Key Themes */}
                  {creative.key_themes && creative.key_themes.length > 0 && (
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">Key Themes</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {creative.key_themes.map((theme, i) => (
                          <V3Badge key={i} variant="outline" size="sm">
                            {theme}
                          </V3Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Effectiveness Score */}
                  {creative.effectiveness_score != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[hsl(var(--portal-text-muted))]">Effectiveness Score</span>
                        <span className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">
                          {(creative.effectiveness_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={creative.effectiveness_score * 100} className="h-2" />
                    </div>
                  )}
                </V3Card>
              )}

              {/* Visual Analysis */}
              {creative.visual_analysis && (
                <V3Card className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                    <Palette className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-purple))]")} />
                    Visual Analysis
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    {creative.has_faces !== null && (
                      <div className="flex items-center gap-2">
                        <User className={iconSizes.sm} />
                        <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                          {creative.has_faces ? 'Contains faces' : 'No faces detected'}
                        </span>
                      </div>
                    )}
                    {creative.detected_text && (
                      <div className="flex items-center gap-2">
                        <Type className={iconSizes.sm} />
                        <span className="text-sm text-[hsl(var(--portal-text-primary))] line-clamp-1">
                          "{creative.detected_text}"
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Color Palette */}
                  {creative.color_palette && creative.color_palette.length > 0 && (
                    <div>
                      <span className="text-xs text-[hsl(var(--portal-text-muted))]">Color Palette</span>
                      <div className="flex gap-2 mt-1">
                        {creative.color_palette.map((color, i) => (
                          <div
                            key={i}
                            className="h-8 w-8 rounded border border-[hsl(var(--portal-border))]"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </V3Card>
              )}

              {/* Performance Stats */}
              <V3Card className="space-y-4">
                <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Performance Metrics</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
                    <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                      {formatNumber(creative.impressions)}
                    </div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">Impressions</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
                    <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                      {formatNumber(creative.clicks)}
                    </div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">Clicks</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
                    <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                      {formatNumber(creative.conversions)}
                    </div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">Conversions</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
                    <div className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
                      ${creative.spend.toFixed(2)}
                    </div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">Spend</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
                    <div className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
                      ${creative.conversion_value.toFixed(2)}
                    </div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))]">Revenue</div>
                  </div>
                </div>
              </V3Card>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
