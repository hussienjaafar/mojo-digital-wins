import { useState, useEffect } from "react";
import { Responsive, WidthProvider, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Button } from "@/components/ui/button";
import { LayoutGrid, RotateCcw, Save, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import "./dashboard-grid.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface DashboardLayout extends Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface WidgetConfig {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultLayout: {
    w: number;
    h: number;
    x: number;
    y: number;
    minW?: number;
    minH?: number;
  };
}

interface CustomizableDashboardProps {
  storageKey: string;
  widgets: WidgetConfig[];
  availableWidgets?: WidgetConfig[];
  onLayoutChange?: (layout: DashboardLayout[]) => void;
}

export function CustomizableDashboard({
  storageKey,
  widgets: initialWidgets,
  availableWidgets = [],
  onLayoutChange,
}: CustomizableDashboardProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialWidgets);
  const [layouts, setLayouts] = useState<{ lg: DashboardLayout[] }>({ lg: [] });
  const [isEditMode, setIsEditMode] = useState(false);

  // Load saved layout from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem(storageKey);
    const savedWidgetIds = localStorage.getItem(`${storageKey}-widgets`);
    
    if (savedLayout) {
      setLayouts(JSON.parse(savedLayout));
    } else {
      // Initialize with default layouts
      const defaultLayouts = initialWidgets.map((widget) => ({
        i: widget.id,
        ...widget.defaultLayout,
      }));
      setLayouts({ lg: defaultLayouts });
    }

    if (savedWidgetIds) {
      // Reconstruct widgets from saved IDs (not full objects with React components)
      const parsedIds: string[] = JSON.parse(savedWidgetIds);
      const allWidgets = [...initialWidgets, ...availableWidgets];
      const reconstructedWidgets = parsedIds
        .map(id => allWidgets.find(w => w.id === id))
        .filter((w): w is WidgetConfig => w !== undefined);
      
      if (reconstructedWidgets.length > 0) {
        setWidgets(reconstructedWidgets);
      }
    }
  }, [storageKey, initialWidgets, availableWidgets]);

  const handleLayoutChange = (currentLayout: Layout[], allLayouts: { lg?: Layout[] }) => {
    if (allLayouts.lg) {
      const newLayouts = { lg: allLayouts.lg as DashboardLayout[] };
      setLayouts(newLayouts);
      onLayoutChange?.(allLayouts.lg as DashboardLayout[]);
    }
  };

  const handleDragResizeStop = (layout: Layout[]) => {
    const newLayouts = { lg: layout as DashboardLayout[] };
    setLayouts(newLayouts);
    localStorage.setItem(storageKey, JSON.stringify(newLayouts));
    // Save widget IDs only (not full objects with React components)
    const widgetIds = widgets.map(w => w.id);
    localStorage.setItem(`${storageKey}-widgets`, JSON.stringify(widgetIds));
  };

  const saveLayout = () => {
    localStorage.setItem(storageKey, JSON.stringify(layouts));
    // Save widget IDs only (not full objects with React components)
    const widgetIds = widgets.map(w => w.id);
    localStorage.setItem(`${storageKey}-widgets`, JSON.stringify(widgetIds));
    toast.success("Dashboard layout saved!");
    setIsEditMode(false);
  };

  const resetLayout = () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-widgets`);
    const defaultLayouts = initialWidgets.map((widget) => ({
      i: widget.id,
      ...widget.defaultLayout,
    }));
    setLayouts({ lg: defaultLayouts });
    setWidgets(initialWidgets);
    toast.success("Dashboard layout reset to default!");
  };

  const removeWidget = (widgetId: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    setLayouts((prev) => ({
      lg: prev.lg.filter((l) => l.i !== widgetId),
    }));
  };

  const addWidget = (widget: WidgetConfig) => {
    // Check if widget already exists
    if (widgets.find((w) => w.id === widget.id)) {
      toast.error("Widget already added!");
      return;
    }

    setWidgets((prev) => [...prev, widget]);
    setLayouts((prev) => ({
      lg: [...prev.lg, { i: widget.id, ...widget.defaultLayout }],
    }));
    toast.success(`${widget.title} added!`);
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex items-center justify-between p-4 bg-card/50 backdrop-blur border border-border/50 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Customize Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse" />
                  Drag widgets to rearrange
                </span>
              ) : (
                "Click edit to customize layout"
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {availableWidgets.length > 0 && isEditMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Widget
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {availableWidgets
                  .filter((w) => !widgets.find((widget) => widget.id === w.id))
                  .map((widget) => (
                    <DropdownMenuItem
                      key={widget.id}
                      onClick={() => addWidget(widget)}
                    >
                      {widget.title}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={resetLayout}
                className="gap-2 hover:border-destructive/50 hover:text-destructive transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={saveLayout}
                className="gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Save className="h-4 w-4" />
                Save Layout
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsEditMode(true)}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Edit Layout
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard Grid with edit mode indicator */}
      <div className={`relative ${isEditMode ? 'ring-2 ring-primary/20 ring-offset-2 rounded-lg p-1' : ''}`}>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          onLayoutChange={handleLayoutChange}
          onDragStop={handleDragResizeStop}
          onResizeStop={handleDragResizeStop}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".cursor-move"
          margin={[12, 12]}
          compactType="vertical"
          preventCollision={false}
          useCSSTransforms={true}
        >
        {widgets.map((widget) => (
          <div key={widget.id} className="transition-all hover:scale-[1.01]">
            <div className="h-full relative group">
              {widget.component}
              {isEditMode && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                  aria-label={`Remove ${widget.title}`}
                  onClick={() => removeWidget(widget.id)}
                >
                  <span className="sr-only">Remove widget</span>
                  ×
                </Button>
              )}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>
      </div>
    </div>
  );
}
