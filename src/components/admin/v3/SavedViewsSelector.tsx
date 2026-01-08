import { useState } from 'react';
import { Check, ChevronDown, Plus, Trash2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SavedView } from '@/hooks/useSavedViews';
import type { FilterState } from './TrendsFilterRail';

interface SavedViewsSelectorProps {
  views: SavedView[];
  activeViewId: string;
  onSelectView: (viewId: string) => void;
  onCreateView: (name: string, filters: FilterState) => void;
  onDeleteView: (viewId: string) => void;
  currentFilters: FilterState;
  className?: string;
}

export function SavedViewsSelector({
  views,
  activeViewId,
  onSelectView,
  onCreateView,
  onDeleteView,
  currentFilters,
  className,
}: SavedViewsSelectorProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const activeView = views.find(v => v.id === activeViewId);

  const handleCreateView = () => {
    if (newViewName.trim()) {
      onCreateView(newViewName.trim(), currentFilters);
      setNewViewName('');
      setIsCreateDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2 h-8", className)}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span className="max-w-[120px] truncate">
              {activeView?.name || 'Select view'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {views.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => onSelectView(view.id)}
              className="flex items-center justify-between"
            >
              <span className={cn(
                "truncate",
                view.isDefault && "font-medium"
              )}>
                {view.name}
              </span>
              <div className="flex items-center gap-2">
                {activeViewId === view.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
                {!view.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteView(view.id);
                    }}
                    className="p-1 hover:bg-destructive/10 rounded opacity-50 hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Save current as new view
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Save your current filter settings as a reusable view.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="view-name">View name</Label>
            <Input
              id="view-name"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g., Fundraising Focus"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateView()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateView} disabled={!newViewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
