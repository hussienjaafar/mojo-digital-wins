import { motion } from "framer-motion";
import { Target, BarChart3, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: Target,
    number: "01",
    title: "Choose Your Path",
    description: "Select commercial or political, pick your channels, and define your audience.",
  },
  {
    icon: BarChart3,
    number: "02",
    title: "Get Audience Intelligence",
    description: "Receive a detailed opportunity report with audience size, reach estimates, and insights.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Launch Campaigns",
    description: "Activate across CTV, digital, direct mail, out-of-home, and SMS from one platform.",
  },
];

interface HowItWorksProps {
  onCTA: () => void;
}

const HowItWorks = ({ onCTA }: HowItWorksProps) => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-20 px-4 bg-gradient-to-b from-[#0a0f1a] to-[#0f1629]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0] mb-3">How It Works</h2>
          <p className="text-[#94a3b8] max-w-lg mx-auto">
            From audience selection to campaign launch in three simple steps.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className="relative p-8 rounded-2xl border border-[#1e2a45] bg-[#141b2d]/60 hover:border-blue-500/30 transition-colors duration-300 group"
              initial={{ opacity: 0, y: 30 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.15 }}
            >
              <div className="text-blue-500/20 text-6xl font-black absolute top-4 right-6 select-none">
                {step.number}
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/20 transition-colors">
                <step.icon className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">{step.title}</h3>
              <p className="text-[#94a3b8] text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0, y: 15 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Button
            size="lg"
            onClick={onCTA}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 rounded-xl group"
          >
            Get My Free Report
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
