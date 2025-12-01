import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Bell,
  Database,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [entityName, setEntityName] = useState("");
  const [alertPreferences, setAlertPreferences] = useState({
    critical: true,
    high: true,
    medium: false,
    low: false,
  });
  const { toast } = useToast();

  const totalSteps = 5;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    await markOnboardingComplete();
    onComplete();
  };

  const markOnboardingComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }
  };

  const handleComplete = async () => {
    await markOnboardingComplete();
    toast({
      title: "Welcome aboard!",
      description: "Your account is set up and ready to go.",
    });
    onComplete();
  };

  const addEntityToWatchlist = async () => {
    if (!entityName.trim()) {
      handleNext();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: clientUser } = await supabase
      .from("client_users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (clientUser) {
      await supabase.from("entity_watchlist").insert({
        entity_name: entityName,
        entity_type: "person",
        organization_id: clientUser.organization_id,
        is_active: true,
      });

      toast({
        title: "Entity added",
        description: `${entityName} has been added to your watchlist.`,
      });
    }

    handleNext();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Welcome to Your Intelligence Hub</h2>
              <p className="text-muted-foreground">
                Track political trends, monitor key entities, and discover fundraising
                opportunities—all in one place.
              </p>
            </div>
            <div className="grid gap-4 pt-4">
              <div className="flex gap-3 items-start">
                <TrendingUp className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium">Real-time Intelligence</p>
                  <p className="text-sm text-muted-foreground">
                    Monitor news, social media trends, and polling data
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Bell className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <p className="font-medium">Smart Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified about critical developments affecting your campaigns
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <Database className="h-5 w-5 text-info mt-0.5" />
                <div>
                  <p className="font-medium">Unified Analytics</p>
                  <p className="text-sm text-muted-foreground">
                    Track donations, ad performance, and donor demographics
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Add Your First Entity</h2>
              <p className="text-muted-foreground">
                Track mentions of politicians, organizations, or policies in news and social media.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entity">Entity Name (Optional)</Label>
                <Input
                  id="entity"
                  placeholder="e.g., Senator Name, Organization, Policy Name"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  You can add more entities later from the Entity Watchlist page.
                </p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Configure Alert Preferences</h2>
              <p className="text-muted-foreground">
                Choose which severity levels you want to receive notifications for.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="critical"
                  checked={alertPreferences.critical}
                  onCheckedChange={(checked) =>
                    setAlertPreferences({ ...alertPreferences, critical: !!checked })
                  }
                />
                <Label htmlFor="critical" className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-severity-critical" />
                  Critical Alerts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="high"
                  checked={alertPreferences.high}
                  onCheckedChange={(checked) =>
                    setAlertPreferences({ ...alertPreferences, high: !!checked })
                  }
                />
                <Label htmlFor="high" className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-severity-high" />
                  High Priority Alerts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="medium"
                  checked={alertPreferences.medium}
                  onCheckedChange={(checked) =>
                    setAlertPreferences({ ...alertPreferences, medium: !!checked })
                  }
                />
                <Label htmlFor="medium" className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-severity-medium" />
                  Medium Priority Alerts
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="low"
                  checked={alertPreferences.low}
                  onCheckedChange={(checked) =>
                    setAlertPreferences({ ...alertPreferences, low: !!checked })
                  }
                />
                <Label htmlFor="low" className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-severity-low" />
                  Low Priority Alerts
                </Label>
              </div>
              <p className="text-sm text-muted-foreground pt-2">
                You can customize these preferences anytime from your profile settings.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Connect Data Sources</h2>
              <p className="text-muted-foreground">
                Link your platforms to get unified analytics and donor insights.
              </p>
            </div>
            <div className="space-y-4">
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">ActBlue</p>
                    <p className="text-sm text-muted-foreground">
                      Track donations and donor demographics
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Meta Ads</p>
                    <p className="text-sm text-muted-foreground">
                      Monitor ad performance and attribution
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Switchboard SMS</p>
                    <p className="text-sm text-muted-foreground">
                      Track SMS campaigns and conversions
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground pt-2">
                Don't worry—you can set these up later from your profile settings.
              </p>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">You're All Set!</h2>
              <p className="text-muted-foreground">
                Here's a quick overview of your intelligence hub features:
              </p>
            </div>
            <div className="space-y-3">
              <div className="border rounded-lg p-3">
                <p className="font-medium">📰 News Feed</p>
                <p className="text-sm text-muted-foreground">
                  Real-time political news with AI sentiment analysis
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="font-medium">🔵 Bluesky Trends</p>
                <p className="text-sm text-muted-foreground">
                  Track trending topics and social media conversations
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="font-medium">📊 Polling Intelligence</p>
                <p className="text-sm text-muted-foreground">
                  Monitor polling data and public opinion trends
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="font-medium">👁️ Entity Watchlist</p>
                <p className="text-sm text-muted-foreground">
                  Track key politicians, organizations, and policies
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="font-medium">💡 Smart Actions</p>
                <p className="text-sm text-muted-foreground">
                  AI-generated suggestions for fundraising opportunities
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              Step {step} of {totalSteps}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </DialogHeader>

        <div className="py-6">{renderStep()}</div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={handleSkip}>
            Skip Tour
          </Button>
          <Button
            onClick={step === 2 ? addEntityToWatchlist : handleNext}
            className="gap-2"
          >
            {step === totalSteps ? (
              "Get Started"
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
