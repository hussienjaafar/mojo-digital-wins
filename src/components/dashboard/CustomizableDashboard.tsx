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
    const savedWidgets = localStorage.getItem(`${storageKey}-widgets`);
    
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

    if (savedWidgets) {
      const parsedWidgets = JSON.parse(savedWidgets);
      setWidgets(parsedWidgets);
    }
  }, [storageKey, initialWidgets]);

  const handleLayoutChange = (currentLayout: Layout[]) => {
    const newLayouts = { lg: currentLayout as DashboardLayout[] };
    setLayouts(newLayouts);
    onLayoutChange?.(currentLayout as DashboardLayout[]);
  };

  const saveLayout = () => {
    localStorage.setItem(storageKey, JSON.stringify(layouts));
    localStorage.setItem(`${storageKey}-widgets`, JSON.stringify(widgets));
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
      <div className="flex items-center justify-between p-4 bg-card/50 backdrop-blur border border-border/50 rounded-lg">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Customize Dashboard</h3>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? "Drag widgets to rearrange" : "Click edit to customize layout"}
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
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={saveLayout}
                className="gap-2"
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

      {/* Dashboard Grid */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={100}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        draggableHandle=".cursor-move"
        margin={[16, 16]}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="transition-all">
            <div className="h-full relative group">
              {widget.component}
              {isEditMode && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
  );
}
