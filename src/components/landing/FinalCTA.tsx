import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface FinalCTAProps {
  onCTA: () => void;
}

const FinalCTA = ({ onCTA }: FinalCTAProps) => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-24 px-4 bg-gradient-to-b from-[#0a0f1a] to-[#0f1629]">
      <motion.div
        className="max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={isVisible ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#e2e8f0] mb-4">
          Ready to Reach Your Audience?
        </h2>
        <p className="text-[#94a3b8] text-lg mb-8 max-w-xl mx-auto">
          Get a free opportunity report with audience size, channel recommendations, and estimated reach—in under 2 minutes.
        </p>
        <Button
          size="xl"
          onClick={onCTA}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 text-base px-10 py-6 h-auto rounded-xl group"
        >
          Start Your Free Report
          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
        <p className="mt-4 text-[#64748b] text-sm">No credit card · No commitment · 2-minute setup</p>
      </motion.div>
    </section>
  );
};

export default FinalCTA;
