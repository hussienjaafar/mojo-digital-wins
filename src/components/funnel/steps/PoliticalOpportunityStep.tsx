import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { Target, Mail, Zap } from 'lucide-react';
import { V3Button } from '@/components/v3';

interface PoliticalOpportunityStepProps {
  content?: VariantContent;
  onNext: () => void;
}

export default function PoliticalOpportunityStep({ content, onNext }: PoliticalOpportunityStepProps) {
  const headline = content?.headline || '1:1 Household Precision. Zero Guesswork.';
  const subheadline = content?.subheadline || 'Streaming reaches 33% more swing voters than linear TV.';
  const cta = content?.cta || 'See the Proof';
  const stats = (content?.body as any)?.stats || [
    { value: '33%', label: 'More Swing Voters via CTV' },
    { value: 'Tag 57', label: 'USPS Priority Delivery' },
    { value: '40%', label: 'Accuracy Tax Eliminated' },
  ];

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8">
      {/* Transition micro-copy */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[#7c8ba3] text-sm"
      >
        Based on your selection, here's your precision advantage...
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h2 className="text-3xl font-bold text-[#e2e8f0]">{headline}</h2>
        <p className="text-[#94a3b8] text-lg">{subheadline}</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="p-4 rounded-xl bg-[#141b2d] border border-[#1e2a45]"
          >
            <p className="text-2xl font-bold text-emerald-400">{stat.value}</p>
            <p className="text-[#94a3b8] text-xs mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3"
      >
        <p className="text-[#7c8ba3] text-sm uppercase tracking-widest">Precision Stack</p>
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <Target className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <p className="text-[#94a3b8] text-xs">Voter File</p>
          </div>
          <div className="text-center">
            <Mail className="w-8 h-8 text-blue-400 mx-auto mb-1" />
            <p className="text-[#94a3b8] text-xs">Tag 57 Mail</p>
          </div>
          <div className="text-center">
            <Zap className="w-8 h-8 text-amber-400 mx-auto mb-1" />
            <p className="text-[#94a3b8] text-xs">CTV Reach</p>
          </div>
        </div>
      </motion.div>

      <div>
        <V3Button variant="success" size="xl" className="w-full min-h-[48px] !bg-emerald-600 hover:!bg-emerald-500 !text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/25" onClick={onNext}>
          {cta}
        </V3Button>
        <p className="text-[#94a3b8] text-sm mt-3 flex items-center justify-center gap-1">Next: See the proof <span>→</span></p>
      </div>
    </div>
  );
}
