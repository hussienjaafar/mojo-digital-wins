import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClientShell } from "@/components/client/ClientShell";
import { ProductionGate } from "@/components/client/ProductionGate";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CreativeCard } from "@/components/client/CreativeCard";
import { CreativePerformanceMatrix } from "@/components/client/CreativePerformanceMatrix";
import { CreativePerformanceQuadrant } from "@/components/client/CreativePerformanceQuadrant";
import { CreativeComparison } from "@/components/client/CreativeComparison";
import { DataAccuracyDisclosure } from "@/components/client/DataAccuracyDisclosure";
import { CreativeRecommendations } from "@/components/client/CreativeRecommendations";
import { CreativeScorecard } from "@/components/client/CreativeScorecard";
import { CreativeDataImport } from "@/components/client/CreativeDataImport";
import { CreativeOptimizationScorecard } from "@/components/client/CreativeOptimizationScorecard";
import { AIInsightsBanner } from "@/components/client/AIInsightsBanner";
import { WinningFormulasGrid } from "@/components/client/WinningFormulasGrid";
import { AdFatigueMonitor } from "@/components/client/AdFatigueMonitor";
import { useCreativeCorrelations, useAdFatigueAlerts, useRefreshCorrelations } from "@/hooks/useCreativeCorrelations";
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
  AlertTriangle,
  ChevronRight,
  LucideIcon,
  Pin,
  Brain,
  Activity,
  Gauge,
  Filter,
  Grid3X3,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  V3PageContainer,
  V3Card,
  V3CardContent,
  V3LoadingState,
  V3EmptyState,
  V3Button,
  V3SectionHeader,
  V3Badge,
} from "@/components/v3";
import { Skeleton } from "@/components/ui/skeleton";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.02 }
  }
};

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: "easeOut" as const }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.2 }
  }
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
  link_ctr: number | null;
  link_clicks: number | null;
  roas: number | null;
  analyzed_at: string | null;
  effectiveness_score: number | null;
  performance_tier: string | null;
  visual_analysis: any | null;
  detected_text: string | null;
  color_palette: string[] | null;
  has_faces: boolean | null;
  video_thruplay: number | null;
};

type AnalysisStats = {
  total: number;
  analyzed: number;
  pendingTranscription: number;
  videos: number;
  images: number;
  avgRoas: number;
  topPerformers: number;
  totalSpend: number;
  totalRevenue: number;
};

export default function ClientCreativeIntelligence() {
  const { organizationId, isLoading: orgLoading } = useClientOrganization();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSyncingPerformance, setIsSyncingPerformance] = useState(false);
  const [activeView, setActiveView] = useState<"command" | "gallery" | "analysis">("command");
  const [channelFilter, setChannelFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any>(null);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [pinnedCreatives, setPinnedCreatives] = useState<[any | null, any | null]>([null, null]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // New data hooks for correlation engine
  const { data: correlations = [], isLoading: correlationsLoading } = useCreativeCorrelations(organizationId || '');
  const { data: fatigueAlerts = [], isLoading: fatigueLoading } = useAdFatigueAlerts(organizationId || '');
  const refreshCorrelations = useRefreshCorrelations(organizationId || '');

  const handlePinCreative = useCallback((creative: any) => {
    setPinnedCreatives(prev => {
      if (prev[0]?.id === creative.id) return [null, prev[1]];
      if (prev[1]?.id === creative.id) return [prev[0], null];
      if (!prev[0]) return [creative, prev[1]];
      if (!prev[1]) return [prev[0], creative];
      return [creative, prev[1]];
    });
    toast.success('Creative pinned for comparison');
  }, []);

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
      const totalSpend = data?.reduce((acc, c) => acc + (c.spend || 0), 0) || 0;
      const totalRevenue = data?.reduce((acc, c) => acc + (c.conversion_value || 0), 0) || 0;

      setStats({ total, analyzed, pendingTranscription, videos, images, avgRoas, topPerformers, totalSpend, totalRevenue });
      
      const latestAnalyzedAt = data?.filter(c => c.analyzed_at)
        .map(c => c.analyzed_at)
        .sort()
        .pop();
      setLastSyncedAt(latestAnalyzedAt || null);
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
      if (activeView === 'analysis' && organizationId && !aiRecommendations && !isLoadingRecs) {
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
  }, [activeView, organizationId, aiRecommendations, isLoadingRecs]);

  const handleAnalyzeAll = async () => {
    if (!organizationId) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-meta-creatives', {
        body: { organization_id: organizationId, batch_size: 20 }
      });
      if (error) throw error;
      toast.success(`Analyzed ${data.analyzed} creatives`);
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
      toast.success(`Transcribed ${data.transcribed} videos`);
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
      toast.info('Syncing performance data from Meta Ads...');

      const { error: syncError } = await supabase.functions.invoke('sync-meta-ads', {
        body: { organization_id: organizationId }
      });
      if (syncError) throw syncError;

      const { error: aggError } = await supabase.functions.invoke('aggregate-creative-metrics', {
        body: { organization_id: organizationId }
      });
      if (aggError) console.error('Aggregation error (non-fatal):', aggError);

      // Also refresh correlations
      try {
        await supabase.functions.invoke('calculate-creative-learnings', {
          body: { organization_id: organizationId }
        });
        await supabase.functions.invoke('detect-ad-fatigue', {
          body: { organization_id: organizationId }
        });
      } catch (e) {
        console.error('Correlation refresh error (non-fatal):', e);
      }

      toast.success('Performance data synced!');
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

  // Loading state
  if (orgLoading || isLoading) {
    return (
      <ClientShell showDateControls={false}>
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <V3LoadingState variant="kpi-grid" count={4} />
          <div className="mt-6 space-y-4">
            <V3LoadingState variant="chart" />
            <V3LoadingState variant="chart" />
          </div>
        </div>
      </ClientShell>
    );
  }

  // Empty state
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

  // Import view
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
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Command Center Header */}
            <motion.header variants={sectionVariants} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[hsl(var(--portal-accent-purple))] to-[hsl(var(--portal-accent-blue))]">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--portal-text-primary))]">
                      Creative Intelligence
                    </h1>
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                      Autonomous optimization engine • {stats?.total || 0} creatives tracked
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <V3Button 
                  variant="secondary" 
                  onClick={handleSyncPerformanceData}
                  disabled={isSyncingPerformance}
                  size="sm"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", isSyncingPerformance && "animate-spin")} />
                  {isSyncingPerformance ? 'Syncing...' : 'Sync Data'}
                </V3Button>
                <V3Button 
                  variant="secondary" 
                  onClick={handleAnalyzeAll}
                  disabled={isAnalyzing}
                  size="sm"
                >
                  <Zap className={cn("h-4 w-4 mr-2", isAnalyzing && "animate-pulse")} />
                  Analyze
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
                  variant="ghost" 
                  onClick={() => setShowImport(true)}
                  size="sm"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Import
                </V3Button>
              </div>
            </motion.header>

            {/* View Tabs */}
            <motion.div variants={sectionVariants}>
              <div className="flex items-center gap-2 p-1 bg-[hsl(var(--portal-bg-elevated))] rounded-xl w-fit border border-[hsl(var(--portal-border))]">
                {[
                  { key: "command", label: "Command Center", icon: Gauge },
                  { key: "gallery", label: "Creative Gallery", icon: LayoutGrid },
                  { key: "analysis", label: "Deep Analysis", icon: BarChart3 },
                ].map((view) => (
                  <button
                    key={view.key}
                    onClick={() => setActiveView(view.key as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      activeView === view.key
                        ? "bg-[hsl(var(--portal-accent-blue))] text-white shadow-md"
                        : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-secondary))]"
                    )}
                  >
                    <view.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{view.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Performance Warning */}
            {stats && stats.total > 0 && stats.avgRoas === 0 && (
              <motion.section variants={sectionVariants}>
                <V3Card className="border-[hsl(var(--portal-warning)/0.5)] bg-[hsl(var(--portal-warning)/0.05)]">
                  <V3CardContent className="flex items-center gap-3 py-3">
                    <AlertTriangle className="h-5 w-5 text-[hsl(var(--portal-warning))] shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-[hsl(var(--portal-text-primary))]">Performance data not yet populated</p>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                        Click "Sync Data" to fetch the latest metrics from Meta Ads.
                      </p>
                    </div>
                  </V3CardContent>
                </V3Card>
              </motion.section>
            )}

            {/* COMMAND CENTER VIEW */}
            {activeView === "command" && (
              <>
                {/* AI Insights Banner */}
                {correlations.length > 0 && (
                  <motion.section variants={sectionVariants}>
                    <AIInsightsBanner 
                      correlations={correlations}
                      onDismiss={(id) => console.log('Dismissed:', id)}
                    />
                  </motion.section>
                )}

                {/* Optimization Scorecard */}
                <motion.section variants={sectionVariants}>
                  <CreativeOptimizationScorecard
                    creatives={creatives}
                    fatigueAlerts={fatigueAlerts}
                    correlations={correlations}
                  />
                </motion.section>

                {/* Performance Quadrant */}
                <motion.section variants={sectionVariants}>
                  <V3Card>
                    <V3CardContent className="p-6">
                      <V3SectionHeader
                        title="Performance Quadrant"
                        subtitle="Strategic view: Spend vs ROAS mapping"
                        icon={Target}
                        size="sm"
                        className="mb-4"
                      />
                      <CreativePerformanceQuadrant
                        creatives={creatives}
                        onCreativeClick={handlePinCreative}
                      />
                    </V3CardContent>
                  </V3Card>
                </motion.section>

                {/* Two-column layout for Winning Formulas + Fatigue Monitor */}
                <motion.section variants={sectionVariants} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Winning Formulas */}
                  <div>
                    <V3SectionHeader
                      title="Winning Formulas"
                      subtitle="What works best based on historical performance"
                      icon={Lightbulb}
                      size="sm"
                      className="mb-4"
                    />
                    <WinningFormulasGrid organizationId={organizationId || ''} />
                  </div>

                  {/* Ad Fatigue Monitor */}
                  <div>
                    <V3SectionHeader
                      title="Ad Fatigue Monitor"
                      subtitle="Early warning system for declining ads"
                      icon={Activity}
                      size="sm"
                      className="mb-4"
                    />
                    <AdFatigueMonitor
                      alerts={fatigueAlerts}
                      creatives={creatives}
                    />
                  </div>
                </motion.section>

                {/* Creative Comparison (if pinned) */}
                {(pinnedCreatives[0] || pinnedCreatives[1]) && (
                  <motion.section variants={sectionVariants}>
                    <V3Card>
                      <V3CardContent className="p-6">
                        <V3SectionHeader
                          title="Creative Comparison"
                          subtitle="Side-by-side analysis of pinned creatives"
                          icon={Pin}
                          size="sm"
                          className="mb-4"
                        />
                        <CreativeComparison
                          pinnedCreatives={pinnedCreatives}
                          onRemove={(slot) => setPinnedCreatives(prev => 
                            slot === 0 ? [null, prev[1]] : [prev[0], null]
                          )}
                          onClear={() => setPinnedCreatives([null, null])}
                        />
                      </V3CardContent>
                    </V3Card>
                  </motion.section>
                )}

                {/* Data Accuracy Disclosure */}
                <motion.section variants={sectionVariants}>
                  <DataAccuracyDisclosure
                    lastSyncedAt={lastSyncedAt}
                    totalCreatives={stats?.total || 0}
                    creativesWithMetrics={creatives.filter(c => c.impressions > 0).length}
                  />
                </motion.section>
              </>
            )}

            {/* GALLERY VIEW */}
            {activeView === "gallery" && (
              <motion.section variants={sectionVariants}>
                <V3Card>
                  <V3CardContent className="p-6">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                        <Input 
                          placeholder="Search by topic, headline, or text..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
                        />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Select value={channelFilter} onValueChange={setChannelFilter}>
                          <SelectTrigger className="w-[130px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="video">Videos</SelectItem>
                            <SelectItem value="image">Images</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={tierFilter} onValueChange={setTierFilter}>
                          <SelectTrigger className="w-[150px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
                            <SelectValue placeholder="Performance" />
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

                    {/* Results count */}
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                        Showing {filteredCreatives.length} of {creatives.length} creatives
                      </p>
                      {pinnedCreatives[0] || pinnedCreatives[1] ? (
                        <V3Badge variant="blue">
                          <Pin className="w-3 h-3 mr-1" />
                          {[pinnedCreatives[0], pinnedCreatives[1]].filter(Boolean).length} pinned
                        </V3Badge>
                      ) : null}
                    </div>

                    {/* Creative Grid */}
                    <motion.div 
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      key={`gallery-${channelFilter}-${tierFilter}-${searchQuery}`}
                    >
                      {filteredCreatives.map((creative) => (
                        <motion.div key={creative.id} variants={cardVariants}>
                          <CreativeCard creative={creative} />
                        </motion.div>
                      ))}
                    </motion.div>

                    {filteredCreatives.length === 0 && (
                      <V3EmptyState
                        icon={Search}
                        title="No Matches"
                        description="No creatives match your current filters"
                        accent="blue"
                      />
                    )}
                  </V3CardContent>
                </V3Card>
              </motion.section>
            )}

            {/* ANALYSIS VIEW */}
            {activeView === "analysis" && (
              <motion.section variants={sectionVariants}>
                <V3Card>
                  <V3CardContent className="p-6">
                    <Tabs defaultValue="matrix">
                      <TabsList className="mb-6 bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
                        <TabsTrigger value="matrix" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
                          <BarChart3 className="h-4 w-4" />
                          Topic-Tone Matrix
                        </TabsTrigger>
                        <TabsTrigger value="emotional" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
                          <Lightbulb className="h-4 w-4" />
                          Emotional Matrix
                        </TabsTrigger>
                        <TabsTrigger value="recommendations" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
                          <Sparkles className="h-4 w-4" />
                          AI Recommendations
                        </TabsTrigger>
                        <TabsTrigger value="scorecard" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white">
                          <Target className="h-4 w-4" />
                          AI Scorecard
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="matrix">
                        <CreativePerformanceMatrix 
                          creatives={creatives} 
                          dimension="topic-tone"
                        />
                      </TabsContent>

                      <TabsContent value="emotional">
                        <CreativePerformanceMatrix 
                          creatives={creatives} 
                          dimension="emotional-urgency"
                        />
                      </TabsContent>

                      <TabsContent value="recommendations">
                        <CreativeRecommendations 
                          organizationId={organizationId!}
                          creatives={creatives}
                        />
                      </TabsContent>

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
                  </V3CardContent>
                </V3Card>
              </motion.section>
            )}
          </motion.div>
        </div>
      </ProductionGate>
    </ClientShell>
  );
}
