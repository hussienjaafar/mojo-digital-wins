import { motion } from "framer-motion";
import { DollarSign, Image, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { HeroKpiCard } from "@/components/client/HeroKpiCard";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import type { CreativeIntelligenceData } from "@/hooks/useCreativeIntelligence";

interface CreativeIntelligenceSummaryProps {
  data: CreativeIntelligenceData | undefined;
  isLoading?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export function CreativeIntelligenceSummary({ data, isLoading }: CreativeIntelligenceSummaryProps) {
  if (isLoading) {
    return <V3LoadingState variant="kpi-grid" count={6} />;
  }

  const summary = data?.summary;
  const recommendations = data?.recommendation_summary;

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <HeroKpiCard
          kpiKey="ci_totalCreatives"
          icon={Image}
          label="Creatives Analyzed"
          value={summary?.total_creatives?.toLocaleString() || "0"}
          subtitle={`${summary?.creatives_with_issues || 0} with issue data`}
          accent="blue"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <HeroKpiCard
          kpiKey="ci_totalSpend"
          icon={DollarSign}
          label="Total Spend"
          value={`$${(summary?.total_spend || 0).toLocaleString()}`}
          subtitle="In date range"
          accent="default"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <HeroKpiCard
          kpiKey="ci_totalRevenue"
          icon={DollarSign}
          label="Total Revenue"
          value={`$${(summary?.total_revenue || 0).toLocaleString()}`}
          subtitle="Attributed donations"
          accent="green"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <HeroKpiCard
          kpiKey="ci_overallRoas"
          icon={Target}
          label="Overall ROAS"
          value={`${(summary?.overall_roas || 0).toFixed(2)}x`}
          subtitle={summary?.overall_roas && summary.overall_roas >= 1 ? "Profitable" : "Below break-even"}
          accent={summary?.overall_roas && summary.overall_roas >= 1 ? "green" : "red"}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <HeroKpiCard
          kpiKey="ci_scalable"
          icon={TrendingUp}
          label="Scale Ready"
          value={recommendations?.scale?.toString() || "0"}
          subtitle="High performers"
          accent="green"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <HeroKpiCard
          kpiKey="ci_needsAttention"
          icon={AlertTriangle}
          label="Need Attention"
          value={((recommendations?.pause || 0) + (recommendations?.refresh || 0)).toString()}
          subtitle={`${recommendations?.pause || 0} pause, ${recommendations?.refresh || 0} refresh`}
          accent={(recommendations?.pause || 0) + (recommendations?.refresh || 0) > 0 ? "amber" : "default"}
        />
      </motion.div>
    </motion.div>
  );
}
