import { useState, useEffect, useCallback } from "react";
import { ClientLayout } from "@/components/client/ClientLayout";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CreativeCard } from "@/components/client/CreativeCard";
import { CreativePerformanceMatrix } from "@/components/client/CreativePerformanceMatrix";
import { CreativeRecommendations } from "@/components/client/CreativeRecommendations";
import { CreativeDataImport } from "@/components/client/CreativeDataImport";
import {
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  TrendingUp,
  Video,
  Image as ImageIcon,
  MessageSquare,
  AlertTriangle,
  Zap,
  BarChart3,
  Lightbulb,
  Play
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState("gallery");
  const [channelFilter, setChannelFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showImport, setShowImport] = useState(false);

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

      // Calculate stats
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
      <ClientLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (creatives.length === 0 && !showImport) {
    return (
      <ClientLayout>
        <div className="container mx-auto px-4 py-8">
          <Card className="border-dashed max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Creative Intelligence</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Unlock AI-powered insights from your ad creatives. Discover what messaging, 
                tones, and visuals drive the best performance.
              </p>
              <Button onClick={() => setShowImport(true)} size="lg" className="gap-2">
                <TrendingUp className="h-5 w-5" />
                Import Campaign Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  if (showImport) {
    return (
      <ClientLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Button 
              variant="ghost" 
              onClick={() => setShowImport(false)} 
              className="mb-4"
            >
              ← Back to Creative Intelligence
            </Button>
            <CreativeDataImport 
              organizationId={organizationId!}
              onImportComplete={() => {
                setShowImport(false);
                loadCreatives();
              }}
            />
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Creative Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered analysis of your ad creatives
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats?.pendingTranscription && stats.pendingTranscription > 0 && (
              <Button 
                variant="outline" 
                onClick={handleTranscribeVideos}
                disabled={isTranscribing}
                className="gap-2"
              >
                <Play className={cn("h-4 w-4", isTranscribing && "animate-pulse")} />
                Transcribe Videos ({stats.pendingTranscription})
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={handleAnalyzeAll}
              disabled={isAnalyzing}
              className="gap-2"
            >
              <Zap className={cn("h-4 w-4", isAnalyzing && "animate-pulse")} />
              Analyze Creatives
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowImport(true)}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Import Data
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Creatives</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-green-500">{stats.analyzed}</div>
              <div className="text-xs text-muted-foreground">Analyzed</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1">
                <Video className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{stats.videos}</span>
              </div>
              <div className="text-xs text-muted-foreground">Videos</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{stats.images}</span>
              </div>
              <div className="text-xs text-muted-foreground">Images</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-amber-500">{stats.pendingTranscription}</div>
              <div className="text-xs text-muted-foreground">Need Transcription</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold">${stats.avgRoas.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Avg ROAS</div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent">
              <div className="text-2xl font-bold text-primary">{stats.topPerformers}</div>
              <div className="text-xs text-muted-foreground">Top Performers</div>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="gallery" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              Gallery
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Matrix
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Recommend
            </TabsTrigger>
          </TabsList>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by topic, headline, or text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[160px]">
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

            {/* Creative Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCreatives.map((creative) => (
                <CreativeCard key={creative.id} creative={creative} />
              ))}
            </div>

            {filteredCreatives.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No creatives match your filters</p>
              </div>
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
        </Tabs>
      </div>
    </ClientLayout>
  );
}
