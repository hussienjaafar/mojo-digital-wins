import React from "react";
import { motion } from "framer-motion";
import { 
  Heart, Users, Vote, DollarSign, Star, FileText, 
  Globe, Leaf, Scale, GraduationCap, Shield, Megaphone,
  Send, Target, Calendar, Zap, AlertTriangle, CheckCircle,
  Clock, ArrowUpRight, Sparkles
} from "lucide-react";
import { V3Badge } from "@/components/v3/V3Badge";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";
import { cn } from "@/lib/utils";

export interface SMSCampaignData {
  campaign_id: string;
  campaign_name: string;
  topic?: string | null;
  topic_summary?: string | null;
  tone?: string | null;
  urgency_level?: string | null;
  call_to_action?: string | null;
  key_themes?: string[] | null;
  sent: number;
  raised: number;
  donations: number;
  last_donation?: string | null;
  send_date?: string | null;
}

interface SMSCampaignCardProps {
  campaign: SMSCampaignData;
  index?: number;
}

// Topic configuration with icons and colors
const topicConfig: Record<string, { icon: React.ElementType; colorClass: string; bgClass: string }> = {
  "Healthcare": { icon: Heart, colorClass: "text-rose-500", bgClass: "bg-rose-500/10" },
  "Immigration": { icon: Users, colorClass: "text-blue-500", bgClass: "bg-blue-500/10" },
  "Elections": { icon: Vote, colorClass: "text-purple-500", bgClass: "bg-purple-500/10" },
  "Endorsement": { icon: Star, colorClass: "text-amber-500", bgClass: "bg-amber-500/10" },
  "Fundraising": { icon: DollarSign, colorClass: "text-emerald-500", bgClass: "bg-emerald-500/10" },
  "Policy": { icon: FileText, colorClass: "text-slate-500", bgClass: "bg-slate-500/10" },
  "Economy": { icon: DollarSign, colorClass: "text-green-500", bgClass: "bg-green-500/10" },
  "Environment": { icon: Leaf, colorClass: "text-teal-500", bgClass: "bg-teal-500/10" },
  "Civil Rights": { icon: Scale, colorClass: "text-indigo-500", bgClass: "bg-indigo-500/10" },
  "Foreign Policy": { icon: Globe, colorClass: "text-cyan-500", bgClass: "bg-cyan-500/10" },
  "Education": { icon: GraduationCap, colorClass: "text-orange-500", bgClass: "bg-orange-500/10" },
  "Gun Rights": { icon: Shield, colorClass: "text-red-500", bgClass: "bg-red-500/10" },
  "Veterans": { icon: Shield, colorClass: "text-navy-500", bgClass: "bg-blue-900/10" },
  "Other": { icon: Megaphone, colorClass: "text-gray-500", bgClass: "bg-gray-500/10" },
};

// Urgency level configuration
const urgencyConfig: Record<string, { variant: "info" | "warning" | "error" | "success"; icon: React.ElementType }> = {
  "low": { variant: "success", icon: CheckCircle },
  "medium": { variant: "info", icon: Clock },
  "high": { variant: "warning", icon: Zap },
  "critical": { variant: "error", icon: AlertTriangle },
};

// CTA type configuration
const ctaConfig: Record<string, { label: string; colorClass: string }> = {
  "donate": { label: "Donate", colorClass: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
  "volunteer": { label: "Volunteer", colorClass: "bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  "sign petition": { label: "Sign Petition", colorClass: "bg-purple-500/20 text-purple-700 dark:text-purple-300" },
  "vote": { label: "Vote", colorClass: "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" },
  "share": { label: "Share", colorClass: "bg-pink-500/20 text-pink-700 dark:text-pink-300" },
  "attend event": { label: "Attend Event", colorClass: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  "contact representative": { label: "Contact Rep", colorClass: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" },
  "other": { label: "Action", colorClass: "bg-gray-500/20 text-gray-700 dark:text-gray-300" },
};

export function SMSCampaignCard({ campaign, index = 0 }: SMSCampaignCardProps) {
  const topic = campaign.topic || "Other";
  const topicInfo = topicConfig[topic] || topicConfig["Other"];
  const TopicIcon = topicInfo.icon;
  
  const urgency = (campaign.urgency_level || "medium").toLowerCase();
  const urgencyInfo = urgencyConfig[urgency] || urgencyConfig["medium"];
  
  const cta = (campaign.call_to_action || "other").toLowerCase();
  const ctaInfo = ctaConfig[cta] || ctaConfig["other"];

  // Calculate ROI if we have both raised and a reasonable estimate of cost
  const estimatedCostPerMessage = 0.015; // ~1.5 cents per SMS
  const estimatedCost = campaign.sent * estimatedCostPerMessage;
  const roi = estimatedCost > 0 ? campaign.raised / estimatedCost : 0;

  // Format send date
  const formattedDate = campaign.send_date 
    ? new Date(campaign.send_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const hasAnalysis = campaign.topic_summary || campaign.topic;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className={cn(
        "group relative rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm",
        "hover:border-border hover:bg-card/80 transition-all duration-200",
        "overflow-hidden"
      )}
    >
      {/* Topic accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", topicInfo.bgClass.replace('/10', ''))} />
      
      <div className="p-4 pt-5">
        {/* Header Row: Topic badge + Campaign name + Date */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn("p-2 rounded-lg shrink-0", topicInfo.bgClass)}>
            <TopicIcon className={cn("w-4 h-4", topicInfo.colorClass)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", topicInfo.bgClass, topicInfo.colorClass)}>
                {topic}
              </span>
              {formattedDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </span>
              )}
            </div>
            <h4 className="text-sm font-medium text-foreground mt-1 truncate" title={campaign.campaign_name}>
              {campaign.campaign_name}
            </h4>
          </div>
        </div>

        {/* AI Summary */}
        {hasAnalysis ? (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {campaign.topic_summary || `${topic} campaign targeting supporters.`}
            </p>
            
            {/* Tags Row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {campaign.urgency_level && (
                <V3Badge variant={urgencyInfo.variant} size="sm">
                  {campaign.urgency_level.charAt(0).toUpperCase() + campaign.urgency_level.slice(1)}
                </V3Badge>
              )}
              {campaign.call_to_action && (
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ctaInfo.colorClass)}>
                  {ctaInfo.label} CTA
                </span>
              )}
              {campaign.key_themes?.slice(0, 2).map((theme, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>Analyzing campaign content...</span>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-4 gap-3 pt-3 border-t border-border/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Send className="w-3 h-3" />
            </div>
            <p className="text-sm font-semibold text-foreground">{formatNumber(campaign.sent)}</p>
            <p className="text-[10px] text-muted-foreground">Sent</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" />
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(campaign.raised)}
            </p>
            <p className="text-[10px] text-muted-foreground">Raised</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Target className="w-3 h-3" />
            </div>
            <p className="text-sm font-semibold text-foreground">{formatNumber(campaign.donations)}</p>
            <p className="text-[10px] text-muted-foreground">Donations</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <ArrowUpRight className="w-3 h-3" />
            </div>
            <p className={cn(
              "text-sm font-semibold",
              roi >= 2 ? "text-emerald-600 dark:text-emerald-400" : 
              roi >= 1 ? "text-amber-600 dark:text-amber-400" : 
              "text-muted-foreground"
            )}>
              {roi > 0 ? `${roi.toFixed(1)}x` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">ROI</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default SMSCampaignCard;
