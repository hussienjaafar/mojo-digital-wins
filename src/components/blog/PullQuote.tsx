import { cn } from "@/lib/utils";

interface PullQuoteProps {
  children: React.ReactNode;
  author?: string;
  className?: string;
}

export function PullQuote({ children, author, className }: PullQuoteProps) {
  return (
    <blockquote
      className={cn(
        "my-12 px-8 py-8 relative",
        "border-none bg-transparent",
        className
      )}
    >
      {/* Decorative quote marks */}
      <span className="absolute -top-4 left-4 text-8xl font-serif text-secondary/20 leading-none select-none">
        "
      </span>
      <span className="absolute -bottom-12 right-4 text-8xl font-serif text-secondary/20 leading-none select-none rotate-180">
        "
      </span>
      
      <div className="relative z-10">
        <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed italic">
          {children}
        </p>
        {author && (
          <footer className="mt-4 text-sm text-muted-foreground font-medium">
            — {author}
          </footer>
        )}
      </div>
    </blockquote>
  );
}
