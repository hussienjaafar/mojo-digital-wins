import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthorBioProps {
  author: string;
}

export function AuthorBio({ author }: AuthorBioProps) {
  return (
    <div className="mt-16 p-8 rounded-2xl bg-muted/50 border border-border/50">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* Logo/Avatar */}
        <div className="shrink-0">
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-2xl font-bebas text-primary-foreground tracking-wider">
              M
            </span>
          </div>
        </div>

        {/* Bio Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">
              About the Author
            </span>
          </div>
          <h3 className="font-bebas text-2xl text-foreground mb-3">
            {author}
          </h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Molitico is a full-service digital strategy firm specializing in progressive 
            campaigns, advocacy organizations, and nonprofits. We've helped raise over 
            $50M for causes that matter and won races across America.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/about">
              <Button variant="outline" size="sm" className="group">
                About Us
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="default" size="sm" className="group">
                Work With Us
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
