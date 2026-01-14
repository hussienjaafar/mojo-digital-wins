import { LucideIcon, Rocket, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { V3PageContainer, V3Card, V3CardContent } from "@/components/v3";
import { cn } from "@/lib/utils";

interface ClientComingSoonProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export function ClientComingSoon({ title, description, icon: Icon = Rocket }: ClientComingSoonProps) {
  return (
    <V3PageContainer
      title={title}
      description="Coming Soon"
      icon={Icon}
    >
      <V3Card accent="purple" className="max-w-2xl mx-auto">
        <V3CardContent className="py-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Animated Icon */}
            <motion.div
              animate={{ 
                y: [0, -8, 0],
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="inline-flex p-4 rounded-2xl bg-[hsl(var(--portal-accent-purple)/0.1)] border border-[hsl(var(--portal-accent-purple)/0.2)]"
            >
              <Rocket className="h-12 w-12 text-[hsl(var(--portal-accent-purple))]" />
            </motion.div>

            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                {title}
              </h2>
              <div className="flex items-center justify-center gap-2 text-[hsl(var(--portal-accent-purple))]">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Coming Soon</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-[hsl(var(--portal-text-secondary))] max-w-md mx-auto leading-relaxed">
              {description}
            </p>

            {/* Decorative Elements */}
            <div className="flex justify-center gap-2 pt-4">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[hsl(var(--portal-accent-purple)/0.4)]"
                  animate={{
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </V3CardContent>
      </V3Card>
    </V3PageContainer>
  );
}
