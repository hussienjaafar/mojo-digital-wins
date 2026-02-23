import { motion } from "framer-motion";
import { Tv, Globe, Mail, MapPin, MessageSquare } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const channels = [
  { icon: Tv, name: "CTV", desc: "Precision streaming ads across 100+ platforms" },
  { icon: Globe, name: "Digital", desc: "Programmatic display, video & native" },
  { icon: Mail, name: "Direct Mail", desc: "Data-driven mail with household targeting" },
  { icon: MapPin, name: "OOH", desc: "Out-of-home in high-impact locations" },
  { icon: MessageSquare, name: "SMS", desc: "Compliant peer-to-peer & broadcast text" },
];

const ChannelShowcase = () => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-20 px-4 bg-gradient-to-b from-[#0f1629] to-[#0a0f1a]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0] mb-3">Five Channels. One Platform.</h2>
          <p className="text-[#94a3b8] max-w-lg mx-auto">
            Reach your audience wherever they are—all from a single intelligence layer.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {channels.map((ch, i) => (
            <motion.div
              key={ch.name}
              className="p-5 rounded-xl border border-[#1e2a45] bg-[#141b2d]/50 hover:border-blue-500/30 transition-colors duration-300 text-center group"
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="w-10 h-10 mx-auto rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                <ch.icon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-[#e2e8f0] font-semibold text-sm mb-1">{ch.name}</div>
              <div className="text-[#64748b] text-xs leading-snug">{ch.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ChannelShowcase;
