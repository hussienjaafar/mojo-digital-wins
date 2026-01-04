import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Target,
  MapPin,
  Users,
  Bell,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  useOrgProfileQuery, 
  useUpdateOrgProfile, 
  useUpdateInterestTopics,
  useUpdateAlertPreferences 
} from "@/queries/useOrgProfileQuery";
import { PortalCard, PortalCardContent } from "@/components/portal/PortalCard";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ============================================================================
// Types & Configuration
// ============================================================================

const ORG_TYPES = [
  { value: "foreign_policy", label: "Foreign Policy Advocacy", description: "Focus on international relations and global issues" },
  { value: "human_rights", label: "Human Rights Organization", description: "Advocacy for civil liberties and human rights" },
  { value: "candidate", label: "Political Candidate/Campaign", description: "Electoral campaigns and candidate support" },
  { value: "labor", label: "Labor Organization", description: "Worker rights and union advocacy" },
  { value: "climate", label: "Climate/Environmental", description: "Environmental protection and climate action" },
  { value: "civil_rights", label: "Civil Rights Organization", description: "Domestic civil rights advocacy" },
  { value: "other", label: "Other", description: "Other type of organization" },
] as const;

const TOPIC_TAXONOMY = [
  { category: "Foreign Policy", topics: ["gaza", "ukraine", "china", "russia", "middle_east", "nato", "foreign_aid", "sanctions"] },
  { category: "Human Rights", topics: ["immigration", "refugee_rights", "police_reform", "voting_rights", "lgbtq_rights", "disability_rights"] },
  { category: "Economic", topics: ["labor_rights", "minimum_wage", "healthcare", "housing", "social_security", "taxes"] },
  { category: "Environment", topics: ["climate_change", "renewable_energy", "conservation", "clean_water", "environmental_justice"] },
  { category: "Social Issues", topics: ["education", "gun_control", "reproductive_rights", "criminal_justice", "drug_policy"] },
];

const GEOGRAPHIES = [
  "United States", "Michigan", "Pennsylvania", "Wisconsin", "Arizona", "Georgia", "Nevada",
  "Gaza", "Ukraine", "Israel", "Russia", "China", "Taiwan", "Middle East", "Europe",
];

const STEPS = [
  { id: "org-type", label: "Organization Type", icon: Building2 },
  { id: "mission", label: "Mission & Goals", icon: Target },
  { id: "topics", label: "Topic Interests", icon: Sparkles },
  { id: "geography", label: "Geographic Focus", icon: MapPin },
  { id: "alerts", label: "Alert Preferences", icon: Bell },
];

interface TopicWeight {
  topic: string;
  weight: number;
}

interface WizardState {
  orgType: string;
  displayName: string;
  missionSummary: string;
  primaryGoals: string[];
  topicWeights: TopicWeight[];
  geographies: string[];
  audiences: string[];
  minRelevanceScore: number;
  maxAlertsPerDay: number;
  digestMode: string;
  notifyChannels: string[];
}

// ============================================================================
// Component
// ============================================================================

export function ProfileSetupWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId } = useClientOrganization();
  const { data: existingProfile, isLoading: profileLoading } = useOrgProfileQuery(organizationId);
  const updateProfile = useUpdateOrgProfile(organizationId);
  const updateTopics = useUpdateInterestTopics(organizationId);
  const updatePreferences = useUpdateAlertPreferences(organizationId);

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [state, setState] = useState<WizardState>({
    orgType: "",
    displayName: "",
    missionSummary: "",
    primaryGoals: [],
    topicWeights: [],
    geographies: [],
    audiences: [],
    minRelevanceScore: 60,
    maxAlertsPerDay: 6,
    digestMode: "realtime",
    notifyChannels: ["in_app"],
  });

  // Initialize from existing profile
  useEffect(() => {
    if (existingProfile?.profile) {
      setState(prev => ({
        ...prev,
        orgType: existingProfile.profile?.org_type || "",
        displayName: existingProfile.profile?.display_name || "",
        missionSummary: existingProfile.profile?.mission_summary || "",
        primaryGoals: existingProfile.profile?.primary_goals || [],
        geographies: existingProfile.profile?.geographies || [],
        audiences: existingProfile.profile?.audiences || [],
      }));
    }
    if (existingProfile?.interestTopics) {
      setState(prev => ({
        ...prev,
        topicWeights: existingProfile.interestTopics.map(t => ({ topic: t.topic, weight: t.weight })),
      }));
    }
    if (existingProfile?.alertPreferences) {
      setState(prev => ({
        ...prev,
        minRelevanceScore: existingProfile.alertPreferences?.min_relevance_score || 60,
        maxAlertsPerDay: existingProfile.alertPreferences?.max_alerts_per_day || 6,
        digestMode: existingProfile.alertPreferences?.digest_mode || "realtime",
        notifyChannels: ["in_app"],
      }));
    }
  }, [existingProfile]);

  const updateState = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key: "geographies" | "audiences" | "primaryGoals" | "notifyChannels", item: string) => {
    setState(prev => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item],
      };
    });
  };

  const updateTopicWeight = (topic: string, weight: number) => {
    setState(prev => {
      const existing = prev.topicWeights.find(t => t.topic === topic);
      if (existing) {
        return {
          ...prev,
          topicWeights: prev.topicWeights.map(t => t.topic === topic ? { ...t, weight } : t),
        };
      }
      return {
        ...prev,
        topicWeights: [...prev.topicWeights, { topic, weight }],
      };
    });
  };

  const getTopicWeight = (topic: string) => {
    return state.topicWeights.find(t => t.topic === topic)?.weight ?? 0;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update profile
      await updateProfile.mutateAsync({
        org_type: state.orgType,
        display_name: state.displayName,
        mission_summary: state.missionSummary,
        primary_goals: state.primaryGoals,
        geographies: state.geographies,
        audiences: state.audiences,
      });

      // Update topics
      await updateTopics.mutateAsync({
        topics: state.topicWeights.filter(t => t.weight > 0),
      });

      // Update preferences
      await updatePreferences.mutateAsync({
        min_relevance_score: state.minRelevanceScore,
        max_alerts_per_day: state.maxAlertsPerDay,
        digest_mode: state.digestMode as 'realtime' | 'hourly_digest' | 'daily_digest',
        notify_channels: state.notifyChannels,
      });

      toast({
        title: "Profile Saved",
        description: "Your organization profile has been updated. Opportunities will now be personalized.",
      });

      navigate("/client/opportunities");
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!state.orgType;
      case 1: return !!state.missionSummary;
      case 2: return state.topicWeights.filter(t => t.weight > 0).length > 0;
      case 3: return true; // Geography is optional
      case 4: return true; // Alert preferences have defaults
      default: return false;
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--portal-accent-blue))]" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => index < currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  isActive && "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]",
                  isCompleted && "text-[hsl(var(--portal-success))] cursor-pointer hover:bg-[hsl(var(--portal-success)/0.1)]",
                  !isActive && !isCompleted && "text-[hsl(var(--portal-text-muted))]"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isActive && "bg-[hsl(var(--portal-accent-blue))] text-white",
                  isCompleted && "bg-[hsl(var(--portal-success))] text-white",
                  !isActive && !isCompleted && "bg-[hsl(var(--portal-bg-tertiary))]"
                )}>
                  {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                </div>
                <span className="hidden md:inline text-sm font-medium">{step.label}</span>
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-2 text-[hsl(var(--portal-text-muted))]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <PortalCard>
        <PortalCardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 0: Organization Type */}
              {currentStep === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
                      What type of organization are you?
                    </h2>
                    <p className="text-[hsl(var(--portal-text-secondary))]">
                      This helps us tailor opportunities and actions to your specific needs.
                    </p>
                  </div>

                  <RadioGroup value={state.orgType} onValueChange={(v) => updateState("orgType", v)}>
                    <div className="grid gap-3">
                      {ORG_TYPES.map((type) => (
                        <label
                          key={type.value}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all",
                            state.orgType === type.value
                              ? "border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.05)]"
                              : "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]"
                          )}
                        >
                          <RadioGroupItem value={type.value} className="mt-1" />
                          <div>
                            <div className="font-medium text-[hsl(var(--portal-text-primary))]">{type.label}</div>
                            <div className="text-sm text-[hsl(var(--portal-text-secondary))]">{type.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Step 1: Mission & Goals */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
                      Tell us about your mission
                    </h2>
                    <p className="text-[hsl(var(--portal-text-secondary))]">
                      A brief description helps personalize your opportunities.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="displayName">Organization Name</Label>
                      <Input
                        id="displayName"
                        value={state.displayName}
                        onChange={(e) => updateState("displayName", e.target.value)}
                        placeholder="Your organization name"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="missionSummary">Mission Summary</Label>
                      <Textarea
                        id="missionSummary"
                        value={state.missionSummary}
                        onChange={(e) => updateState("missionSummary", e.target.value)}
                        placeholder="Describe your organization's mission in 2-3 sentences..."
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Primary Goals (select all that apply)</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {["Fundraising", "Advocacy", "Voter Mobilization", "Member Engagement", "Public Education", "Policy Change"].map((goal) => (
                          <Badge
                            key={goal}
                            variant={state.primaryGoals.includes(goal) ? "default" : "outline"}
                            className={cn(
                              "cursor-pointer transition-colors",
                              state.primaryGoals.includes(goal)
                                ? "bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))]"
                                : "hover:bg-[hsl(var(--portal-bg-tertiary))]"
                            )}
                            onClick={() => toggleArrayItem("primaryGoals", goal)}
                          >
                            {goal}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Topic Interests */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
                      What topics matter most to you?
                    </h2>
                    <p className="text-[hsl(var(--portal-text-secondary))]">
                      Adjust the sliders to indicate importance. Higher values = more relevant opportunities.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {TOPIC_TAXONOMY.map((category) => (
                      <div key={category.category}>
                        <h3 className="font-medium text-[hsl(var(--portal-text-primary))] mb-3">
                          {category.category}
                        </h3>
                        <div className="grid gap-3">
                          {category.topics.map((topic) => (
                            <div key={topic} className="flex items-center gap-4">
                              <span className="w-32 text-sm text-[hsl(var(--portal-text-secondary))] capitalize">
                                {topic.replace(/_/g, " ")}
                              </span>
                              <Slider
                                value={[getTopicWeight(topic) * 100]}
                                onValueChange={([v]) => updateTopicWeight(topic, v / 100)}
                                max={100}
                                step={10}
                                className="flex-1"
                              />
                              <span className="w-12 text-sm text-[hsl(var(--portal-text-muted))] text-right">
                                {Math.round(getTopicWeight(topic) * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Geographic Focus */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
                      Where do you focus your work?
                    </h2>
                    <p className="text-[hsl(var(--portal-text-secondary))]">
                      Select regions that matter to your organization. This helps filter relevant news and opportunities.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {GEOGRAPHIES.map((geo) => (
                      <Badge
                        key={geo}
                        variant={state.geographies.includes(geo) ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer transition-colors",
                          state.geographies.includes(geo)
                            ? "bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))]"
                            : "hover:bg-[hsl(var(--portal-bg-tertiary))]"
                        )}
                        onClick={() => toggleArrayItem("geographies", geo)}
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        {geo}
                      </Badge>
                    ))}
                  </div>

                  <div>
                    <Label>Target Audiences</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["Donors", "Volunteers", "Members", "Voters", "Media", "Policymakers"].map((audience) => (
                        <Badge
                          key={audience}
                          variant={state.audiences.includes(audience) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer transition-colors",
                            state.audiences.includes(audience)
                              ? "bg-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success))]"
                              : "hover:bg-[hsl(var(--portal-bg-tertiary))]"
                          )}
                          onClick={() => toggleArrayItem("audiences", audience)}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {audience}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Alert Preferences */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
                      Configure your alert preferences
                    </h2>
                    <p className="text-[hsl(var(--portal-text-secondary))]">
                      Control how and when you receive opportunities and suggested actions.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <Label>Minimum Relevance Score</Label>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-2">
                        Only show opportunities with at least this relevance score
                      </p>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[state.minRelevanceScore]}
                          onValueChange={([v]) => updateState("minRelevanceScore", v)}
                          min={20}
                          max={90}
                          step={5}
                          className="flex-1"
                        />
                        <span className="w-16 text-lg font-semibold text-[hsl(var(--portal-accent-blue))]">
                          {state.minRelevanceScore}%
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label>Maximum Alerts Per Day</Label>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-2">
                        Limit how many new alerts you see daily to avoid fatigue
                      </p>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[state.maxAlertsPerDay]}
                          onValueChange={([v]) => updateState("maxAlertsPerDay", v)}
                          min={1}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <span className="w-16 text-lg font-semibold text-[hsl(var(--portal-accent-blue))]">
                          {state.maxAlertsPerDay}
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label>Delivery Mode</Label>
                      <Select value={state.digestMode} onValueChange={(v) => updateState("digestMode", v)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Real-time (as they happen)</SelectItem>
                          <SelectItem value="hourly_digest">Hourly Digest</SelectItem>
                          <SelectItem value="daily_digest">Daily Digest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Notification Channels</Label>
                      <div className="flex flex-wrap gap-4 mt-2">
                        {[
                          { value: "in_app", label: "In-App" },
                          { value: "email", label: "Email" },
                          { value: "sms", label: "SMS" },
                        ].map((channel) => (
                          <label key={channel.value} className="flex items-center gap-2 cursor-pointer">
                            <Switch
                              checked={state.notifyChannels.includes(channel.value)}
                              onCheckedChange={() => toggleArrayItem("notifyChannels", channel.value)}
                            />
                            <span className="text-sm">{channel.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-[hsl(var(--portal-border))]">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={!canProceed()}
                className="gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))]"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 bg-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success))]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Profile
                  </>
                )}
              </Button>
            )}
          </div>
        </PortalCardContent>
      </PortalCard>
    </div>
  );
}
