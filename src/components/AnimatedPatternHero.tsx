import { ReactNode, useEffect, useRef } from "react";

interface AnimatedPatternHeroProps {
  title: string;
  description: string;
  children?: ReactNode;
}

const AnimatedPatternHero = ({ title, description, children }: AnimatedPatternHeroProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const shapesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      
      if (svgRef.current) {
        // Parallax effect on SVG paths - slower movement
        svgRef.current.style.transform = `translateY(${scrolled * 0.3}px)`;
      }
      
      if (shapesRef.current) {
        // Parallax effect on floating shapes - medium speed
        shapesRef.current.style.transform = `translateY(${scrolled * 0.5}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative pt-28 md:pt-32 pb-20 md:pb-32 overflow-hidden">
      {/* Animated Pattern Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-secondary">
        {/* Vibrant Animated Circles */}
        <div className="absolute top-10 right-20 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-10 left-20 w-[500px] h-[500px] bg-destructive/25 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '2s' }} />
        
        {/* Animated SVG Path Drawings */}
        <svg ref={svgRef} className="absolute inset-0 w-full h-full opacity-30 transition-transform duration-100 ease-out" xmlns="http://www.w3.org/2000/svg">
          {/* Abstract Geometric Path 1 */}
          <path
            d="M 50 100 Q 150 50, 250 100 T 450 100 L 500 200 Q 450 250, 400 200 T 200 200 Z"
            fill="none"
            stroke="white"
            strokeWidth="2"
            className="animate-draw-path"
          />
          
          {/* Abstract Geometric Path 2 */}
          <path
            d="M 600 300 L 700 250 L 750 350 L 650 400 Z M 680 300 L 720 320 L 700 360 L 660 340 Z"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            className="animate-draw-path-delayed-1"
          />
          
          {/* Flowing Curve Path */}
          <path
            d="M 100 400 Q 200 350, 300 450 Q 400 550, 500 450 Q 600 350, 700 400"
            fill="none"
            stroke="white"
            strokeWidth="3"
            className="animate-draw-path-delayed-2"
            opacity="0.7"
          />
          
          {/* Complex Angular Pattern */}
          <path
            d="M 800 100 L 900 150 L 850 200 L 950 250 L 900 300 L 800 250 L 850 200 L 750 150 Z"
            fill="none"
            stroke="white"
            strokeWidth="2"
            className="animate-draw-path-delayed-3"
          />
          
          {/* Spiral-like Pattern */}
          <path
            d="M 200 600 Q 250 550, 300 600 Q 350 650, 400 600 Q 450 550, 500 600"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            className="animate-draw-path"
            opacity="0.6"
          />
          
          {/* Interconnected Triangles */}
          <path
            d="M 1000 400 L 1100 450 L 1050 550 Z M 1100 450 L 1150 400 L 1200 500 L 1050 550 Z"
            fill="none"
            stroke="white"
            strokeWidth="2"
            className="animate-draw-path-delayed-1"
          />
        </svg>
        
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
        <div ref={shapesRef} className="absolute inset-0 transition-transform duration-100 ease-out">
          <div className="absolute top-32 right-1/4 w-20 h-20 border-4 border-accent/40 rotate-45 animate-float" />
          <div className="absolute bottom-32 left-1/4 w-24 h-24 border-4 border-primary-foreground/30 rounded-full animate-float" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-accent/20 rotate-12 animate-float" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-1/3 right-1/4 w-32 h-32 border-4 border-destructive/30 animate-float" style={{ animationDelay: '2.5s' }} />
          <div className="absolute top-1/4 left-1/3 w-28 h-28 border-4 border-secondary/40 rounded-full animate-float" style={{ animationDelay: '3s' }} />
        </div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-[680px] backdrop-blur-md bg-black/20 border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl">
          <div className="space-y-6">
            <h1 className="font-bebas text-white drop-shadow-lg leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', letterSpacing: '0.02em' }}>
              {title}
            </h1>
            <p className="text-white/90 drop-shadow-md leading-relaxed" style={{ fontSize: 'clamp(1.125rem, 2vw, 1.25rem)' }}>
              {description}
            </p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnimatedPatternHero;
