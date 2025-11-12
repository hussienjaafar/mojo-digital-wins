import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

interface ParticleButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
  particleColor?: string;
  particleCount?: number;
}

export const ParticleButton = ({ 
  children, 
  className,
  particleColor = "hsl(var(--accent))",
  particleCount = 15,
  ...props 
}: ParticleButtonProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const particleIdRef = useRef(0);

  const createParticles = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const velocity = 2 + Math.random() * 2;
      
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 1,
        size: 2 + Math.random() * 3,
        color: particleColor,
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const button = buttonRef.current;
    if (!canvas || !button) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = button.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      setParticles(prevParticles => {
        const updatedParticles = prevParticles
          .map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vy: particle.vy + 0.1, // gravity
            life: particle.life - 0.02,
          }))
          .filter(particle => particle.life > 0);

        updatedParticles.forEach(particle => {
          ctx.globalAlpha = particle.life;
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        });

        return updatedParticles;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [particleColor]);

  // Update canvas size on window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const button = buttonRef.current;
      if (canvas && button) {
        const rect = button.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ width: "100%", height: "100%" }}
      />
      <Button
        ref={buttonRef}
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          isHovered && "shadow-lg scale-105",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseMove={createParticles}
        {...props}
      >
        <span className="relative z-10">{children}</span>
        
        {/* Ripple effect background */}
        {isHovered && (
          <span 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
            style={{
              backgroundSize: "200% 100%",
              animation: "shimmer 2s infinite",
            }}
          />
        )}
      </Button>
    </div>
  );
};
