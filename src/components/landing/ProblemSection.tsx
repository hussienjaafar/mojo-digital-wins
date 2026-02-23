import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const ProblemSection = () => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-16 px-4 bg-[#0a0f1a]">
      <motion.div
        className="max-w-4xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-10">
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
        </div>

        {/* Wasted vs Optimized Spend Visual */}
        <motion.div
          className="max-w-lg mx-auto mt-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="grid grid-cols-2 gap-4">
            {/* Without Mojo */}
            <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5">
              <div className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-3">Without data</div>
              <div className="space-y-2">
                {[
                  { label: "Wasted spend", pct: 42, color: "bg-red-500/60" },
                  { label: "Wrong audience", pct: 35, color: "bg-red-500/40" },
                  { label: "Actual ROI", pct: 12, color: "bg-red-500/30" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-[10px] text-[#94a3b8] mb-0.5">
                      <span>{bar.label}</span>
                      <span>{bar.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1e2a45] overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${bar.color}`}
                        initial={{ width: 0 }}
                        animate={isVisible ? { width: `${bar.pct}%` } : {}}
                        transition={{ duration: 0.8, delay: 0.4 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* With Mojo */}
            <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">With Mojo</div>
              <div className="space-y-2">
                {[
                  { label: "Precise targeting", pct: 92, color: "bg-emerald-500/60" },
                  { label: "Right audience", pct: 88, color: "bg-emerald-500/40" },
                  { label: "Avg ROI", pct: 75, color: "bg-emerald-500/30" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-[10px] text-[#94a3b8] mb-0.5">
                      <span>{bar.label}</span>
                      <span>{bar.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1e2a45] overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${bar.color}`}
                        initial={{ width: 0 }}
                        animate={isVisible ? { width: `${bar.pct}%` } : {}}
                        transition={{ duration: 0.8, delay: 0.6 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default ProblemSection;
