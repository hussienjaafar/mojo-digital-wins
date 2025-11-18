import { Button } from "@/components/ui/button";

interface SkipNavigationProps {
  mainContentId?: string;
  sidebarId?: string;
}

export function SkipNavigation({
  mainContentId = "main-content",
  sidebarId = "sidebar-navigation"
}: SkipNavigationProps) {
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-0 focus-within:left-0 focus-within:z-[100] focus-within:p-4 focus-within:bg-background focus-within:border-b focus-within:w-full">
      <div className="flex gap-2">
        <Button
          asChild
          variant="default"
          size="sm"
          className="focus:ring-2 focus:ring-primary"
        >
          <a href={`#${mainContentId}`}>
            Skip to main content
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="focus:ring-2 focus:ring-primary"
        >
          <a href={`#${sidebarId}`}>
            Skip to navigation
          </a>
        </Button>
      </div>
    </div>
  );
}
