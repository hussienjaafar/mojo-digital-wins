import { motion } from "framer-motion";
import { Building2, Landmark, ArrowRight } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import billboardWide from "@/assets/billboard-times-square-wide.jpg";
import heroRally from "@/assets/hero-movement-rally.jpg";

const segments = [
  {
    icon: Building2,
    title: "For Commercial",
    industries: "CPG · Retail · Healthcare · Entertainment · Financial Services",
    benefits: [
      "Consumer purchase intent modeling",
      "Competitive conquest targeting",
      "Omnichannel media activation",
      "Brand lift measurement",
    ],
    accent: "blue",
    bgImage: billboardWide,
  },
  {
    icon: Landmark,
    title: "For Political",
    industries: "Campaigns · PACs · Issue Advocacy · Ballot Measures · Party Committees",
    benefits: [
      "Voter file matching & enrichment",
      "Persuasion & turnout scoring",
      "FEC-compliant reporting",
      "Real-time donation attribution",
    ],
    accent: "emerald",
    bgImage: heroRally,
  },
];

const SegmentPreview = () => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-20 px-4 bg-[#0a0f1a]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0] mb-3">Built for Your World</h2>
          <p className="text-[#94a3b8] max-w-lg mx-auto">
            Purpose-built intelligence for commercial brands and political organizations.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {segments.map((seg, i) => {
            const borderColor = seg.accent === "blue" ? "border-blue-500/20 hover:border-blue-500/40" : "border-emerald-500/20 hover:border-emerald-500/40";
            const iconBg = seg.accent === "blue" ? "bg-blue-500/10" : "bg-emerald-500/10";
            const iconColor = seg.accent === "blue" ? "text-blue-400" : "text-emerald-400";
            const bulletColor = seg.accent === "blue" ? "text-blue-400" : "text-emerald-400";

            return (
              <motion.div
                key={seg.title}
                className={`relative p-8 rounded-2xl border ${borderColor} overflow-hidden transition-colors duration-300`}
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                {/* Background image with dark overlay */}
                <div className="absolute inset-0">
                  <img
                    src={seg.bgImage}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-[#141b2d]/90" />
                </div>

                {/* Content */}
                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mb-5`}>
                    <seg.icon className={`h-6 w-6 ${iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-[#e2e8f0] mb-2">{seg.title}</h3>
                  <p className="text-[#64748b] text-sm mb-5">{seg.industries}</p>
                  <ul className="space-y-2.5">
                    {seg.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-[#94a3b8]">
                        <ArrowRight className={`h-4 w-4 mt-0.5 flex-shrink-0 ${bulletColor}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SegmentPreview;
