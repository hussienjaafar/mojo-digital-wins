import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { Tv, Mail, MapPin } from 'lucide-react';

interface CommercialOpportunityStepProps {
  content?: VariantContent;
  onNext: () => void;
}

export default function CommercialOpportunityStep({ content, onNext }: CommercialOpportunityStepProps) {
  const headline = content?.headline || 'Generation M Meets Total Market Saturation';
  const subheadline = content?.subheadline || '26% are aged 18–24. 92% say cultural relevance drives purchase decisions.';
  const cta = content?.cta || 'See the Proof';
  const stats = (content?.body as any)?.stats || [
    { value: '$170.8B', label: 'Annual Spending Power' },
    { value: '26%', label: 'Aged 18-24' },
    { value: '92%', label: 'Cultural Relevance Factor' },
  ];

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h2 className="text-3xl font-bold text-white">{headline}</h2>
        <p className="text-white/60 text-lg">{subheadline}</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="p-4 rounded-2xl bg-white/5 border border-white/10"
          >
            <p className="text-2xl font-bold text-blue-400">{stat.value}</p>
            <p className="text-white/50 text-xs mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Omnichannel Coverage */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3"
      >
        <p className="text-white/40 text-sm uppercase tracking-widest">Total Coverage</p>
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <Tv className="w-8 h-8 text-blue-400 mx-auto mb-1" />
            <p className="text-white/60 text-xs">TV Screen</p>
          </div>
          <div className="text-center">
            <Mail className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <p className="text-white/60 text-xs">Mailbox</p>
          </div>
          <div className="text-center">
            <MapPin className="w-8 h-8 text-amber-400 mx-auto mb-1" />
            <p className="text-white/60 text-xs">Commute</p>
          </div>
        </div>
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
