import { formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Users, AlertTriangle, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClientSparkline } from "./ClientSparkline";
import { useNavigate } from "react-router-dom";

export interface ClientCardData {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  isActive: boolean;
  lastLogin: string | null;
  userCount: number;
  isStale: boolean;
  revenue: number;
  revenueChange: number;
  spend: number;
  spendChange: number;
  roi: number;
  roiChange: number;
  donations: number;
  donationsChange: number;
  integrations: { platform: string; status: "ok" | "failed" | "none" }[];
  unreadAlerts: number;
  alertSeverity: "critical" | "high" | "medium" | "low" | null;
  dailyRevenue: number[];
}

interface ClientCardProps {
  client: ClientCardData;
}

export function ClientCard({ client }: ClientCardProps) {
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3 text-[hsl(var(--portal-accent-green))]" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-[hsl(var(--portal-accent-red))]" />;
    return <Minus className="h-3 w-3 portal-text-secondary" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-[hsl(var(--portal-accent-green))]";
    if (change < 0) return "text-[hsl(var(--portal-accent-red))]";
    return "portal-text-secondary";
  };

  const getAlertBadge = () => {
    if (client.unreadAlerts === 0) return null;
    
    const colors = {
      critical: "portal-badge-error",
      high: "bg-[hsl(var(--portal-accent-orange))] text-white",
      medium: "bg-[hsl(var(--portal-accent-yellow))] text-black",
      low: "bg-[hsl(var(--portal-bg-elevated))] portal-text-secondary",
    };
    
    return (
      <span className={`${colors[client.alertSeverity || "low"]} portal-badge gap-1`}>
        <AlertTriangle className="h-3 w-3" />
        {client.unreadAlerts}
      </span>
    );
  };

  const getIntegrationIcon = (status: "ok" | "failed" | "none") => {
    switch (status) {
      case "ok":
        return <CheckCircle2 className="h-3 w-3 text-[hsl(var(--portal-accent-green))] flex-shrink-0" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-[hsl(var(--portal-accent-red))] flex-shrink-0" />;
      default:
        return <Minus className="h-3 w-3 portal-text-secondary flex-shrink-0" />;
    }
  };

  return (
    <div className="portal-card overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={client.logoUrl} alt={client.name} />
              <AvatarFallback className="bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] text-sm font-semibold">
                {client.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold portal-text-primary leading-tight break-words">{client.name}</h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs portal-text-secondary mt-1">
                <span className={`flex items-center gap-1 ${client.isActive ? "text-[hsl(var(--portal-accent-green))]" : "portal-text-secondary"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${client.isActive ? "bg-[hsl(var(--portal-accent-green))]" : "bg-[hsl(var(--portal-text-secondary))]"}`} />
                  {client.isActive ? "Active" : "Inactive"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 flex-shrink-0" />
                  {client.userCount} users
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {client.isStale && (
              <span className="portal-badge-warning gap-1 portal-badge">
                <Clock className="h-3 w-3" />
                Stale
              </span>
            )}
            {getAlertBadge()}
          </div>
        </div>
        
        {client.lastLogin && (
          <p className="text-xs portal-text-secondary mt-2">
            Last login: {formatDistanceToNow(new Date(client.lastLogin), { addSuffix: true })}
          </p>
        )}
      </div>
      
      <div className="p-4 pt-0 space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs portal-text-secondary">Revenue</p>
            <p className="text-sm font-semibold portal-text-primary">{formatCurrency(client.revenue)}</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(client.revenueChange)}`}>
              {getTrendIcon(client.revenueChange)}
              <span>{formatPercent(client.revenueChange)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs portal-text-secondary">Spend</p>
            <p className="text-sm font-semibold portal-text-primary">{formatCurrency(client.spend)}</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(-client.spendChange)}`}>
              {getTrendIcon(-client.spendChange)}
              <span>{formatPercent(client.spendChange)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs portal-text-secondary">ROI</p>
            <p className="text-sm font-semibold portal-text-primary">{client.roi.toFixed(0)}%</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(client.roiChange)}`}>
              {getTrendIcon(client.roiChange)}
              <span>{formatPercent(client.roiChange)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs portal-text-secondary">Donations</p>
            <p className="text-sm font-semibold portal-text-primary">{client.donations}</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(client.donationsChange)}`}>
              {getTrendIcon(client.donationsChange)}
              <span>{formatPercent(client.donationsChange)}</span>
            </div>
          </div>
        </div>
        
        {/* Sparkline */}
        <div>
          <p className="text-xs portal-text-secondary mb-1">7-Day Revenue Trend</p>
          <ClientSparkline data={client.dailyRevenue} />
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--portal-border))] gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs min-w-0 flex-1">
            {client.integrations.map((integration) => (
              <span key={integration.platform} className="flex items-center gap-1">
                {getIntegrationIcon(integration.status)}
                <span className="whitespace-nowrap portal-text-secondary">{integration.platform}</span>
              </span>
            ))}
            {client.integrations.length === 0 && (
              <span className="portal-text-secondary">No integrations</span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 flex-shrink-0 portal-btn-secondary"
            onClick={() => navigate(`/client/dashboard?org=${client.id}`)}
          >
            View
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
