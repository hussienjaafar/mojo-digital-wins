import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientShell } from "@/components/client/ClientShell";
import { ProductionGate } from "@/components/client/ProductionGate";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CreativeCard } from "@/components/client/CreativeCard";
import { CreativePerformanceMatrix } from "@/components/client/CreativePerformanceMatrix";
import { CreativeRecommendations } from "@/components/client/CreativeRecommendations";
import { CreativeScorecard } from "@/components/client/CreativeScorecard";
import { CreativeDataImport } from "@/components/client/CreativeDataImport";
import {
  Sparkles,
  Search,
  TrendingUp,
  Video,
  Image as ImageIcon,
  Zap,
  BarChart3,
  Lightbulb,
  Play,
  Target,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  V3PageContainer,
  V3Card,
  V3CardContent,
  V3KPICard,
  V3LoadingState,
  V3EmptyState,
  V3Button,
} from "@/components/v3";
import { Skeleton } from "@/components/ui/skeleton";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.25 }
  }
};

const tabContentVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2 }
  },
  exit: { opacity: 0, x: 8, transition: { duration: 0.15 } }
};

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

type AnalysisStats = {
  total: number;
  analyzed: number;
  pendingTranscription: number;
  videos: number;
  images: number;
  avgRoas: number;
  topPerformers: number;
};

export default function ClientCreativeIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSyncingPerformance, setIsSyncingPerformance] = useState(false);
  const [activeTab, setActiveTab] = useState("gallery");
  const [channelFilter, setChannelFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any>(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  const loadCreatives = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('meta_creative_insights')
        .select('*')
        .eq('organization_id', organizationId)
        .order('impressions', { ascending: false });

      if (error) throw error;

      setCreatives(data || []);

      const total = data?.length || 0;
      const analyzed = data?.filter(c => c.analyzed_at).length || 0;
      const pendingTranscription = data?.filter(c => 
        c.creative_type === 'video' && !c.audio_transcript && c.video_url
      ).length || 0;
      const videos = data?.filter(c => c.creative_type === 'video').length || 0;
      const images = data?.filter(c => c.creative_type !== 'video').length || 0;
      const validRoas = data?.filter(c => c.roas && c.roas > 0) || [];
      const avgRoas = validRoas.length > 0 
        ? validRoas.reduce((acc, c) => acc + (c.roas || 0), 0) / validRoas.length 
        : 0;
      const topPerformers = data?.filter(c => c.performance_tier === 'top').length || 0;

      setStats({ total, analyzed, pendingTranscription, videos, images, avgRoas, topPerformers });
    } catch (error) {
      console.error('Error loading creatives:', error);
      toast.error('Failed to load creatives');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadCreatives();
  }, [loadCreatives]);

  useEffect(() => {
    const loadAiRecommendations = async () => {
      if (activeTab === 'scorecard' && organizationId && !aiRecommendations && !isLoadingRecs) {
        setIsLoadingRecs(true);
        try {
          const { data, error } = await supabase.functions.invoke('generate-creative-recommendations', {
            body: { organizationId }
          });
          if (error) throw error;
          setAiRecommendations(data);
        } catch (error) {
          console.error('Error loading AI recommendations:', error);
        } finally {
          setIsLoadingRecs(false);
        }
      }
    };
    loadAiRecommendations();
  }, [activeTab, organizationId, aiRecommendations, isLoadingRecs]);

  const handleAnalyzeAll = async () => {
    if (!organizationId) return;
    
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-meta-creatives', {
        body: { organization_id: organizationId, batch_size: 20 }
      });

      if (error) throw error;

      toast.success(`Analyzed ${data.analyzed} creatives`, {
        description: data.errors > 0 ? `${data.errors} errors occurred` : undefined
      });
      
      await loadCreatives();
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze creatives');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTranscribeVideos = async () => {
    if (!organizationId) return;
    
    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-video-creative', {
        body: { organization_id: organizationId, batch_size: 5 }
      });

      if (error) throw error;

      toast.success(`Transcribed ${data.transcribed} videos`, {
        description: data.errors > 0 ? `${data.errors} errors occurred` : undefined
      });
      
      await loadCreatives();
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Failed to transcribe videos');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSyncPerformanceData = async () => {
    if (!organizationId) return;
    
    setIsSyncingPerformance(true);
    try {
      toast.info('Syncing performance data from Meta Ads...', {
        description: 'This may take a moment'
      });

      // First sync fresh data from Meta
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-meta-ads', {
        body: { organization_id: organizationId }
      });

      if (syncError) throw syncError;

      // Then run aggregation to backfill any missing metrics
      const { data: aggData, error: aggError } = await supabase.functions.invoke('aggregate-creative-metrics', {
        body: { organization_id: organizationId }
      });

      if (aggError) {
        console.error('Aggregation error (non-fatal):', aggError);
      }

      const creativesUpdated = aggData?.updated || 0;
      const insightRecords = syncData?.insight_records || 0;

      toast.success('Performance data synced!', {
        description: `${insightRecords} metrics synced, ${creativesUpdated} creatives updated`
      });
      
      await loadCreatives();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync performance data');
    } finally {
      setIsSyncingPerformance(false);
    }
  };

  const filteredCreatives = creatives.filter(c => {
    const matchesChannel = channelFilter === 'all' || 
      (channelFilter === 'video' && c.creative_type === 'video') ||
      (channelFilter === 'image' && c.creative_type !== 'video');
    const matchesTier = tierFilter === 'all' || c.performance_tier === tierFilter;
    const matchesSearch = !searchQuery || 
      c.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.primary_text?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesChannel && matchesTier && matchesSearch;
  });

  if (orgLoading || isLoading) {
    return (
      <ClientShell showDateControls={false}>
        <div className="p-6">
          <V3LoadingState variant="kpi-grid" count={7} />
          <div className="mt-6">
            <V3LoadingState variant="chart" />
          </div>
        </div>
      </ClientShell>
    );
  }

  if (creatives.length === 0 && !showImport) {
    return (
      <ClientShell showDateControls={false}>
        <V3EmptyState
          icon={Sparkles}
          title="Creative Intelligence"
          description="Unlock AI-powered insights from your ad creatives. Discover what messaging, tones, and visuals drive the best performance."
          accent="purple"
          action={
            <V3Button onClick={() => setShowImport(true)}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Import Campaign Data
            </V3Button>
          }
        />
      </ClientShell>
    );
  }

  if (showImport) {
    return (
      <ClientShell showDateControls={false}>
        <V3PageContainer title="Import Campaign Data" description="Import your Meta Ads creative data">
          <V3Button 
            variant="secondary" 
            onClick={() => setShowImport(false)} 
            className="mb-4"
          >
            ← Back to Creative Intelligence
          </V3Button>
          <CreativeDataImport 
            organizationId={organizationId!}
            onImportComplete={() => {
              setShowImport(false);
              loadCreatives();
            }}
          />
        </V3PageContainer>
      </ClientShell>
    );
  }

  return (
    <ClientShell showDateControls={false}>
      <ProductionGate
        title="Creative Analysis"
        description="Analyze ad creative performance with AI-powered insights on messaging, imagery, and audience resonance."
        icon={Sparkles}
      >
      <V3PageContainer
        title="Creative Intelligence"
        description="AI-powered analysis of your ad creatives"
        actions={
          <div className="flex flex-wrap gap-2">
            <V3Button 
              variant="secondary" 
              onClick={handleSyncPerformanceData}
              disabled={isSyncingPerformance}
              size="sm"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isSyncingPerformance && "animate-spin")} />
              {isSyncingPerformance ? 'Syncing...' : 'Sync Performance'}
            </V3Button>
            {stats?.pendingTranscription && stats.pendingTranscription > 0 && (
              <V3Button 
                variant="secondary" 
                onClick={handleTranscribeVideos}
                disabled={isTranscribing}
                size="sm"
              >
                <Play className={cn("h-4 w-4 mr-2", isTranscribing && "animate-pulse")} />
                Transcribe ({stats.pendingTranscription})
              </V3Button>
            )}
            <V3Button 
              variant="secondary" 
              onClick={handleAnalyzeAll}
              disabled={isAnalyzing}
              size="sm"
            >
              <Zap className={cn("h-4 w-4 mr-2", isAnalyzing && "animate-pulse")} />
              Analyze
            </V3Button>
            <V3Button 
              variant="secondary" 
              onClick={() => setShowImport(true)}
              size="sm"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Import
            </V3Button>
          </div>
        }
      >
        {/* Performance Data Warning */}
        {stats && stats.total > 0 && stats.avgRoas === 0 && (
          <V3Card className="mb-6 border-[hsl(var(--portal-accent-amber))]">
            <V3CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--portal-accent-amber))] shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-[hsl(var(--portal-text-primary))]">Performance data not yet populated</p>
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                  Meta Ads metrics are synced every 4 hours. Click "Sync Performance" to fetch the latest data now.
                </p>
              </div>
              <V3Button 
                variant="secondary" 
                size="sm" 
                onClick={handleSyncPerformanceData}
                disabled={isSyncingPerformance}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", isSyncingPerformance && "animate-spin")} />
                Sync Now
              </V3Button>
            </V3CardContent>
          </V3Card>
        )}

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <V3KPICard
              label="Total Creatives"
              value={stats.total}
              icon={Sparkles}
              accent="default"
            />
            <V3KPICard
              label="Analyzed"
              value={stats.analyzed}
              icon={Zap}
              accent="green"
            />
            <V3KPICard
              label="Videos"
              value={stats.videos}
              icon={Video}
              accent="blue"
            />
            <V3KPICard
              label="Images"
              value={stats.images}
              icon={ImageIcon}
              accent="purple"
            />
            <V3KPICard
              label="Need Transcription"
              value={stats.pendingTranscription}
              icon={Play}
              accent="amber"
            />
            <V3KPICard
              label="Avg ROAS"
              value={`${stats.avgRoas.toFixed(2)}x`}
              icon={TrendingUp}
              accent="default"
            />
            <V3KPICard
              label="Top Performers"
              value={stats.topPerformers}
              icon={Target}
              accent="green"
            />
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 max-w-2xl bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
            <TabsTrigger value="gallery" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Gallery</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <Lightbulb className="h-4 w-4" />
              <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Matrix</span>
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Recommend</span>
            </TabsTrigger>
            <TabsTrigger value="scorecard" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Scorecard</span>
            </TabsTrigger>
          </TabsList>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                <Input 
                  placeholder="Search by topic, headline, or text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
                />
              </div>
              <div className="flex gap-2 shrink-0">
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-[100px] xs:w-[120px] sm:w-[140px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
                    <span className="truncate">
                      <SelectValue placeholder="Type" />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[100px] xs:w-[130px] sm:w-[160px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
                    <span className="truncate">
                      <SelectValue placeholder="Performance" />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Performance</SelectItem>
                    <SelectItem value="top">Top Performers</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Creative Grid with animations */}
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              key={`gallery-${channelFilter}-${tierFilter}-${searchQuery}`}
            >
              {filteredCreatives.map((creative, index) => (
                <motion.div key={creative.id} variants={cardVariants}>
                  <CreativeCard creative={creative} />
                </motion.div>
              ))}
            </motion.div>

            {filteredCreatives.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <V3EmptyState
                  icon={Search}
                  title="No Matches"
                  description="No creatives match your current filters"
                  accent="blue"
                />
              </motion.div>
            )}
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <CreativePerformanceMatrix 
              creatives={creatives} 
              dimension="topic-tone"
            />
          </TabsContent>

          {/* Matrix Tab */}
          <TabsContent value="matrix" className="space-y-6">
            <CreativePerformanceMatrix 
              creatives={creatives} 
              dimension="emotional-urgency"
            />
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations">
            <CreativeRecommendations 
              organizationId={organizationId!}
              creatives={creatives}
            />
          </TabsContent>

          {/* Scorecard Tab */}
          <TabsContent value="scorecard">
            {isLoadingRecs ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <CreativeScorecard 
                scorecard={aiRecommendations?.scorecard || null}
                optimalFormula={aiRecommendations?.optimalFormula || null}
              />
            )}
          </TabsContent>
        </Tabs>
      </V3PageContainer>
      </ProductionGate>
    </ClientShell>
  );
}
