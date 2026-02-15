import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { ShieldCheck, Store, Tv, Award } from 'lucide-react';
import { V3Button } from '@/components/v3';

interface CommercialProofStepProps {
  content?: VariantContent;
  onNext: () => void;
}

const BADGES = [
  { icon: ShieldCheck, label: 'HIPAA-Compliant Data', stat: '92% audience match rate', color: 'text-blue-400' },
  { icon: Store, label: 'Retail Media Network', stat: '340% avg ROAS lift', color: 'text-emerald-400' },
  { icon: Tv, label: 'Cultural CTV Precision', stat: 'HIPAA-certified since 2019', color: 'text-amber-400' },
];

export default function CommercialProofStep({ content, onNext }: CommercialProofStepProps) {
  const headline = content?.headline || 'Trusted by 50+ National Organizations';
  const subheadline = content?.subheadline || 'HIPAA-compliant data. Retail media integration. Cultural CTV precision.';
  const cta = content?.cta || "I'm Ready";

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h2 className="text-3xl font-bold text-[#e2e8f0]">{headline}</h2>
        <p className="text-[#94a3b8] text-lg">{subheadline}</p>
      </motion.div>

      <div className="space-y-3">
        {BADGES.map((badge, i) => (
          <motion.div
            key={badge.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-[#141b2d] border border-[#1e2a45]"
          >
            <badge.icon className={`w-8 h-8 ${badge.color} shrink-0`} />
            <div className="text-left flex-1">
              <span className="text-[#e2e8f0] font-medium block">{badge.label}</span>
              <span className="text-[#7c8ba3] text-xs">{badge.stat}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-center gap-2 text-[#7c8ba3] text-sm"
      >
        <Award className="w-4 h-4" />
        <span>Cultural Authenticity & Privacy Guarantee</span>
      </motion.div>

      <div>
        <V3Button variant="primary" size="xl" className="w-full min-h-[48px] !bg-blue-600 hover:!bg-blue-500 !text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25" onClick={onNext}>
          {cta}
        </V3Button>
        <p className="text-[#94a3b8] text-sm mt-3 flex items-center justify-center gap-1">Next: Qualify your strategy <span>→</span></p>
      </div>
    </div>
  );
}
