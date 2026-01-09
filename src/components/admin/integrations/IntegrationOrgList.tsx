import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { IntegrationSummary } from '@/types/integrations';
import { IntegrationOrgRow } from './IntegrationOrgRow';

interface IntegrationOrgListProps {
  data: IntegrationSummary[];
  selectedOrgId: string | null;
  onSelectOrg: (orgId: string) => void;
  className?: string;
}

export function IntegrationOrgList({
  data,
  selectedOrgId,
  onSelectOrg,
  className,
}: IntegrationOrgListProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input field
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      if (data.length === 0) return;

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.min(prev + 1, data.length - 1);
            return next;
          });
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (focusedIndex >= 0 && focusedIndex < data.length) {
            e.preventDefault();
            onSelectOrg(data[focusedIndex].organization_id);
          }
          break;
        case 'g':
          if (e.shiftKey) {
            e.preventDefault();
            setFocusedIndex(data.length - 1);
          } else {
            e.preventDefault();
            setFocusedIndex(0);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, focusedIndex, onSelectOrg]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-org-row]');
      const item = items[focusedIndex];
      if (item) {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  return (
    <div 
      ref={listRef}
      className={cn("space-y-2", className)}
      role="listbox"
      aria-label="Organizations"
    >
      <AnimatePresence mode="popLayout">
        {data.map((summary, index) => (
          <div 
            key={summary.organization_id}
            data-org-row
            className={cn(
              "rounded-xl transition-shadow",
              focusedIndex === index && "ring-2 ring-[hsl(var(--portal-accent-blue))] ring-offset-2"
            )}
            role="option"
            aria-selected={selectedOrgId === summary.organization_id}
          >
            <IntegrationOrgRow
              summary={summary}
              onClick={() => onSelectOrg(summary.organization_id)}
              isSelected={selectedOrgId === summary.organization_id}
              index={index}
            />
          </div>
        ))}
      </AnimatePresence>

      {/* Keyboard navigation hint */}
      {data.length > 5 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="py-2 text-center"
        >
          <span className="text-xs text-[hsl(var(--portal-text-tertiary))]">
            Use <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono ml-0.5">↓</kbd> or 
            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono ml-1">j</kbd>
            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono ml-0.5">k</kbd> to navigate, 
            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--portal-bg-elevated))] rounded text-[10px] font-mono ml-1">Enter</kbd> to open
          </span>
        </motion.div>
      )}
    </div>
  );
}
