import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  Target, 
  Heart, 
  Flame, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  MessageSquare
} from "lucide-react";
import { V3Card, V3CardContent, V3Badge } from "@/components/v3";

interface Correlation {
  id: string;
  correlation_type: string;
  attribute_name: string;
  attribute_value: string;
  lift_percentage: number;
  sample_size: number;
  confidence_level: number;
  insight_text: string;
  recommended_action: string | null;
  is_actionable: boolean;
}

interface MotivationInsightsProps {
  correlations: Correlation[];
  className?: string;
}

interface InsightCategory {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const INSIGHT_CATEGORIES: InsightCategory[] = [
  { 
    type: 'pain_point_roas', 
    label: 'Pain Points', 
    icon: AlertTriangle, 
    color: 'text-[hsl(var(--portal-error))]',
    bgColor: 'bg-[hsl(var(--portal-error)/0.15)]'
  },
  { 
    type: 'values_roas', 
    label: 'Values', 
    icon: Heart, 
    color: 'text-[hsl(var(--portal-accent-pink))]',
    bgColor: 'bg-[hsl(var(--portal-accent-pink)/0.15)]'
  },
  { 
    type: 'emotional_trigger_roas', 
    label: 'Emotions', 
    icon: Flame, 
    color: 'text-[hsl(var(--portal-warning))]',
    bgColor: 'bg-[hsl(var(--portal-warning)/0.15)]'
  },
  { 
    type: 'urgency_driver_roas', 
    label: 'Urgency', 
    icon: Zap, 
    color: 'text-[hsl(var(--portal-accent-purple))]',
    bgColor: 'bg-[hsl(var(--portal-accent-purple)/0.15)]'
  },
  { 
    type: 'issue_specifics_roas', 
    label: 'Issues', 
    icon: MessageSquare, 
    color: 'text-[hsl(var(--portal-accent-blue))]',
    bgColor: 'bg-[hsl(var(--portal-accent-blue)/0.15)]'
  },
];

function InsightItem({ 
  correlation, 
  category 
}: { 
  correlation: Correlation; 
  category: InsightCategory;
}) {
  const isPositive = correlation.lift_percentage > 0;
  const Icon = category.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        "bg-[hsl(var(--portal-bg-secondary))]",
        "border border-transparent hover:border-[hsl(var(--portal-border))]",
        "transition-all duration-200"
      )}
    >
      <div className={cn("p-1.5 rounded-md shrink-0", category.bgColor)}>
        <Icon className={cn("h-3.5 w-3.5", category.color)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
            {correlation.attribute_value}
          </span>
          <V3Badge 
            variant={isPositive ? "success" : "error"} 
            className="shrink-0"
          >
            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {isPositive ? '+' : ''}{correlation.lift_percentage.toFixed(0)}%
          </V3Badge>
        </div>
        
        <p className="text-xs text-[hsl(var(--portal-text-muted))] line-clamp-2">
          {correlation.recommended_action || correlation.insight_text}
        </p>
        
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">
            n={correlation.sample_size}
          </span>
          <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">
            {correlation.confidence_level.toFixed(0)}% conf
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function CategorySection({ 
  category, 
  correlations 
}: { 
  category: InsightCategory; 
  correlations: Correlation[];
}) {
  const Icon = category.icon;
  
  // Sort by absolute lift percentage (most impactful first)
  const sorted = [...correlations].sort((a, b) => 
    Math.abs(b.lift_percentage) - Math.abs(a.lift_percentage)
  ).slice(0, 5);

  if (sorted.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className={cn("p-1 rounded", category.bgColor)}>
          <Icon className={cn("h-3 w-3", category.color)} />
        </div>
        <span className="text-xs font-medium text-[hsl(var(--portal-text-secondary))]">
          {category.label}
        </span>
        <span className="text-[10px] text-[hsl(var(--portal-text-muted))]">
          ({correlations.length})
        </span>
      </div>
      
      <div className="space-y-1.5">
        {sorted.map((corr, idx) => (
          <InsightItem 
            key={corr.id || `${corr.attribute_value}-${idx}`} 
            correlation={corr} 
            category={category} 
          />
        ))}
      </div>
    </div>
  );
}

export function MotivationInsights({ correlations, className }: MotivationInsightsProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, Correlation[]> = {};
    
    for (const corr of correlations) {
      const type = corr.correlation_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(corr);
    }
    
    return groups;
  }, [correlations]);

  // Only show motivation-related categories
  const motivationCategories = INSIGHT_CATEGORIES.filter(cat => 
    grouped[cat.type] && grouped[cat.type].length > 0
  );

  // Also show combo correlations
  const combos = [
    ...(grouped['topic_tone_combo'] || []),
    ...(grouped['motivation_combo'] || []),
  ].sort((a, b) => Math.abs(b.lift_percentage) - Math.abs(a.lift_percentage)).slice(0, 5);

  if (motivationCategories.length === 0 && combos.length === 0) {
    return (
      <V3Card className={cn("border-dashed", className)}>
        <V3CardContent className="py-8 text-center">
          <Target className="h-8 w-8 text-[hsl(var(--portal-text-muted))] mx-auto mb-3" />
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">
            No motivation insights yet
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
            Run the intelligence engine to extract donor psychology data
          </p>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card className={cn("", className)}>
      <V3CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[hsl(var(--portal-accent-pink))] to-[hsl(var(--portal-accent-purple))]">
              <Target className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">
                What Motivates Donors
              </h3>
              <p className="text-[10px] text-[hsl(var(--portal-text-muted))]">
                Specific pain points, values, and emotions driving donations
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {motivationCategories.map(category => (
            <CategorySection 
              key={category.type}
              category={category}
              correlations={grouped[category.type]}
            />
          ))}
        </div>

        {combos.length > 0 && (
          <div className="pt-3 border-t border-[hsl(var(--portal-border))]">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
              <span className="text-xs font-medium text-[hsl(var(--portal-text-secondary))]">
                Winning Combinations
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {combos.map((combo, idx) => (
                <motion.div
                  key={combo.id || `combo-${idx}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "p-3 rounded-lg",
                    combo.lift_percentage > 0 
                      ? "bg-[hsl(var(--portal-success)/0.1)] border border-[hsl(var(--portal-success)/0.3)]"
                      : "bg-[hsl(var(--portal-error)/0.1)] border border-[hsl(var(--portal-error)/0.3)]"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      {combo.attribute_value}
                    </span>
                    <V3Badge variant={combo.lift_percentage > 0 ? "success" : "error"}>
                      {combo.lift_percentage > 0 ? '+' : ''}{combo.lift_percentage.toFixed(0)}%
                    </V3Badge>
                  </div>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {combo.recommended_action || combo.insight_text}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
}

export default MotivationInsights;
