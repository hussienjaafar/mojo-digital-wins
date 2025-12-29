import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertCircle, Target, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  V3Card, 
  V3CardHeader, 
  V3CardTitle, 
  V3CardDescription, 
  V3CardContent, 
  V3Badge, 
  V3Button 
} from "@/components/v3";
import { iconSizes } from "@/lib/design-tokens";

type ScorecardData = {
  topTopics: string[];
  topTones: string[];
  topEmotional: string[];
  topCtas: string[];
  avgRoas: number;
  topPerformerRoas: number;
};

type Props = {
  scorecard: ScorecardData | null;
  optimalFormula: {
    topic: string | null;
    tone: string | null;
    emotionalAppeal: string | null;
    cta: string | null;
    expectedRoas: number;
  } | null;
};

export function CreativeScorecard({ scorecard, optimalFormula }: Props) {
  const [newCreative, setNewCreative] = useState({
    topic: "",
    tone: "",
    emotionalAppeal: "",
    cta: "",
    headline: ""
  });
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string }[]>([]);

  const evaluateCreative = () => {
    if (!scorecard) return;
    
    let totalScore = 0;
    const newFeedback: typeof feedback = [];

    // Check topic (30 points)
    if (scorecard.topTopics.includes(newCreative.topic)) {
      const topicIndex = scorecard.topTopics.indexOf(newCreative.topic);
      totalScore += 30 - (topicIndex * 5);
      newFeedback.push({ 
        type: 'success', 
        message: `"${newCreative.topic}" is a top-performing topic (#${topicIndex + 1})` 
      });
    } else if (newCreative.topic) {
      totalScore += 10;
      newFeedback.push({ 
        type: 'warning', 
        message: `"${newCreative.topic}" is untested. Consider using: ${scorecard.topTopics.slice(0, 2).join(", ")}` 
      });
    }

    // Check tone (25 points)
    if (scorecard.topTones.includes(newCreative.tone)) {
      const toneIndex = scorecard.topTones.indexOf(newCreative.tone);
      totalScore += 25 - (toneIndex * 5);
      newFeedback.push({ 
        type: 'success', 
        message: `"${newCreative.tone}" tone aligns with top performers` 
      });
    } else if (newCreative.tone) {
      totalScore += 8;
      newFeedback.push({ 
        type: 'warning', 
        message: `Consider "${scorecard.topTones[0]}" tone for better results` 
      });
    }

    // Check emotional appeal (20 points)
    if (scorecard.topEmotional.includes(newCreative.emotionalAppeal)) {
      totalScore += 20;
      newFeedback.push({ 
        type: 'success', 
        message: `"${newCreative.emotionalAppeal}" emotional appeal matches proven patterns` 
      });
    } else if (newCreative.emotionalAppeal) {
      totalScore += 8;
      newFeedback.push({ 
        type: 'warning', 
        message: `"${scorecard.topEmotional[0]}" emotional appeal typically performs better` 
      });
    }

    // Check CTA (15 points)
    if (scorecard.topCtas.includes(newCreative.cta)) {
      totalScore += 15;
      newFeedback.push({ 
        type: 'success', 
        message: `"${newCreative.cta}" CTA has strong historical performance` 
      });
    } else if (newCreative.cta) {
      totalScore += 5;
      newFeedback.push({ 
        type: 'warning', 
        message: `"${scorecard.topCtas[0]}" CTA typically drives more conversions` 
      });
    }

    // Headline check (10 points) - basic checks
    if (newCreative.headline) {
      if (newCreative.headline.length > 10 && newCreative.headline.length < 100) {
        totalScore += 5;
      }
      if (newCreative.headline.includes("!") || newCreative.headline.includes("?")) {
        totalScore += 3;
      }
      if (/\d/.test(newCreative.headline)) {
        totalScore += 2;
        newFeedback.push({ type: 'success', message: 'Headline includes numbers (good for engagement)' });
      }
    }

    setScore(totalScore);
    setFeedback(newFeedback);
  };

  const getScoreVariant = (s: number): 'success' | 'blue' | 'amber' | 'error' => {
    if (s >= 80) return 'success';
    if (s >= 60) return 'blue';
    if (s >= 40) return 'amber';
    return 'error';
  };

  const getScoreColorClass = (s: number) => {
    if (s >= 80) return "text-[hsl(var(--portal-success))]";
    if (s >= 60) return "text-[hsl(var(--portal-accent-blue))]";
    if (s >= 40) return "text-[hsl(var(--portal-warning))]";
    return "text-[hsl(var(--portal-error))]";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Excellent";
    if (s >= 60) return "Good";
    if (s >= 40) return "Fair";
    return "Needs Work";
  };

  if (!scorecard) {
    return (
      <V3Card className="border-dashed">
        <V3CardContent className="py-12 text-center">
          <Target className={cn(iconSizes['2xl'], "text-[hsl(var(--portal-text-muted))] mx-auto mb-4")} />
          <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--portal-text-primary))]">Scorecard Unavailable</h3>
          <p className="text-[hsl(var(--portal-text-muted))]">
            Analyze more creatives to enable the pre-launch scorecard.
          </p>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optimal Formula Card */}
      {optimalFormula && optimalFormula.topic && (
        <V3Card 
          accent="blue" 
          className="bg-gradient-to-br from-[hsl(var(--portal-accent-blue)/0.05)] to-[hsl(var(--portal-accent-blue)/0.1)]"
        >
          <V3CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className={cn(iconSizes.md, "text-[hsl(var(--portal-accent-blue))]")} />
              <V3CardTitle>Optimal Creative Formula</V3CardTitle>
            </div>
            <V3CardDescription>
              Based on your top-performing creatives
            </V3CardDescription>
          </V3CardHeader>
          <V3CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">Topic</p>
                <V3Badge variant="secondary" className="font-medium">
                  {optimalFormula.topic}
                </V3Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">Tone</p>
                <V3Badge variant="secondary" className="font-medium">
                  {optimalFormula.tone || "Any"}
                </V3Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">Emotional Appeal</p>
                <V3Badge variant="secondary" className="font-medium">
                  {optimalFormula.emotionalAppeal || "Any"}
                </V3Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">Expected ROAS</p>
                <div className="flex items-center gap-1">
                  <TrendingUp className={cn(iconSizes.sm, "text-[hsl(var(--portal-success))]")} />
                  <span className="font-semibold text-[hsl(var(--portal-success))]">
                    ${optimalFormula.expectedRoas?.toFixed(2) || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </V3CardContent>
        </V3Card>
      )}

      {/* Scorecard Form */}
      <V3Card>
        <V3CardHeader>
          <V3CardTitle className="flex items-center gap-2">
            <Target className={iconSizes.md} />
            Pre-Launch Scorecard
          </V3CardTitle>
          <V3CardDescription>
            Evaluate your new creative against historical patterns before launching
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[hsl(var(--portal-text-primary))]">Topic/Theme</Label>
              <Select 
                value={newCreative.topic} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, topic: v }))}
              >
                <SelectTrigger className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {scorecard.topTopics.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[hsl(var(--portal-text-primary))]">Tone</Label>
              <Select 
                value={newCreative.tone} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, tone: v }))}
              >
                <SelectTrigger className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {scorecard.topTones.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[hsl(var(--portal-text-primary))]">Emotional Appeal</Label>
              <Select 
                value={newCreative.emotionalAppeal} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, emotionalAppeal: v }))}
              >
                <SelectTrigger className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]">
                  <SelectValue placeholder="Select emotional appeal" />
                </SelectTrigger>
                <SelectContent>
                  {scorecard.topEmotional.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[hsl(var(--portal-text-primary))]">Call to Action</Label>
              <Select 
                value={newCreative.cta} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, cta: v }))}
              >
                <SelectTrigger className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]">
                  <SelectValue placeholder="Select CTA" />
                </SelectTrigger>
                <SelectContent>
                  {scorecard.topCtas.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[hsl(var(--portal-text-primary))]">Headline (optional)</Label>
            <Textarea
              placeholder="Enter your ad headline..."
              value={newCreative.headline}
              onChange={(e) => setNewCreative(prev => ({ ...prev, headline: e.target.value }))}
              rows={2}
              className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
            />
          </div>

          <V3Button onClick={evaluateCreative} className="w-full">
            <Target className={iconSizes.sm} />
            Evaluate Creative
          </V3Button>

          {/* Score Results */}
          {score !== null && (
            <div className="mt-6 p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary)/0.5)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">Creative Score</p>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-4xl font-bold", getScoreColorClass(score))}>
                      {score}
                    </span>
                    <span className="text-lg text-[hsl(var(--portal-text-muted))]">/100</span>
                  </div>
                </div>
                <V3Badge 
                  variant={getScoreVariant(score)} 
                  size="lg"
                >
                  {getScoreLabel(score)}
                </V3Badge>
              </div>

              <div className="space-y-2">
                {feedback.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {f.type === 'success' && <CheckCircle2 className={cn(iconSizes.sm, "text-[hsl(var(--portal-success))] mt-0.5 shrink-0")} />}
                    {f.type === 'warning' && <AlertCircle className={cn(iconSizes.sm, "text-[hsl(var(--portal-warning))] mt-0.5 shrink-0")} />}
                    {f.type === 'error' && <XCircle className={cn(iconSizes.sm, "text-[hsl(var(--portal-error))] mt-0.5 shrink-0")} />}
                    <span className={cn(
                      f.type === 'success' ? 'text-[hsl(var(--portal-success))]' :
                      f.type === 'warning' ? 'text-[hsl(var(--portal-warning))]' :
                      'text-[hsl(var(--portal-error))]'
                    )}>
                      {f.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </V3CardContent>
      </V3Card>
    </div>
  );
}
