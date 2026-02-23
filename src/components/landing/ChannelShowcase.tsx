import { motion } from "framer-motion";
import { Tv, Globe, Mail, MapPin, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import billboardWide from "@/assets/billboard-times-square-wide.jpg";
import smsMockup from "@/assets/sms-mockup.jpg";
import channelCtv from "@/assets/channel-ctv.jpg";
import channelDigital from "@/assets/channel-digital.jpg";
import channelDirectMail from "@/assets/channel-direct-mail.jpg";

const channels = [
  { icon: Tv, name: "CTV", desc: "Precision streaming ads across 100+ platforms", image: channelCtv },
  { icon: Globe, name: "Digital", desc: "Programmatic display, video & native", image: channelDigital },
  { icon: Mail, name: "Direct Mail", desc: "Data-driven mail with household targeting", image: channelDirectMail },
  { icon: MapPin, name: "OOH", desc: "Out-of-home in high-impact locations", image: billboardWide },
  { icon: MessageSquare, name: "SMS", desc: "Compliant peer-to-peer & broadcast text", image: smsMockup },
];

interface ChannelShowcaseProps {
  onCTA: () => void;
}

const ChannelShowcase = ({ onCTA }: ChannelShowcaseProps) => {
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
              className="p-5 rounded-xl border border-[#1e2a45] bg-[#141b2d]/50 hover:border-blue-500/30 transition-colors duration-300 text-center group overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="w-full h-20 rounded-lg overflow-hidden mb-3">
                <img
                  src={ch.image}
                  alt={`${ch.name} channel example`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="text-[#e2e8f0] font-semibold text-sm mb-1">{ch.name}</div>
              <div className="text-[#64748b] text-xs leading-snug">{ch.desc}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-10"
          initial={{ opacity: 0, y: 15 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.5 }}
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

export default ChannelShowcase;
