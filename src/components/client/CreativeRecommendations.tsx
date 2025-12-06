import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Lightbulb, TrendingUp, Zap, CheckCircle2, Target, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Creative = {
  id: string;
  topic: string | null;
  tone: string | null;
  urgency_level: string | null;
  emotional_appeal: string | null;
  call_to_action_type: string | null;
  roas: number | null;
  ctr: number | null;
  conversions: number;
};

type Props = {
  organizationId: string;
  creatives: Creative[];
};

type Recommendation = {
  id: string;
  type: 'topic' | 'tone' | 'emotional' | 'cta' | 'combination';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  basedOn: string;
  suggestion: string;
};

export function CreativeRecommendations({ organizationId, creatives }: Props) {
  const recommendations = useMemo(() => {
    const recs: Recommendation[] = [];
    
    if (creatives.length < 5) {
      return recs;
    }

    // Calculate averages by different dimensions
    const byTopic: Record<string, { count: number; totalRoas: number; totalConv: number }> = {};
    const byTone: Record<string, { count: number; totalRoas: number; totalConv: number }> = {};
    const byEmotional: Record<string, { count: number; totalRoas: number; totalConv: number }> = {};
    const byCta: Record<string, { count: number; totalRoas: number; totalCtr: number }> = {};

    creatives.forEach(c => {
      if (c.topic) {
        if (!byTopic[c.topic]) byTopic[c.topic] = { count: 0, totalRoas: 0, totalConv: 0 };
        byTopic[c.topic].count++;
        byTopic[c.topic].totalRoas += c.roas || 0;
        byTopic[c.topic].totalConv += c.conversions || 0;
      }
      if (c.tone) {
        if (!byTone[c.tone]) byTone[c.tone] = { count: 0, totalRoas: 0, totalConv: 0 };
        byTone[c.tone].count++;
        byTone[c.tone].totalRoas += c.roas || 0;
        byTone[c.tone].totalConv += c.conversions || 0;
      }
      if (c.emotional_appeal) {
        if (!byEmotional[c.emotional_appeal]) byEmotional[c.emotional_appeal] = { count: 0, totalRoas: 0, totalConv: 0 };
        byEmotional[c.emotional_appeal].count++;
        byEmotional[c.emotional_appeal].totalRoas += c.roas || 0;
        byEmotional[c.emotional_appeal].totalConv += c.conversions || 0;
      }
      if (c.call_to_action_type) {
        if (!byCta[c.call_to_action_type]) byCta[c.call_to_action_type] = { count: 0, totalRoas: 0, totalCtr: 0 };
        byCta[c.call_to_action_type].count++;
        byCta[c.call_to_action_type].totalRoas += c.roas || 0;
        byCta[c.call_to_action_type].totalCtr += c.ctr || 0;
      }
    });

    // Find top performers in each category
    const sortByAvgRoas = (data: Record<string, { count: number; totalRoas: number }>) => {
      return Object.entries(data)
        .filter(([_, v]) => v.count >= 2)
        .map(([k, v]) => ({ key: k, avgRoas: v.totalRoas / v.count, count: v.count }))
        .sort((a, b) => b.avgRoas - a.avgRoas);
    };

    const topTopics = sortByAvgRoas(byTopic);
    const topTones = sortByAvgRoas(byTone);
    const topEmotional = sortByAvgRoas(byEmotional);
    const topCtas = sortByAvgRoas(byCta);

    // Generate topic recommendation
    if (topTopics.length > 0) {
      const best = topTopics[0];
      recs.push({
        id: 'topic-1',
        type: 'topic',
        title: `Double down on "${best.key}" content`,
        description: `Your "${best.key}" themed ads are performing ${((best.avgRoas / (topTopics.reduce((a, t) => a + t.avgRoas, 0) / topTopics.length)) * 100 - 100).toFixed(0)}% above average.`,
        confidence: Math.min(0.95, 0.6 + (best.count * 0.05)),
        impact: best.avgRoas > 2 ? 'high' : best.avgRoas > 1 ? 'medium' : 'low',
        basedOn: `${best.count} creatives analyzed`,
        suggestion: `Create more ads focused on ${best.key}. Consider testing variations with different tones while keeping the topic consistent.`
      });
    }

    // Generate tone recommendation
    if (topTones.length > 0) {
      const best = topTones[0];
      recs.push({
        id: 'tone-1',
        type: 'tone',
        title: `Use "${best.key}" tone more often`,
        description: `Ads with a "${best.key}" tone achieve $${best.avgRoas.toFixed(2)} ROAS on average.`,
        confidence: Math.min(0.9, 0.5 + (best.count * 0.05)),
        impact: best.avgRoas > 2 ? 'high' : 'medium',
        basedOn: `${best.count} creatives analyzed`,
        suggestion: `Apply the "${best.key}" tone across more of your creative assets, especially when combined with high-performing topics.`
      });
    }

    // Generate emotional appeal recommendation
    if (topEmotional.length > 0) {
      const best = topEmotional[0];
      recs.push({
        id: 'emotional-1',
        type: 'emotional',
        title: `Lead with "${best.key}" emotional appeal`,
        description: `Messages emphasizing "${best.key}" drive ${((best.avgRoas / (topEmotional.reduce((a, e) => a + e.avgRoas, 0) / topEmotional.length)) * 100 - 100).toFixed(0)}% higher returns.`,
        confidence: Math.min(0.85, 0.5 + (best.count * 0.04)),
        impact: 'medium',
        basedOn: `${best.count} creatives analyzed`,
        suggestion: `Structure your ad copy to evoke "${best.key}" as the primary emotional response. Use imagery and language that reinforces this feeling.`
      });
    }

    // Generate CTA recommendation
    if (topCtas.length > 1) {
      const best = topCtas[0];
      const worst = topCtas[topCtas.length - 1];
      if (best.avgRoas > worst.avgRoas * 1.3) {
        recs.push({
          id: 'cta-1',
          type: 'cta',
          title: `Switch to "${best.key}" CTAs`,
          description: `"${best.key}" outperforms "${worst.key}" by ${(((best.avgRoas / worst.avgRoas) - 1) * 100).toFixed(0)}% in ROAS.`,
          confidence: 0.75,
          impact: 'medium',
          basedOn: `Comparing ${best.count} vs ${worst.count} creatives`,
          suggestion: `Replace "${worst.key}" CTAs with "${best.key}" across your campaigns. Test transitional phrases that align with your top-performing tone.`
        });
      }
    }

    // Generate combination recommendation
    if (topTopics.length > 0 && topTones.length > 0 && topEmotional.length > 0) {
      recs.push({
        id: 'combo-1',
        type: 'combination',
        title: 'Optimal creative formula',
        description: `Combine "${topTopics[0].key}" topic + "${topTones[0].key}" tone + "${topEmotional[0].key}" appeal for maximum impact.`,
        confidence: 0.7,
        impact: 'high',
        basedOn: 'Cross-analysis of all dimensions',
        suggestion: `Create a new campaign using this formula. Start with 3-5 variations testing different headlines while maintaining the core combination.`
      });
    }

    return recs;
  }, [creatives]);

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-green-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'topic': return <Target className="h-4 w-4" />;
      case 'tone': return <MessageSquare className="h-4 w-4" />;
      case 'emotional': return <Zap className="h-4 w-4" />;
      case 'cta': return <TrendingUp className="h-4 w-4" />;
      case 'combination': return <Sparkles className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  if (creatives.length < 5) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Not Enough Data</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We need at least 5 analyzed creatives to generate meaningful recommendations. 
            Import more campaign data to unlock AI-powered creative insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>AI-Powered Recommendations</CardTitle>
              <CardDescription>
                Based on analysis of {creatives.filter(c => c.topic).length} creatives
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Recommendations */}
      <div className="grid gap-4">
        {recommendations.map((rec) => (
          <Card key={rec.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex">
                {/* Left accent */}
                <div className={cn(
                  "w-1 shrink-0",
                  rec.impact === 'high' ? 'bg-green-500' : 
                  rec.impact === 'medium' ? 'bg-blue-500' : 'bg-muted'
                )} />
                
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded bg-primary/10 text-primary">
                          {getTypeIcon(rec.type)}
                        </div>
                        <h3 className="font-semibold">{rec.title}</h3>
                        <Badge className={getImpactColor(rec.impact)}>
                          {rec.impact} impact
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {rec.description}
                      </p>

                      <div className="p-3 rounded-lg bg-muted/50 mb-3">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <p className="text-sm">{rec.suggestion}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {Math.round(rec.confidence * 100)}% confidence
                        </span>
                        <span>{rec.basedOn}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recommendations.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analyzing Patterns...</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Run the AI analysis on your creatives to generate personalized recommendations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
