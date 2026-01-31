import React, { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { V3Button } from '@/components/v3/V3Button';
import { 
  useAnomalyAlerts, 
  TrendAnomaly, 
  getAnomalyTypeLabel, 
  getAnomalyTypeColor,
  getSeverityBadgeClass,
  formatZScore 
} from '@/hooks/useAnomalyAlerts';
import { formatDistanceToNow } from 'date-fns';

interface AnomalyAlertsWidgetProps {
  showDragHandle?: boolean;
}

const getAnomalyIcon = (type: string) => {
  switch (type) {
    case 'velocity_spike':
      return <TrendingUp className="h-4 w-4" />;
    case 'volume_surge':
      return <Activity className="h-4 w-4" />;
    case 'sudden_drop':
      return <TrendingDown className="h-4 w-4" />;
    case 'sentiment_shift':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};

export function AnomalyAlertsWidget({ showDragHandle = false }: AnomalyAlertsWidgetProps) {
  const { anomalies, isLoading, stats, refresh, acknowledgeAnomaly } = useAnomalyAlerts({
    limit: 15,
    severityFilter: ['critical', 'high', 'medium']
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await acknowledgeAnomaly(id);
  };

  if (isLoading) {
    return (
      <div className="portal-card h-full">
        <div className="p-4 pb-2">
          <div className="portal-skeleton h-5 w-40" />
        </div>
        <div className="p-4 pt-0 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="portal-skeleton h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="portal-card h-full flex flex-col">
      <div className="p-4 pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {showDragHandle && (
            <div className="cursor-grab active:cursor-grabbing p-1">
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--portal-text-muted))]/30" />
                ))}
              </div>
            </div>
          )}
          <h3 className="text-base font-medium flex items-center gap-2 portal-text-primary">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Anomaly Alerts
          </h3>
          {stats.critical + stats.high > 0 && (
            <Badge variant="destructive" className="text-xs">
              {stats.critical + stats.high} urgent
            </Badge>
          )}
        </div>
        <V3Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          isLoading={isRefreshing}
        >
          <RefreshCw className="h-4 w-4" />
        </V3Button>
      </div>
      <div className="p-4 pt-0 flex-1">
        {anomalies.length === 0 ? (
          <div className="text-center py-8 portal-text-muted">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No anomalies detected</p>
            <p className="text-xs">System is operating normally</p>
          </div>
        ) : (
          <ScrollArea className="h-[350px] pr-2">
            <div className="space-y-2">
              {anomalies.map((anomaly) => (
                <Collapsible
                  key={anomaly.id}
                  open={expandedId === anomaly.id}
                  onOpenChange={(open) => setExpandedId(open ? anomaly.id : null)}
                >
                  <CollapsibleTrigger asChild>
                    <div 
                      className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                        anomaly.severity === 'critical' ? 'border-destructive/50 bg-destructive/5' :
                        anomaly.severity === 'high' ? 'border-orange-500/50 bg-orange-500/5' :
                        'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className={getAnomalyTypeColor(anomaly.anomaly_type)}>
                            {getAnomalyIcon(anomaly.anomaly_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">
                                {anomaly.topic}
                              </span>
                              <Badge 
                                className={`text-[10px] px-1.5 py-0 ${getSeverityBadgeClass(anomaly.severity)}`}
                              >
                                {anomaly.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {getAnomalyTypeLabel(anomaly.anomaly_type)} • {formatZScore(anomaly.z_score)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(anomaly.detected_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <V3Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6"
                            onClick={(e) => handleAcknowledge(anomaly.id, e)}
                            title="Acknowledge"
                          >
                            <Check className="h-3 w-3" />
                          </V3Button>
                          {expandedId === anomaly.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-1 text-xs space-y-2 bg-[hsl(var(--portal-bg-tertiary))] rounded-b-lg -mt-1 border-x border-b border-[hsl(var(--portal-border))]">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="portal-text-muted">Current:</span>
                          <span className="ml-1 font-medium portal-text-primary">{anomaly.current_value.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="portal-text-muted">Expected:</span>
                          <span className="ml-1 font-medium portal-text-primary">{anomaly.expected_value.toFixed(2)}</span>
                        </div>
                        {anomaly.deviation_percentage && (
                          <div>
                            <span className="portal-text-muted">Deviation:</span>
                            <span className={`ml-1 font-medium ${anomaly.deviation_percentage > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {anomaly.deviation_percentage > 0 ? '+' : ''}{anomaly.deviation_percentage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {anomaly.source_type && (
                          <div>
                            <span className="portal-text-muted">Source:</span>
                            <span className="ml-1 capitalize portal-text-primary">{anomaly.source_type}</span>
                          </div>
                        )}
                      </div>
                      {anomaly.context && Object.keys(anomaly.context).length > 0 && (
                        <div className="pt-1 border-t border-[hsl(var(--portal-border))]/50">
                          <span className="portal-text-muted">Context:</span>
                          <pre className="mt-1 text-[10px] bg-[hsl(var(--portal-bg-primary))]/50 p-1.5 rounded overflow-auto max-h-20 portal-text-primary">
                            {JSON.stringify(anomaly.context, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {/* Stats footer */}
        <div className="mt-3 pt-3 border-t border-[hsl(var(--portal-border))] flex items-center justify-between text-xs portal-text-muted">
          <div className="flex gap-3">
            <span>Spikes: {stats.byType.velocity_spike}</span>
            <span>Shifts: {stats.byType.sentiment_shift}</span>
            <span>Surges: {stats.byType.volume_surge}</span>
          </div>
          <span>{stats.total} total</span>
        </div>
      </div>
    </div>
  );
}

export default AnomalyAlertsWidget;