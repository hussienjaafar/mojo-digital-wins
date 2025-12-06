import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, AlertCircle, Target, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-blue-500";
    if (s >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Excellent";
    if (s >= 60) return "Good";
    if (s >= 40) return "Fair";
    return "Needs Work";
  };

  if (!scorecard) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Scorecard Unavailable</h3>
          <p className="text-muted-foreground">
            Analyze more creatives to enable the pre-launch scorecard.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Optimal Formula Card */}
      {optimalFormula && optimalFormula.topic && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Optimal Creative Formula</CardTitle>
            </div>
            <CardDescription>
              Based on your top-performing creatives
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Topic</p>
                <Badge variant="secondary" className="font-medium">
                  {optimalFormula.topic}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tone</p>
                <Badge variant="secondary" className="font-medium">
                  {optimalFormula.tone || "Any"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Emotional Appeal</p>
                <Badge variant="secondary" className="font-medium">
                  {optimalFormula.emotionalAppeal || "Any"}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Expected ROAS</p>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="font-semibold text-green-600">
                    ${optimalFormula.expectedRoas?.toFixed(2) || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scorecard Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Pre-Launch Scorecard
          </CardTitle>
          <CardDescription>
            Evaluate your new creative against historical patterns before launching
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Topic/Theme</Label>
              <Select 
                value={newCreative.topic} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, topic: v }))}
              >
                <SelectTrigger>
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
              <Label>Tone</Label>
              <Select 
                value={newCreative.tone} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, tone: v }))}
              >
                <SelectTrigger>
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
              <Label>Emotional Appeal</Label>
              <Select 
                value={newCreative.emotionalAppeal} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, emotionalAppeal: v }))}
              >
                <SelectTrigger>
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
              <Label>Call to Action</Label>
              <Select 
                value={newCreative.cta} 
                onValueChange={(v) => setNewCreative(prev => ({ ...prev, cta: v }))}
              >
                <SelectTrigger>
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
            <Label>Headline (optional)</Label>
            <Textarea
              placeholder="Enter your ad headline..."
              value={newCreative.headline}
              onChange={(e) => setNewCreative(prev => ({ ...prev, headline: e.target.value }))}
              rows={2}
            />
          </div>

          <Button onClick={evaluateCreative} className="w-full">
            <Target className="h-4 w-4 mr-2" />
            Evaluate Creative
          </Button>

          {/* Score Results */}
          {score !== null && (
            <div className="mt-6 p-4 rounded-lg bg-muted/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Creative Score</p>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-4xl font-bold", getScoreColor(score))}>
                      {score}
                    </span>
                    <span className="text-lg text-muted-foreground">/100</span>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-lg py-1 px-3",
                    score >= 80 ? "border-green-500 text-green-600" :
                    score >= 60 ? "border-blue-500 text-blue-600" :
                    score >= 40 ? "border-yellow-500 text-yellow-600" :
                    "border-red-500 text-red-600"
                  )}
                >
                  {getScoreLabel(score)}
                </Badge>
              </div>

              <div className="space-y-2">
                {feedback.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {f.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />}
                    {f.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />}
                    {f.type === 'error' && <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
                    <span className={cn(
                      f.type === 'success' ? 'text-green-700 dark:text-green-400' :
                      f.type === 'warning' ? 'text-yellow-700 dark:text-yellow-400' :
                      'text-red-700 dark:text-red-400'
                    )}>
                      {f.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
