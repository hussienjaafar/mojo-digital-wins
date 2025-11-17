import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Star, ExternalLink, Copy, Pin, PinOff } from "lucide-react";
import { NavigationItem } from "@/components/AdminSidebar";

interface NavigationItemContextMenuProps {
  item: NavigationItem;
  isPinned: boolean;
  onTogglePin: () => void;
  onNavigate: () => void;
  children: React.ReactNode;
}

export function NavigationItemContextMenu({
  item,
  isPinned,
  onTogglePin,
  onNavigate,
  children,
}: NavigationItemContextMenuProps) {
  const handleCopyName = () => {
    navigator.clipboard.writeText(item.title);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 animate-scale-in">
        <ContextMenuItem onClick={onNavigate} className="gap-2">
          <ExternalLink className="h-4 w-4" />
          Navigate to {item.title}
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={onTogglePin} className="gap-2">
          {isPinned ? (
            <>
              <PinOff className="h-4 w-4" />
              Unpin from Quick Access
            </>
          ) : (
            <>
              <Pin className="h-4 w-4" />
              Pin to Quick Access
            </>
          )}
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleCopyName} className="gap-2">
          <Copy className="h-4 w-4" />
          Copy Name
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
