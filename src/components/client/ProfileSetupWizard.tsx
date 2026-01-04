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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useClientOrganization } from "@/hooks/useClientOrganization";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// V3 Design System Components
import {
  V3Card,
  V3CardHeader,
  V3CardTitle,
  V3CardDescription,
  V3CardContent,
  V3CardFooter,
} from "@/components/v3/V3Card";
import { V3Button } from "@/components/v3/V3Button";
import { V3Badge } from "@/components/v3/V3Badge";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import { V3SectionHeader } from "@/components/v3/V3SectionHeader";

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
  { id: "org-type", label: "Organization", icon: Building2 },
  { id: "mission", label: "Mission", icon: Target },
  { id: "topics", label: "Topics", icon: Sparkles },
  { id: "geography", label: "Geography", icon: MapPin },
  { id: "alerts", label: "Alerts", icon: Bell },
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
// Step Progress Component (V3 Styled)
// ============================================================================

interface StepProgressProps {
  steps: typeof STEPS;
  currentStep: number;
  onStepClick: (index: number) => void;
}

function StepProgress({ steps, currentStep, onStepClick }: StepProgressProps) {
  return (
    <div className="flex items-center justify-between mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-2 px-2">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={step.id} className="flex items-center flex-shrink-0">
            <button
              onClick={() => index < currentStep && onStepClick(index)}
              disabled={index > currentStep}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200",
                isActive && "bg-[hsl(var(--portal-accent-blue)/0.1)]",
                isCompleted && "cursor-pointer hover:bg-[hsl(var(--portal-success)/0.08)]",
                !isActive && !isCompleted && "opacity-50"
              )}
              aria-current={isActive ? "step" : undefined}
            >
              <div className={cn(
                "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-200",
                isActive && "bg-[hsl(var(--portal-accent-blue))] text-white shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.4)]",
                isCompleted && "bg-[hsl(var(--portal-success))] text-white",
                !isActive && !isCompleted && "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]"
              )}>
                {isCompleted ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <StepIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </div>
              <span className={cn(
                "hidden sm:inline text-xs sm:text-sm font-medium transition-colors",
                isActive && "text-[hsl(var(--portal-accent-blue))]",
                isCompleted && "text-[hsl(var(--portal-success))]",
                !isActive && !isCompleted && "text-[hsl(var(--portal-text-muted))]"
              )}>
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <ChevronRight className={cn(
                "h-4 w-4 mx-1 sm:mx-2 flex-shrink-0",
                index < currentStep ? "text-[hsl(var(--portal-success))]" : "text-[hsl(var(--portal-text-muted))]"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Selectable Chip Component (V3 Styled)
// ============================================================================

interface SelectableChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: "blue" | "green" | "purple";
}

function SelectableChip({ label, selected, onClick, icon, variant = "blue" }: SelectableChipProps) {
  const variantStyles = {
    blue: selected 
      ? "bg-[hsl(var(--portal-accent-blue))] text-white border-[hsl(var(--portal-accent-blue))]" 
      : "hover:border-[hsl(var(--portal-accent-blue)/0.5)] hover:bg-[hsl(var(--portal-accent-blue)/0.05)]",
    green: selected 
      ? "bg-[hsl(var(--portal-success))] text-white border-[hsl(var(--portal-success))]" 
      : "hover:border-[hsl(var(--portal-success)/0.5)] hover:bg-[hsl(var(--portal-success)/0.05)]",
    purple: selected 
      ? "bg-[hsl(var(--portal-accent-purple))] text-white border-[hsl(var(--portal-accent-purple))]" 
      : "hover:border-[hsl(var(--portal-accent-purple)/0.5)] hover:bg-[hsl(var(--portal-accent-purple)/0.05)]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium",
        "border transition-all duration-200 cursor-pointer select-none",
        selected ? variantStyles[variant] : [
          "bg-transparent border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]",
          variantStyles[variant]
        ]
      )}
      aria-pressed={selected}
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================================================
// Topic Slider Component (V3 Styled)
// ============================================================================

interface TopicSliderProps {
  topic: string;
  weight: number;
  onChange: (weight: number) => void;
}

function TopicSlider({ topic, weight, onChange }: TopicSliderProps) {
  const displayWeight = Math.round(weight * 100);
  const isActive = weight > 0;

  return (
    <div className={cn(
      "flex items-center gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg transition-all duration-200",
      isActive && "bg-[hsl(var(--portal-accent-blue)/0.05)] border border-[hsl(var(--portal-accent-blue)/0.2)]",
      !isActive && "bg-[hsl(var(--portal-bg-elevated))/0.5]"
    )}>
      <span className={cn(
        "w-24 sm:w-32 text-xs sm:text-sm capitalize truncate",
        isActive ? "text-[hsl(var(--portal-text-primary))] font-medium" : "text-[hsl(var(--portal-text-secondary))]"
      )}>
        {topic.replace(/_/g, " ")}
      </span>
      <Slider
        value={[displayWeight]}
        onValueChange={([v]) => onChange(v / 100)}
        max={100}
        step={10}
        className="flex-1"
      />
      <span className={cn(
        "w-10 sm:w-12 text-xs sm:text-sm text-right font-mono",
        isActive ? "text-[hsl(var(--portal-accent-blue))] font-semibold" : "text-[hsl(var(--portal-text-muted))]"
      )}>
        {displayWeight}%
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
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
      await updateProfile.mutateAsync({
        org_type: state.orgType,
        display_name: state.displayName,
        mission_summary: state.missionSummary,
        primary_goals: state.primaryGoals,
        geographies: state.geographies,
        audiences: state.audiences,
      });

      await updateTopics.mutateAsync({
        topics: state.topicWeights.filter(t => t.weight > 0),
      });

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
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  if (profileLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4">
        <V3LoadingState variant="card" height={400} />
      </div>
    );
  }

  const activeTopicsCount = state.topicWeights.filter(t => t.weight > 0).length;

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4">
      {/* Step Progress */}
      <StepProgress 
        steps={STEPS} 
        currentStep={currentStep} 
        onStepClick={setCurrentStep} 
      />

      {/* Step Content */}
      <V3Card>
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
              <>
                <V3CardHeader>
                  <V3CardTitle as="h2">What type of organization are you?</V3CardTitle>
                  <V3CardDescription>
                    This helps us tailor opportunities and actions to your specific needs.
                  </V3CardDescription>
                </V3CardHeader>
                <V3CardContent>
                  <RadioGroup value={state.orgType} onValueChange={(v) => updateState("orgType", v)}>
                    <div className="grid gap-2 sm:gap-3">
                      {ORG_TYPES.map((type) => (
                        <label
                          key={type.value}
                          className={cn(
                            "flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border cursor-pointer transition-all duration-200",
                            state.orgType === type.value
                              ? "border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.05)] shadow-[0_0_0_1px_hsl(var(--portal-accent-blue)/0.2)]"
                              : "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))] hover:bg-[hsl(var(--portal-bg-hover))]"
                          )}
                        >
                          <RadioGroupItem value={type.value} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm sm:text-base text-[hsl(var(--portal-text-primary))]">
                              {type.label}
                            </div>
                            <div className="text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mt-0.5">
                              {type.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </V3CardContent>
              </>
            )}

            {/* Step 1: Mission & Goals */}
            {currentStep === 1 && (
              <>
                <V3CardHeader>
                  <V3CardTitle as="h2">Tell us about your mission</V3CardTitle>
                  <V3CardDescription>
                    A brief description helps personalize your opportunities.
                  </V3CardDescription>
                </V3CardHeader>
                <V3CardContent className="space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Organization Name
                    </Label>
                    <Input
                      id="displayName"
                      value={state.displayName}
                      onChange={(e) => updateState("displayName", e.target.value)}
                      placeholder="Your organization name"
                      className="h-10 sm:h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="missionSummary" className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Mission Summary
                    </Label>
                    <Textarea
                      id="missionSummary"
                      value={state.missionSummary}
                      onChange={(e) => updateState("missionSummary", e.target.value)}
                      placeholder="Describe your organization's mission in 2-3 sentences..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Primary Goals
                    </Label>
                    <p className="text-xs text-[hsl(var(--portal-text-muted))]">Select all that apply</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["Fundraising", "Advocacy", "Voter Mobilization", "Member Engagement", "Public Education", "Policy Change"].map((goal) => (
                        <SelectableChip
                          key={goal}
                          label={goal}
                          selected={state.primaryGoals.includes(goal)}
                          onClick={() => toggleArrayItem("primaryGoals", goal)}
                          variant="purple"
                        />
                      ))}
                    </div>
                  </div>
                </V3CardContent>
              </>
            )}

            {/* Step 2: Topic Interests */}
            {currentStep === 2 && (
              <>
                <V3CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <V3CardTitle as="h2">What topics matter most to you?</V3CardTitle>
                      <V3CardDescription>
                        Adjust sliders to indicate importance. Higher = more relevant opportunities.
                      </V3CardDescription>
                    </div>
                    {activeTopicsCount > 0 && (
                      <V3Badge variant="blue" size="sm">
                        {activeTopicsCount} active
                      </V3Badge>
                    )}
                  </div>
                </V3CardHeader>
                <V3CardContent className="space-y-6">
                  {TOPIC_TAXONOMY.map((category) => (
                    <div key={category.category}>
                      <V3SectionHeader 
                        title={category.category} 
                        size="sm"
                        className="mb-3"
                      />
                      <div className="space-y-1.5 sm:space-y-2">
                        {category.topics.map((topic) => (
                          <TopicSlider
                            key={topic}
                            topic={topic}
                            weight={getTopicWeight(topic)}
                            onChange={(w) => updateTopicWeight(topic, w)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </V3CardContent>
              </>
            )}

            {/* Step 3: Geographic Focus */}
            {currentStep === 3 && (
              <>
                <V3CardHeader>
                  <V3CardTitle as="h2">Where do you focus your work?</V3CardTitle>
                  <V3CardDescription>
                    Select regions that matter to your organization. This helps filter relevant news.
                  </V3CardDescription>
                </V3CardHeader>
                <V3CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Geographic Focus
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {GEOGRAPHIES.map((geo) => (
                        <SelectableChip
                          key={geo}
                          label={geo}
                          selected={state.geographies.includes(geo)}
                          onClick={() => toggleArrayItem("geographies", geo)}
                          icon={<MapPin className="h-3 w-3" />}
                          variant="blue"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Target Audiences
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {["Donors", "Volunteers", "Members", "Voters", "Media", "Policymakers"].map((audience) => (
                        <SelectableChip
                          key={audience}
                          label={audience}
                          selected={state.audiences.includes(audience)}
                          onClick={() => toggleArrayItem("audiences", audience)}
                          icon={<Users className="h-3 w-3" />}
                          variant="green"
                        />
                      ))}
                    </div>
                  </div>
                </V3CardContent>
              </>
            )}

            {/* Step 4: Alert Preferences */}
            {currentStep === 4 && (
              <>
                <V3CardHeader>
                  <V3CardTitle as="h2">Configure your alert preferences</V3CardTitle>
                  <V3CardDescription>
                    Control how and when you receive opportunities and suggested actions.
                  </V3CardDescription>
                </V3CardHeader>
                <V3CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                          Minimum Relevance Score
                        </Label>
                        <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                          Only show opportunities with at least this relevance
                        </p>
                      </div>
                      <span className="text-lg font-bold text-[hsl(var(--portal-accent-blue))] tabular-nums">
                        {state.minRelevanceScore}%
                      </span>
                    </div>
                    <Slider
                      value={[state.minRelevanceScore]}
                      onValueChange={([v]) => updateState("minRelevanceScore", v)}
                      min={20}
                      max={90}
                      step={5}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                          Maximum Alerts Per Day
                        </Label>
                        <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                          Limit daily alerts to avoid fatigue
                        </p>
                      </div>
                      <span className="text-lg font-bold text-[hsl(var(--portal-accent-blue))] tabular-nums">
                        {state.maxAlertsPerDay}
                      </span>
                    </div>
                    <Slider
                      value={[state.maxAlertsPerDay]}
                      onValueChange={([v]) => updateState("maxAlertsPerDay", v)}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Delivery Mode
                    </Label>
                    <Select value={state.digestMode} onValueChange={(v) => updateState("digestMode", v)}>
                      <SelectTrigger className="h-10 sm:h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time (as they happen)</SelectItem>
                        <SelectItem value="hourly_digest">Hourly Digest</SelectItem>
                        <SelectItem value="daily_digest">Daily Digest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Notification Channels
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: "in_app", label: "In-App" },
                        { value: "email", label: "Email" },
                        { value: "sms", label: "SMS" },
                      ].map((channel) => (
                        <label 
                          key={channel.value} 
                          className={cn(
                            "flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200",
                            state.notifyChannels.includes(channel.value)
                              ? "border-[hsl(var(--portal-accent-blue)/0.5)] bg-[hsl(var(--portal-accent-blue)/0.05)]"
                              : "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]"
                          )}
                        >
                          <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                            {channel.label}
                          </span>
                          <Switch
                            checked={state.notifyChannels.includes(channel.value)}
                            onCheckedChange={() => toggleArrayItem("notifyChannels", channel.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </V3CardContent>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Footer */}
        <V3CardFooter className="flex items-center justify-between pt-6 border-t border-[hsl(var(--portal-border))]">
          <V3Button
            variant="ghost"
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={currentStep === 0}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Back
          </V3Button>

          {currentStep < STEPS.length - 1 ? (
            <V3Button
              variant="primary"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Continue
            </V3Button>
          ) : (
            <V3Button
              variant="success"
              onClick={handleSave}
              isLoading={saving}
              loadingText="Saving..."
              leftIcon={!saving ? <Check className="h-4 w-4" /> : undefined}
            >
              Save Profile
            </V3Button>
          )}
        </V3CardFooter>
      </V3Card>
    </div>
  );
}
