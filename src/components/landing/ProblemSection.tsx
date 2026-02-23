import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const ProblemSection = () => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-16 px-4 bg-[#0a0f1a]">
      <motion.div
        className="max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-5">
          <AlertTriangle className="h-3.5 w-3.5" />
          The Problem
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#e2e8f0] mb-4 leading-tight">
          Most campaigns waste 40%+ of media spend on audiences that will never convert.
        </h2>
        <p className="text-[#94a3b8] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Without data-driven audience intelligence, you're guessing who to target, which channels to use, 
          and how much to spend. The result? Burned budgets, missed donors, and lost customers.
        </p>
      </motion.div>
    </section>
  );
};

export default ProblemSection;
