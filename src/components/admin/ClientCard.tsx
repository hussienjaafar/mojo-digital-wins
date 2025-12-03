import { formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Users, AlertTriangle, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    if (change > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  const getAlertBadge = () => {
    if (client.unreadAlerts === 0) return null;
    
    const colors = {
      critical: "bg-destructive text-destructive-foreground",
      high: "bg-orange-500 text-white",
      medium: "bg-yellow-500 text-black",
      low: "bg-muted text-muted-foreground",
    };
    
    return (
      <Badge className={`${colors[client.alertSeverity || "low"]} gap-1`}>
        <AlertTriangle className="h-3 w-3" />
        {client.unreadAlerts}
      </Badge>
    );
  };

  const getIntegrationIcon = (status: "ok" | "failed" | "none") => {
    switch (status) {
      case "ok":
        return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground flex-shrink-0" />;
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={client.logoUrl} alt={client.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {client.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground leading-tight break-words">{client.name}</h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
                <span className={`flex items-center gap-1 ${client.isActive ? "text-green-500" : "text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${client.isActive ? "bg-green-500" : "bg-muted-foreground"}`} />
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
              <Badge variant="outline" className="text-orange-500 border-orange-500 gap-1">
                <Clock className="h-3 w-3" />
                Stale
              </Badge>
            )}
            {getAlertBadge()}
          </div>
        </div>
        
        {client.lastLogin && (
          <p className="text-xs text-muted-foreground mt-2">
            Last login: {formatDistanceToNow(new Date(client.lastLogin), { addSuffix: true })}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-sm font-semibold">{formatCurrency(client.revenue)}</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(client.revenueChange)}`}>
              {getTrendIcon(client.revenueChange)}
              <span>{formatPercent(client.revenueChange)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Spend</p>
            <p className="text-sm font-semibold">{formatCurrency(client.spend)}</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(-client.spendChange)}`}>
              {getTrendIcon(-client.spendChange)}
              <span>{formatPercent(client.spendChange)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ROI</p>
            <p className="text-sm font-semibold">{client.roi.toFixed(0)}%</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(client.roiChange)}`}>
              {getTrendIcon(client.roiChange)}
              <span>{formatPercent(client.roiChange)}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Donations</p>
            <p className="text-sm font-semibold">{client.donations}</p>
            <div className={`flex items-center gap-1 text-xs ${getTrendColor(client.donationsChange)}`}>
              {getTrendIcon(client.donationsChange)}
              <span>{formatPercent(client.donationsChange)}</span>
            </div>
          </div>
        </div>
        
        {/* Sparkline */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">7-Day Revenue Trend</p>
          <ClientSparkline data={client.dailyRevenue} />
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs min-w-0 flex-1">
            {client.integrations.map((integration) => (
              <span key={integration.platform} className="flex items-center gap-1">
                {getIntegrationIcon(integration.status)}
                <span className="whitespace-nowrap">{integration.platform}</span>
              </span>
            ))}
            {client.integrations.length === 0 && (
              <span className="text-muted-foreground">No integrations</span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 flex-shrink-0"
            onClick={() => navigate(`/client/dashboard?org=${client.id}`)}
          >
            View
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
