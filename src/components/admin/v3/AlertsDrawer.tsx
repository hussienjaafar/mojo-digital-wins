import { useState, useMemo } from 'react';
import { 
  Bell, 
  X, 
  AlertTriangle,
  Eye,
  Zap,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { V3Card, V3CardContent } from '@/components/v3';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'breaking' | 'watchlist' | 'review';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  whatHappened: string;
  whyItMatters: string;
  suggestedAction: string;
  sources: string[];
  createdAt: Date;
  isRead: boolean;
  trendId?: string;
}

interface AlertsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewTrend?: (trendId: string) => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getSeverityStyles(severity: Alert['severity']) {
  switch (severity) {
    case 'critical':
      return {
        badge: 'bg-destructive text-destructive-foreground',
        icon: 'text-destructive',
        border: 'border-l-destructive',
      };
    case 'high':
      return {
        badge: 'bg-[hsl(var(--portal-warning))] text-white',
        icon: 'text-[hsl(var(--portal-warning))]',
        border: 'border-l-[hsl(var(--portal-warning))]',
      };
    case 'medium':
      return {
        badge: 'bg-[hsl(var(--portal-info))] text-white',
        icon: 'text-[hsl(var(--portal-info))]',
        border: 'border-l-[hsl(var(--portal-info))]',
      };
  }
}

// Placeholder alerts - in production these would come from a real data source
const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    type: 'breaking',
    severity: 'critical',
    title: 'Major policy announcement detected',
    whatHappened: 'New executive order signed affecting healthcare regulations.',
    whyItMatters: 'Directly impacts advocacy messaging for health policy clients.',
    suggestedAction: 'Review messaging guidelines and prepare response strategy.',
    sources: ['AP News', 'Reuters', 'White House'],
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
    isRead: false,
    trendId: 'trend-1',
  },
  {
    id: '2',
    type: 'watchlist',
    severity: 'high',
    title: 'Watchlist entity mentioned in negative context',
    whatHappened: 'Senator mentioned in connection with investigation reports.',
    whyItMatters: 'May affect donor sentiment and fundraising timing.',
    suggestedAction: 'Monitor developments and consider proactive outreach.',
    sources: ['Politico', 'The Hill'],
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    isRead: false,
    trendId: 'trend-2',
  },
  {
    id: '3',
    type: 'review',
    severity: 'medium',
    title: 'Unusual activity spike detected',
    whatHappened: 'Climate policy topic showing 3.5σ above normal activity.',
    whyItMatters: 'Could indicate emerging narrative opportunity.',
    suggestedAction: 'Review trend details and assess relevance.',
    sources: ['Social media', 'News outlets'],
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    isRead: true,
    trendId: 'trend-3',
  },
];

function AlertCard({ 
  alert, 
  onView, 
  onDismiss 
}: { 
  alert: Alert; 
  onView: () => void; 
  onDismiss: () => void;
}) {
  const styles = getSeverityStyles(alert.severity);
  const [expanded, setExpanded] = useState(false);

  return (
    <V3Card 
      className={cn(
        "border-l-4 transition-all",
        styles.border,
        !alert.isRead && "bg-muted/30"
      )}
    >
      <V3CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5", styles.icon)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={cn("text-[10px]", styles.badge)}>
                  {alert.severity.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(alert.createdAt)}
                </span>
                {!alert.isRead && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
              <h4 className="font-medium text-sm">
                {alert.title}
              </h4>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              expanded && "rotate-90"
            )} />
          </Button>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3 pl-8">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    What happened
                  </p>
                  <p className="text-sm">{alert.whatHappened}</p>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Why it matters
                  </p>
                  <p className="text-sm">{alert.whyItMatters}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Suggested action
                  </p>
                  <p className="text-sm text-primary">{alert.suggestedAction}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {alert.sources.map((source, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" onClick={onView} className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    View Trend
                  </Button>
                  <Button size="sm" variant="outline" onClick={onDismiss}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </V3CardContent>
    </V3Card>
  );
}

export function AlertsDrawer({ open, onOpenChange, onViewTrend }: AlertsDrawerProps) {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [activeTab, setActiveTab] = useState<'all' | 'breaking' | 'watchlist' | 'review'>('all');

  const filteredAlerts = useMemo(() => {
    if (activeTab === 'all') return alerts;
    return alerts.filter(a => a.type === activeTab);
  }, [alerts, activeTab]);

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const handleDismiss = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleView = (alert: Alert) => {
    // Mark as read
    setAlerts(prev => prev.map(a => 
      a.id === alert.id ? { ...a, isRead: true } : a
    ));
    if (alert.trendId) {
      onViewTrend?.(alert.trendId);
    }
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        
        {/* Drawer */}
        <motion.div
          className="relative w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 relative">
                <Bell className="h-5 w-5 text-primary" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-lg">Alerts</h2>
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
            <div className="px-5 pt-3">
              <TabsList className="w-full grid grid-cols-4 h-8">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="breaking" className="text-xs gap-1">
                  <Zap className="h-3 w-3" />
                  Breaking
                </TabsTrigger>
                <TabsTrigger value="watchlist" className="text-xs gap-1">
                  <Eye className="h-3 w-3" />
                  Watchlist
                </TabsTrigger>
                <TabsTrigger value="review" className="text-xs gap-1">
                  <Sparkles className="h-3 w-3" />
                  Review
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Alert List */}
            <TabsContent value={activeTab} className="flex-1 mt-0">
              <ScrollArea className="flex-1 h-full px-5 py-4">
                {filteredAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mb-3 opacity-30" />
                    <p className="font-medium">No alerts</p>
                    <p className="text-sm">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAlerts.map(alert => (
                      <AlertCard
                        key={alert.id}
                        alert={alert}
                        onView={() => handleView(alert)}
                        onDismiss={() => handleDismiss(alert.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
