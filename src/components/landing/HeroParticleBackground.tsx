import { useRef, useEffect, useCallback } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

const COLORS = [
  "59, 130, 246",   // blue-500
  "96, 165, 250",   // blue-400
  "52, 211, 153",   // emerald-400
  "147, 197, 253",  // blue-300
];

const CONNECTION_DISTANCE = 150;
const MOUSE_RADIUS = 120;
const MOUSE_FORCE = 0.8;

const HeroParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const dimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const prefersReducedMotion = useReducedMotion();

  const getParticleCount = useCallback((width: number) => {
    if (width < 640) return 35;
    if (width < 1024) return 55;
    return 90;
  }, []);

  const createParticles = useCallback((width: number, height: number): Particle[] => {
    const count = getParticleCount(width);
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.5 + 0.8,
      opacity: Math.random() * 0.5 + 0.2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
  }, [getParticleCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dimensionsRef.current = { w: rect.width, h: rect.height };

      // Recreate particles on resize
      particlesRef.current = createParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    if (prefersReducedMotion) {
      // Draw static particles once
      const { w, h } = dimensionsRef.current;
      ctx.fillStyle = "#0a0f1a";
      ctx.fillRect(0, 0, w, h);
      drawGlowOrbs(ctx, w, h, 0);
      const particles = particlesRef.current;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
        ctx.fill();
      }
      drawConnections(ctx, particles);
      return () => {
        window.removeEventListener("resize", resize);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseleave", handleMouseLeave);
      };
    }

    let time = 0;

    const animate = () => {
      const { w, h } = dimensionsRef.current;
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Clear
      ctx.fillStyle = "#0a0f1a";
      ctx.fillRect(0, 0, w, h);

      // Background glow orbs
      time += 0.003;
      drawGlowOrbs(ctx, w, h, time);

      // Update particles
      for (const p of particles) {
        // Mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * MOUSE_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Drift back to base velocity
        if (Math.abs(p.vx) < 0.1) p.vx += (Math.random() - 0.5) * 0.02;
        if (Math.abs(p.vy) < 0.1) p.vy += (Math.random() - 0.5) * 0.02;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }

      // Draw connections
      drawConnections(ctx, particles);

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [prefersReducedMotion, createParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: "#0a0f1a" }}
    />
  );
};

function drawConnections(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONNECTION_DISTANCE) {
        const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.15;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

function drawGlowOrbs(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const orbs = [
    { cx: w * 0.25 + Math.sin(time * 0.7) * 40, cy: h * 0.3 + Math.cos(time * 0.5) * 30, r: Math.min(w, h) * 0.35, color: "59, 130, 246" },
    { cx: w * 0.75 + Math.cos(time * 0.6) * 50, cy: h * 0.7 + Math.sin(time * 0.8) * 35, r: Math.min(w, h) * 0.3, color: "52, 211, 153" },
    { cx: w * 0.5 + Math.sin(time * 0.4) * 30, cy: h * 0.5 + Math.cos(time * 0.3) * 25, r: Math.min(w, h) * 0.25, color: "96, 165, 250" },
  ];

  for (const orb of orbs) {
    const gradient = ctx.createRadialGradient(orb.cx, orb.cy, 0, orb.cx, orb.cy, orb.r);
    gradient.addColorStop(0, `rgba(${orb.color}, 0.06)`);
    gradient.addColorStop(1, `rgba(${orb.color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}

export default HeroParticleBackground;
