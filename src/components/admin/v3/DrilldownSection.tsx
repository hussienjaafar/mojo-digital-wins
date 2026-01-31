import { useState } from 'react';
import { ChevronDown, ChevronRight, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface DrilldownSectionProps {
  title: string;
  icon?: LucideIcon;
  badge?: string | number;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DrilldownSection({
  title,
  icon: Icon,
  badge,
  badgeVariant = 'secondary',
  defaultExpanded = false,
  children,
  className,
}: DrilldownSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={cn(
      "border border-[hsl(var(--portal-border))] rounded-lg overflow-hidden",
      className
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left",
          "bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-sunken))]",
          "transition-colors duration-150"
        )}
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <Icon className="h-4 w-4 text-[hsl(var(--portal-text-secondary))]" />
          )}
          <span className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">
            {title}
          </span>
          {badge !== undefined && (
            <Badge variant={badgeVariant} className="text-[10px]">
              {badge}
            </Badge>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-[hsl(var(--portal-text-tertiary))]" />
        </motion.div>
      </button>
      
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="p-4 border-t border-[hsl(var(--portal-border))]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
