import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroParticleBackground from "./HeroParticleBackground";

interface HeroSectionProps {
  onCTA: () => void;
}

const HeroSection = ({ onCTA }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 pt-20 pb-16 overflow-hidden">
      {/* Interactive particle network background */}
      <HeroParticleBackground />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold tracking-wide text-blue-400 border border-blue-500/20 rounded-full bg-blue-500/5">
            <Users className="h-3.5 w-3.5" />
            Trusted by 50+ campaigns & organizations
          </span>
        </motion.div>

        <motion.h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#e2e8f0] leading-[1.1] tracking-tight mb-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          Stop Wasting Ad Spend on{" "}
          <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-emerald-400 bg-clip-text text-transparent">
            the Wrong Audience.
          </span>
        </motion.h1>

        <motion.p
          className="text-lg sm:text-xl text-[#94a3b8] max-w-2xl mx-auto mb-8 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          Get a free audience report showing exactly who to target across CTV, digital, direct mail, 
          OOH, and SMS—before you spend a dollar.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <Button
            size="xl"
            onClick={onCTA}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 text-base px-8 py-6 h-auto rounded-xl group"
          >
            Get My Free Report
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>

        {/* Risk reversal checklist */}
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[#94a3b8] text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          {["No credit card required", "Takes 2 minutes", "Your data stays private"].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400/70" />
              {item}
            </span>
          ))}
        </motion.div>

        {/* Social proof stat */}
        <motion.p
          className="mt-5 text-[#64748b] text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          $2.7M+ raised &middot; 13,500+ new donors acquired across client campaigns
        </motion.p>
      </div>
    </section>
  );
};

export default HeroSection;
