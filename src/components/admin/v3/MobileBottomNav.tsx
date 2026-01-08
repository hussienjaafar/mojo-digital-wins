import React from 'react';
import { TrendingUp, Filter, Bookmark, Bell, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  activeTab: 'trends' | 'filters' | 'saved' | 'alerts';
  onTabChange: (tab: 'trends' | 'filters' | 'saved' | 'alerts') => void;
  alertCount?: number;
  savedCount?: number;
}

export function MobileBottomNav({ 
  activeTab, 
  onTabChange, 
  alertCount = 0,
  savedCount = 0 
}: MobileBottomNavProps) {
  const tabs = [
    { id: 'trends' as const, icon: TrendingUp, label: 'Trends' },
    { id: 'filters' as const, icon: Filter, label: 'Filters' },
    { id: 'saved' as const, icon: Bookmark, label: 'Saved', count: savedCount },
    { id: 'alerts' as const, icon: Bell, label: 'Alerts', count: alertCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 relative",
              "transition-colors touch-manipulation",
              activeTab === id 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {count !== undefined && count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px] font-medium bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
