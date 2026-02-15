import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { ShieldCheck, Store, Tv, Award } from 'lucide-react';

interface CommercialProofStepProps {
  content?: VariantContent;
  onNext: () => void;
}

const BADGES = [
  { icon: ShieldCheck, label: 'HIPAA-Compliant Data', color: 'text-blue-400' },
  { icon: Store, label: 'Retail Media Network', color: 'text-emerald-400' },
  { icon: Tv, label: 'Cultural CTV Precision', color: 'text-amber-400' },
];

export default function CommercialProofStep({ content, onNext }: CommercialProofStepProps) {
  const headline = content?.headline || 'Trusted by 50+ National Organizations';
  const subheadline = content?.subheadline || 'HIPAA-compliant data. Retail media integration. Cultural CTV precision.';
  const cta = content?.cta || "I'm Ready";

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h2 className="text-3xl font-bold text-white">{headline}</h2>
        <p className="text-white/60 text-lg">{subheadline}</p>
      </motion.div>

      <div className="space-y-3">
        {BADGES.map((badge, i) => (
          <motion.div
            key={badge.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
          >
            <badge.icon className={`w-8 h-8 ${badge.color} shrink-0`} />
            <span className="text-white font-medium text-left">{badge.label}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-center gap-2 text-white/40 text-sm"
      >
        <Award className="w-4 h-4" />
        <span>Cultural Authenticity & Privacy Guarantee</span>
      </motion.div>

      <button
        onClick={onNext}
        className="w-full h-14 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-lg active:scale-[0.98] transition-all"
      >
        {cta}
      </button>
    </div>
  );
}
