import { motion } from "framer-motion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { BarChart3, Users, MapPin, TrendingUp, Tv } from "lucide-react";

const ReportPreview = () => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-20 px-4 bg-[#0a0f1a]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0] mb-3">
            What You'll Get
          </h2>
          <p className="text-[#94a3b8] max-w-lg mx-auto">
            A comprehensive audience opportunity report tailored to your market—free, in 2 minutes.
          </p>
        </motion.div>

        {/* Browser frame mockup */}
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="rounded-xl border border-[#1e2a45] bg-[#141b2d] overflow-hidden shadow-2xl shadow-blue-500/5">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0f1629] border-b border-[#1e2a45]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-[#1e2a45] rounded-md px-3 py-1 text-[10px] text-[#64748b] text-center">
                  app.mojo.co/report/your-organization
                </div>
              </div>
            </div>

            {/* Report content mockup */}
            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#64748b] uppercase tracking-wider">Audience Opportunity Report</div>
                  <div className="text-[#e2e8f0] font-bold text-lg mt-0.5">Your Organization</div>
                </div>
                <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  Ready
                </div>
              </div>

              {/* Stat row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { icon: Users, label: "Audience Size", value: "1.2M" },
                  { icon: MapPin, label: "Geo Reach", value: "47 States" },
                  { icon: Tv, label: "CTV Reach", value: "840K" },
                  { icon: TrendingUp, label: "Est. ROI", value: "3.2x" },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-lg bg-[#0a0f1a] border border-[#1e2a45]">
                    <s.icon className="h-3.5 w-3.5 text-blue-400 mb-1.5" />
                    <div className="text-[#e2e8f0] font-bold text-sm">{s.value}</div>
                    <div className="text-[#64748b] text-[10px]">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Channel breakdown bar chart mockup */}
              <div className="p-4 rounded-lg bg-[#0a0f1a] border border-[#1e2a45]">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[#e2e8f0] text-xs font-semibold">Channel Opportunity Breakdown</span>
                </div>
                <div className="space-y-2">
                  {[
                    { ch: "CTV / Streaming", pct: 85 },
                    { ch: "Digital Display", pct: 72 },
                    { ch: "Direct Mail", pct: 64 },
                    { ch: "Out-of-Home", pct: 48 },
                    { ch: "SMS", pct: 91 },
                  ].map((bar) => (
                    <div key={bar.ch} className="flex items-center gap-3">
                      <span className="text-[10px] text-[#94a3b8] w-20 flex-shrink-0">{bar.ch}</span>
                      <div className="flex-1 h-2 rounded-full bg-[#1e2a45] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                          initial={{ width: 0 }}
                          animate={isVisible ? { width: `${bar.pct}%` } : {}}
                          transition={{ duration: 0.8, delay: 0.4 }}
                        />
                      </div>
                      <span className="text-[10px] text-[#e2e8f0] font-semibold w-8 text-right">{bar.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ReportPreview;
