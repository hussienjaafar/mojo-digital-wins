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
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-secondary">
        {/* Vibrant Animated Circles */}
        <div className="absolute top-10 right-20 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-10 left-20 w-[500px] h-[500px] bg-destructive/25 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '2s' }} />
        
        {/* Grid Pattern Overlay */}
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary-foreground" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        
        {/* Floating Geometric Shapes */}
        <div className="absolute top-32 right-1/4 w-20 h-20 border-4 border-accent/40 rotate-45 animate-float" />
        <div className="absolute bottom-32 left-1/4 w-24 h-24 border-4 border-primary-foreground/30 rounded-full animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-accent/20 rotate-12 animate-float" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-32 h-32 border-4 border-destructive/30 animate-float" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-1/4 left-1/3 w-28 h-28 border-4 border-secondary/40 rounded-full animate-float" style={{ animationDelay: '3s' }} />
        
        {/* Diagonal Lines */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          <div className="absolute top-0 left-1/4 w-1 h-full bg-primary-foreground rotate-12" />
          <div className="absolute top-0 right-1/3 w-1 h-full bg-primary-foreground -rotate-12" />
        </div>
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
