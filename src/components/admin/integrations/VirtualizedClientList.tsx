import React, { useRef, useState, useEffect, CSSProperties } from 'react';
import { List, ListImperativeAPI, RowComponentProps } from 'react-window';
import { IntegrationSummary } from '@/types/integrations';
import { IntegrationClientRow } from './IntegrationClientRow';
import { cn } from '@/lib/utils';

interface VirtualizedClientListProps {
  data: IntegrationSummary[];
  onTest: (id: string) => Promise<boolean>;
  onToggle: (id: string, currentState: boolean) => Promise<boolean>;
  onEdit: (id: string) => void;
  onAddIntegration: (orgId: string) => void;
  className?: string;
}

interface RowData {
  items: IntegrationSummary[];
  onTest: (id: string) => Promise<boolean>;
  onToggle: (id: string, currentState: boolean) => Promise<boolean>;
  onEdit: (id: string) => void;
  onAddIntegration: (orgId: string) => void;
  focusedIndex: number;
  onFocus: (index: number) => void;
}

const COLLAPSED_ROW_HEIGHT = 76;

function RowComponent({
  index,
  style,
  items,
  onTest,
  onToggle,
  onEdit,
  onAddIntegration,
  focusedIndex,
  onFocus,
}: { index: number; style: CSSProperties } & RowData) {
  const summary = items[index];
  
  return (
    <div
      style={{ ...style, paddingBottom: 12, paddingRight: 8 }}
      className={cn(
        'transition-shadow',
        focusedIndex === index && 'ring-2 ring-primary ring-offset-2 rounded-lg'
      )}
      onClick={() => onFocus(index)}
    >
      <IntegrationClientRow
        summary={summary}
        onTest={onTest}
        onToggle={onToggle}
        onEdit={onEdit}
        onAddIntegration={onAddIntegration}
        defaultOpen={false} // Start collapsed in virtualized mode
      />
    </div>
  );
}

export function VirtualizedClientList({
  data,
  onTest,
  onToggle,
  onEdit,
  onAddIntegration,
  className,
}: VirtualizedClientListProps) {
  const listRef = useRef<ListImperativeAPI>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

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
          setFocusedIndex((prev) => Math.min(prev + 1, data.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'g':
          if (e.shiftKey) {
            // Shift+G = go to end
            e.preventDefault();
            setFocusedIndex(data.length - 1);
          } else {
            // g = go to start
            e.preventDefault();
            setFocusedIndex(0);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data.length]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      listRef.current.scrollToRow({ index: focusedIndex, align: 'smart' });
    }
  }, [focusedIndex]);

  // For collapsible rows, we use a simpler approach - non-virtualized
  // because row heights vary significantly when expanded
  // Only virtualize when list is large (>50 items)
  const shouldVirtualize = data.length > 50;

  if (!shouldVirtualize) {
    return (
      <div className={cn('space-y-3', className)} ref={containerRef}>
        {data.map((summary, index) => (
          <div
            key={summary.organization_id}
            className={cn(
              'transition-shadow rounded-lg',
              focusedIndex === index && 'ring-2 ring-primary ring-offset-2'
            )}
            onClick={() => setFocusedIndex(index)}
          >
            <IntegrationClientRow
              summary={summary}
              onTest={onTest}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddIntegration={onAddIntegration}
              defaultOpen={summary.health_status === 'needs_attention'}
            />
          </div>
        ))}
        {data.length > 10 && (
          <div className="mt-2 text-xs text-muted-foreground text-center">
            Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">j</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">k</kbd> or arrow keys to navigate
          </div>
        )}
      </div>
    );
  }

  // For very large lists, use virtualization with fixed collapsed height
  const rowProps: RowData = {
    items: data,
    onTest,
    onToggle,
    onEdit,
    onAddIntegration,
    focusedIndex,
    onFocus: setFocusedIndex,
  };

  return (
    <div className={className} ref={containerRef}>
      <List
        listRef={listRef}
        style={{ height: 600 }}
        rowCount={data.length}
        rowHeight={COLLAPSED_ROW_HEIGHT}
        rowComponent={RowComponent as any}
        rowProps={rowProps}
        overscanCount={5}
      />
      <div className="mt-2 text-xs text-muted-foreground text-center">
        Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">j</kbd>/<kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">k</kbd> or arrow keys to navigate • Showing {data.length} clients (virtualized)
      </div>
    </div>
  );
}
