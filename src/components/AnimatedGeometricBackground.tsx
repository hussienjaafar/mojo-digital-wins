import { useEffect, useRef } from "react";

export const AnimatedGeometricBackground = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const floatingShapesRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      
      if (svgRef.current) {
        const paths = svgRef.current.querySelectorAll('.parallax-path');
        paths.forEach((path, index) => {
          const speed = 0.3 + (index * 0.1);
          (path as SVGElement).style.transform = `translateY(${scrollY * speed}px)`;
        });
      }

      if (floatingShapesRef.current) {
        floatingShapesRef.current.style.transform = `translateY(${scrollY * 0.2}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hexagon Pattern Background */}
        <defs>
          <pattern id="hexPattern" x="0" y="0" width="100" height="86.6" patternUnits="userSpaceOnUse">
            <path
              d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z"
              fill="none"
              stroke="hsl(var(--primary-foreground))"
              strokeWidth="0.5"
              opacity="0.1"
            />
          </pattern>
          
          <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Hexagon Pattern Layer */}
        <rect width="100%" height="100%" fill="url(#hexPattern)" opacity="0.3" />

        {/* Floating Hexagons */}
        <g ref={floatingShapesRef}>
          <path
            d="M300 200 L360 230 L360 290 L300 320 L240 290 L240 230 Z"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
            opacity="0.3"
            className="animate-float"
            style={{ animationDelay: '0s' }}
          />
          <path
            d="M1500 150 L1580 190 L1580 270 L1500 310 L1420 270 L1420 190 Z"
            fill="hsl(var(--secondary))"
            fillOpacity="0.1"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="2"
            opacity="0.4"
            className="animate-float"
            style={{ animationDelay: '1s', animationDuration: '8s' }}
          />
          <path
            d="M1200 600 L1240 620 L1240 660 L1200 680 L1160 660 L1160 620 Z"
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth="2"
            opacity="0.4"
            className="animate-float"
            style={{ animationDelay: '2s', animationDuration: '10s' }}
          />
        </g>

        {/* Curved Paths with Parallax */}
        <path
          className="parallax-path animate-draw-path-slow"
          d="M-100 300 Q400 100 800 400 T1600 350 Q1800 320 2100 500"
          fill="none"
          stroke="url(#curveGradient)"
          strokeWidth="3"
          opacity="0.4"
        />
        <path
          className="parallax-path animate-draw-path"
          d="M-100 500 Q300 350 700 600 T1500 550 Q1700 520 2000 700"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="2"
          opacity="0.3"
        />
        <path
          className="parallax-path animate-draw-path-slow"
          d="M-100 700 Q500 550 900 800 T1700 750"
          fill="none"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="1.5"
          opacity="0.2"
        />

        {/* Complex Geometric Shapes */}
        {/* Star Shape */}
        <path
          d="M800 100 L820 150 L875 155 L835 190 L850 245 L800 215 L750 245 L765 190 L725 155 L780 150 Z"
          fill="hsl(var(--accent))"
          fillOpacity="0.15"
          className="animate-pulse-subtle"
          style={{ animationDuration: '4s' }}
        />
        
        {/* Pentagon */}
        <path
          d="M500 700 L560 680 L590 730 L540 780 L490 760 Z"
          fill="none"
          stroke="hsl(var(--destructive))"
          strokeWidth="2"
          opacity="0.3"
          className="animate-float"
          style={{ animationDelay: '1.5s', animationDuration: '9s' }}
        />

        {/* Triangle */}
        <path
          d="M1600 700 L1680 850 L1520 850 Z"
          fill="hsl(var(--secondary))"
          fillOpacity="0.1"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2"
          opacity="0.3"
          className="animate-pulse-subtle"
          style={{ animationDuration: '6s' }}
        />

        {/* Interconnected Polygon */}
        <path
          d="M200 800 L280 780 L320 850 L280 920 L200 900 L160 830 Z"
          fill="none"
          stroke="hsl(var(--accent))"
          strokeWidth="1.5"
          opacity="0.25"
          className="animate-float"
          style={{ animationDelay: '3s', animationDuration: '11s' }}
        />

        {/* Abstract Connected Lines */}
        <g opacity="0.2">
          <line x1="600" y1="200" x2="750" y2="300" stroke="hsl(var(--primary-foreground))" strokeWidth="1" className="animate-draw-path" />
          <line x1="750" y1="300" x2="850" y2="250" stroke="hsl(var(--primary-foreground))" strokeWidth="1" className="animate-draw-path" />
          <line x1="850" y1="250" x2="900" y2="400" stroke="hsl(var(--primary-foreground))" strokeWidth="1" className="animate-draw-path-slow" />
        </g>
      </svg>
    </div>
  );
};
