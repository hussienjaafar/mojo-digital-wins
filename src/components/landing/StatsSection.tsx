import { motion } from "framer-motion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const stats = [
  { value: "$2.7M+", label: "Raised", description: "Across campaigns" },
  { value: "13,500+", label: "New Donors", description: "Acquired for clients" },
  { value: "5+", label: "Channels", description: "Omnichannel reach" },
  { value: "947%", label: "Peak ROI", description: "Unity & Justice Fund" },
];

const StatsSection = () => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-20 px-4 bg-[#0a0f1a]">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center p-6 rounded-xl border border-[#1e2a45] bg-[#141b2d]/50"
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-1">
                {stat.value}
              </div>
              <div className="text-[#e2e8f0] font-semibold text-sm mb-0.5">{stat.label}</div>
              <div className="text-[#64748b] text-xs">{stat.description}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
