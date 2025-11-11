import { ReactNode } from "react";

interface AnimatedPatternHeroProps {
  title: string;
  description: string;
  children?: ReactNode;
}

const AnimatedPatternHero = ({ title, description, children }: AnimatedPatternHeroProps) => {
  return (
    <section className="relative pt-28 md:pt-32 pb-20 md:pb-32 overflow-hidden">
      {/* Animated Pattern Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted to-background">
        {/* Animated Circles */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '2s' }} />
        
        {/* Geometric Shapes */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        
        {/* Floating Shapes */}
        <div className="absolute top-40 right-1/4 w-16 h-16 border-2 border-primary/20 rotate-45 animate-float" />
        <div className="absolute bottom-40 left-1/4 w-20 h-20 border-2 border-secondary/20 rounded-full animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/3 right-1/3 w-12 h-12 bg-accent/10 rotate-12 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-[680px] space-y-6">
          <h1 className="font-bebas text-foreground leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', letterSpacing: '0.02em' }}>
            {title}
          </h1>
          <p className="text-muted-foreground leading-relaxed" style={{ fontSize: 'clamp(1.125rem, 2vw, 1.25rem)' }}>
            {description}
          </p>
          {children}
        </div>
      </div>
    </section>
  );
};

export default AnimatedPatternHero;
