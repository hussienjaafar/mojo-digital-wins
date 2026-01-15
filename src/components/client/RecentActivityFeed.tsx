import React from "react";
import { formatDistanceToNow, format } from "date-fns";
import { DollarSign, Repeat, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { V3Card } from "@/components/v3";
import { formatCurrency } from "@/lib/chart-formatters";
import { type RecentDonation } from "@/hooks/useHourlyMetrics";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// Types
// ============================================================================

interface RecentActivityFeedProps {
  donations: RecentDonation[];
  isLive?: boolean;
  maxHeight?: number;
  className?: string;
}

// ============================================================================
// Animation Variants
// ============================================================================

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getChannelFromRefcode(refcode: string | null, sourceCampaign: string | null): string {
  if (!refcode && !sourceCampaign) return "Direct";
  
  const combined = `${refcode || ""} ${sourceCampaign || ""}`.toLowerCase();
  
  if (combined.includes("sms") || combined.includes("text")) return "SMS";
  if (combined.includes("meta") || combined.includes("facebook") || combined.includes("fb")) return "Meta";
  if (combined.includes("email") || combined.includes("em_")) return "Email";
  if (combined.includes("google") || combined.includes("ggl")) return "Google";
  
  return "Other";
}

function getChannelColor(channel: string): string {
  switch (channel) {
    case "SMS":
      return "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]";
    case "Meta":
      return "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]";
    case "Email":
      return "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))]";
    case "Google":
      return "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]";
    default:
      return "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-muted))]";
  }
}

// ============================================================================
// DonationItem Component
// ============================================================================

interface DonationItemProps {
  donation: RecentDonation;
  index: number;
}

const DonationItem: React.FC<DonationItemProps> = ({ donation, index }) => {
  const channel = getChannelFromRefcode(donation.refcode, null);
  const channelColor = getChannelColor(channel);
  
  const donorDisplay = donation.donor_name || "Anonymous";
  const timeAgo = formatDistanceToNow(new Date(donation.transaction_date), { addSuffix: true });
  const exactTime = format(new Date(donation.transaction_date), "h:mm a");

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        "flex items-center gap-3 py-3",
        "border-b border-[hsl(var(--portal-border))] last:border-0",
        // Highlight newest donation
        index === 0 && "bg-[hsl(var(--portal-success)/0.03)]"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "p-2 rounded-full shrink-0",
        donation.is_recurring 
          ? "bg-[hsl(var(--portal-accent-purple)/0.1)]"
          : "bg-[hsl(var(--portal-accent-blue)/0.1)]"
      )}>
        {donation.is_recurring ? (
          <Repeat className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-purple))]" />
        ) : (
          <DollarSign className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
            {formatCurrency(donation.amount, false)}
          </span>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", channelColor)}>
            {channel}
          </Badge>
          {donation.is_recurring && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))]">
              Recurring
            </Badge>
          )}
        </div>
        <p className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
          {donorDisplay}
        </p>
      </div>

      {/* Time */}
      <div className="text-right shrink-0">
        <p className="text-xs font-medium text-[hsl(var(--portal-text-secondary))]">
          {exactTime}
        </p>
        <p className="text-[10px] text-[hsl(var(--portal-text-muted))]">
          {timeAgo}
        </p>
      </div>
    </motion.div>
  );
};

// ============================================================================
// RecentActivityFeed Component
// ============================================================================

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  donations,
  isLive = false,
  maxHeight = 360,
  className,
}) => {
  return (
    <V3Card className={cn("p-4 sm:p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
          Recent Activity
        </h3>
        {isLive && donations.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--portal-success))]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--portal-success))] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--portal-success))]" />
            </span>
            Live
          </div>
        )}
      </div>

      {donations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <DollarSign className="h-8 w-8 text-[hsl(var(--portal-text-muted))] mb-2 opacity-50" />
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">
            No donations yet today
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
            Check back later for activity
          </p>
        </div>
      ) : (
        <ScrollArea style={{ maxHeight }} className="pr-2">
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {donations.map((donation, idx) => (
                <DonationItem 
                  key={donation.id} 
                  donation={donation} 
                  index={idx}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </ScrollArea>
      )}

      {donations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[hsl(var(--portal-border))]">
          <p className="text-xs text-[hsl(var(--portal-text-muted))] text-center">
            Showing {donations.length} most recent donations
          </p>
        </div>
      )}
    </V3Card>
  );
};

export default RecentActivityFeed;
