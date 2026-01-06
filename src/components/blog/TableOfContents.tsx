import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { List } from "lucide-react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  className?: string;
}

export function TableOfContents({ content, className }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Extract headings from markdown content
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const matches: TOCItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      matches.push({ id, text, level });
    }

    setHeadings(matches);
  }, [content]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0% -35% 0%", threshold: 0 }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  if (headings.length < 3) return null;

  return (
    <nav
      className={cn(
        "hidden lg:block sticky top-28 w-64 shrink-0 self-start",
        className
      )}
    >
      <div className="p-5 rounded-xl bg-muted/50 border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground">
          <List className="w-4 h-4" />
          <span>In This Article</span>
        </div>
        <ul className="space-y-1">
          {headings.map((heading) => (
            <li key={heading.id}>
              <button
                onClick={() => scrollToHeading(heading.id)}
                className={cn(
                  "text-left w-full text-sm py-1.5 px-3 rounded-md transition-all duration-200",
                  heading.level === 3 && "pl-6 text-xs",
                  activeId === heading.id
                    ? "bg-secondary/20 dark:bg-accent/20 text-secondary dark:text-accent font-medium border-l-2 border-secondary dark:border-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80 dark:hover:bg-muted/50"
                )}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
