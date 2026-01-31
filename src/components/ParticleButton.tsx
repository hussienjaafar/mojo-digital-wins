import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
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

interface ParticleButtonProps {
  children: React.ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  particleColor?: string;
  particleCount?: number;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg" | "xl";
}

export const ParticleButton = ({ 
  children, 
  to,
  href,
  onClick,
  className,
  particleColor = "hsl(var(--accent))",
  particleCount = 15,
  variant = "default",
  size = "default",
}: ParticleButtonProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const particleIdRef = useRef(0);

  const createParticles = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
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

  const baseClasses = cn(
    "relative overflow-hidden transition-all duration-300 inline-flex items-center justify-center font-medium rounded-lg",
    isHovered && "shadow-lg scale-105",
    // Size variants
    size === "sm" && "px-4 h-9 text-sm",
    size === "default" && "px-6 h-10 text-base",
    size === "lg" && "px-8 h-12 text-base",
    size === "xl" && "px-10 h-14 text-lg",
    // Variant styles - using destructive (red) for primary CTA prominence in both modes
    variant === "default" && "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_4px_20px_hsl(var(--destructive)/0.4)] hover:shadow-[0_6px_30px_hsl(var(--destructive)/0.6)]",
    // Outline variant with better dark mode visibility
    variant === "outline" && "border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary dark:border-accent dark:text-accent dark:hover:bg-accent dark:hover:text-accent-foreground hover:shadow-[0_4px_20px_rgba(255,255,255,0.3)] dark:hover:shadow-[0_4px_20px_hsl(var(--accent)/0.4)]",
    className
  );

  const content = (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ width: "100%", height: "100%" }}
      />
      <span className="relative z-10">{children}</span>
      {isHovered && (
        <span 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
          style={{
            backgroundSize: "200% 100%",
            animation: "shimmer 2s infinite",
          }}
        />
      )}
    </>
  );

  const handlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onMouseMove: createParticles,
  };

  if (to) {
    return (
      <Link
        ref={buttonRef as React.RefObject<HTMLAnchorElement>}
        to={to}
        className={baseClasses}
        {...handlers}
      >
        {content}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        ref={buttonRef as React.RefObject<HTMLAnchorElement>}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClasses}
        {...handlers}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={buttonRef as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      className={baseClasses}
      {...handlers}
    >
      {content}
    </button>
  );
};
