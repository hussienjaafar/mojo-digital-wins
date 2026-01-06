import { Twitter, Linkedin, Mail, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ShareButtonsProps {
  title: string;
  url: string;
  className?: string;
}

export function ShareButtons({ title, url, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=Check out this article: ${encodedUrl}`,
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground mr-1 hidden sm:inline">Share:</span>
      <Button
        variant="ghost"
        size="icon"
        className="w-9 h-9 rounded-full hover:bg-secondary/10 dark:hover:bg-accent/10 hover:text-secondary dark:hover:text-accent"
        asChild
      >
        <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter">
          <Twitter className="w-4 h-4" />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-9 h-9 rounded-full hover:bg-secondary/10 dark:hover:bg-accent/10 hover:text-secondary dark:hover:text-accent"
        asChild
      >
        <a href={shareLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">
          <Linkedin className="w-4 h-4" />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-9 h-9 rounded-full hover:bg-secondary/10 dark:hover:bg-accent/10 hover:text-secondary dark:hover:text-accent"
        asChild
      >
        <a href={shareLinks.email} aria-label="Share via Email">
          <Mail className="w-4 h-4" />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="w-9 h-9 rounded-full hover:bg-secondary/10 dark:hover:bg-accent/10 hover:text-secondary dark:hover:text-accent"
        onClick={copyToClipboard}
        aria-label="Copy link"
      >
        {copied ? <Check className="w-4 h-4 text-status-success" /> : <Link2 className="w-4 h-4" />}
      </Button>
    </div>
  );
}
