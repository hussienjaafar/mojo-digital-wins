import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  Bell,
  Eye,
  Target,
  TrendingUp,
  BarChart3,
  DollarSign,
  UserCircle,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Newspaper,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

const navigationSections: NavigationSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", path: "/client/dashboard", icon: Home },
    ],
  },
  {
    title: "Intelligence Hub",
    items: [
      { label: "News & Trends", path: "/client/news-trends", icon: Newspaper },
      { label: "Entity Watchlist", path: "/client/watchlist", icon: Eye },
      { label: "Polling Intelligence", path: "/client/polling", icon: BarChart3 },
      { label: "Polling Alerts", path: "/client/polling-alerts", icon: Bell },
    ],
  },
  {
    title: "Alerts & Actions",
    items: [
      { label: "Critical Alerts", path: "/client/alerts", icon: Bell },
      { label: "Suggested Actions", path: "/client/actions", icon: Target },
      { label: "Opportunities", path: "/client/opportunities", icon: DollarSign },
    ],
  },
  {
    title: "Performance",
    items: [
      { label: "Creative Intelligence", path: "/client/creative-intelligence", icon: Sparkles },
      { label: "Demographics", path: "/client/demographics", icon: UserCircle },
      { label: "Donor Journey", path: "/client/journey", icon: TrendingUp },
      { label: "A/B Tests", path: "/client/ab-tests", icon: Target },
      { label: "Recurring Health", path: "/client/recurring-health", icon: DollarSign },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Profile", path: "/client/profile", icon: Settings },
    ],
  },
];

interface ClientNavigationProps {
  alertCount?: number;
  actionCount?: number;
  opportunityCount?: number;
}

export const ClientNavigation = ({ 
  alertCount = 0, 
  actionCount = 0, 
  opportunityCount = 0 
}: ClientNavigationProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Intelligence Hub": true,
    "Alerts & Actions": true,
    "Performance": true,
  });

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const getBadgeCount = (path: string) => {
    switch (path) {
      case "/client/alerts":
        return alertCount;
      case "/client/actions":
        return actionCount;
      case "/client/opportunities":
        return opportunityCount;
      default:
        return undefined;
    }
  };

  const NavigationContent = () => (
    <nav className="space-y-1">
      {navigationSections.map((section) => {
        const isExpanded = expandedSections[section.title] ?? false;
        const hasMultipleItems = section.items.length > 1;

        return (
          <div key={section.title} className="space-y-1">
            {hasMultipleItems ? (
              <Button
                variant="ghost"
                className="w-full justify-between px-3 py-2 h-auto text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={() => toggleSection(section.title)}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {section.title}
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </span>
              </div>
            )}

            {(!hasMultipleItems || isExpanded) && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  const badgeCount = getBadgeCount(item.path);

                  return (
                    <Link key={item.path} to={item.path}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 px-3 py-2 h-auto",
                          "text-foreground hover:bg-muted/50",
                          "transition-colors",
                          isActive && "bg-secondary/10 text-secondary hover:bg-secondary/20"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5",
                          isActive && "text-secondary"
                        )} />
                        <span className="flex-1 text-left font-medium">
                          {item.label}
                        </span>
                        {badgeCount !== undefined && badgeCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {badgeCount}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-6">
          <div className="flex flex-col h-full">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground">Navigation</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavigationContent />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-sm min-h-screen p-6">
      <div className="sticky top-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground">Navigation</h2>
        </div>
        <NavigationContent />
      </div>
    </aside>
  );
};
