import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InternalLinkCardProps {
  href: string;
  title: string;
  description?: string;
  className?: string;
}

export function InternalLinkCard({ href, title, description, className }: InternalLinkCardProps) {
  const isExternal = href.startsWith("http");
  
  const content = (
    <div
      className={cn(
        "group my-8 p-6 rounded-xl border border-border/50 bg-card/50",
        "hover:border-secondary/50 hover:bg-secondary/5 transition-all duration-300",
        "cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-secondary uppercase tracking-wider mb-1 block">
            Recommended Reading
          </span>
          <h4 className="font-bebas text-xl text-foreground group-hover:text-secondary transition-colors truncate">
            {title}
          </h4>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
            <ArrowRight className="w-5 h-5 text-secondary group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link to={href}>{content}</Link>;
}
