import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp,
  List,
  Newspaper,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface SecondaryExplorerProps {
  children: React.ReactNode;
  newsFeedContent?: React.ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenFilters?: () => void;
  className?: string;
}

export function SecondaryExplorer({
  children,
  newsFeedContent,
  isCollapsed = false,
  onToggleCollapse,
  onOpenFilters,
  className,
}: SecondaryExplorerProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'feed'>('trends');

  return (
    <div className={cn("rounded-lg border bg-card/40 border-border/50", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Secondary Exploration
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          {onOpenFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={onOpenFilters}
            >
              <Filter className="h-3 w-3" />
              Filters
            </Button>
          )}
          
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleCollapse}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {newsFeedContent ? (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
                <div className="px-4 pt-3">
                  <TabsList className="grid w-full max-w-xs grid-cols-2 h-8">
                    <TabsTrigger value="trends" className="text-xs gap-1.5">
                      <List className="h-3 w-3" />
                      All Trends
                    </TabsTrigger>
                    <TabsTrigger value="feed" className="text-xs gap-1.5">
                      <Newspaper className="h-3 w-3" />
                      News Feed
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="trends" className="mt-0 p-4">
                  {children}
                </TabsContent>
                
                <TabsContent value="feed" className="mt-0 p-4">
                  {newsFeedContent}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="p-4">
                {children}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
