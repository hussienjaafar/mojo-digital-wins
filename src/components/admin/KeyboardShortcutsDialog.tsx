import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  {
    category: "Navigation",
    items: [
      { keys: ["Ctrl/⌘", "K"], description: "Focus search" },
      { keys: ["Ctrl/⌘", "B"], description: "Toggle sidebar" },
      { keys: ["/"], description: "Quick search" },
      { keys: ["Esc"], description: "Clear search / Close dialogs" },
    ]
  },
  {
    category: "Quick Navigation",
    items: [
      { keys: ["G", "D"], description: "Go to Dashboard" },
      { keys: ["G", "C"], description: "Go to Clients" },
      { keys: ["G", "M"], description: "Go to Messages" },
      { keys: ["G", "A"], description: "Go to Campaigns" },
    ]
  },
  {
    category: "Search Results",
    items: [
      { keys: ["↑"], description: "Previous result" },
      { keys: ["↓"], description: "Next result" },
      { keys: ["Enter"], description: "Select result" },
    ]
  },
  {
    category: "Actions",
    items: [
      { keys: ["Right-click"], description: "Pin/Unpin navigation item" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ]
  }
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up your workflow with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <kbd
                          key={keyIndex}
                          className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Tip:</strong> Press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border border-border rounded">
              ?
            </kbd>{" "}
            anytime to view this help dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
