import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { Tv, Mail, MapPin, Monitor, Smartphone } from 'lucide-react';
import { V3Button } from '@/components/v3';

interface CommercialOpportunityStepProps {
  content?: VariantContent;
  selectedChannels: string[];
  onNext: () => void;
}

const CHANNEL_ICONS = [
  { id: 'ctv', icon: Tv, label: 'Streaming', color: 'text-blue-400' },
  { id: 'digital', icon: Monitor, label: 'Digital', color: 'text-purple-400' },
  { id: 'direct_mail', icon: Mail, label: 'Mailbox', color: 'text-emerald-400' },
  { id: 'ooh', icon: MapPin, label: 'Outdoor', color: 'text-amber-400' },
];

export default function CommercialOpportunityStep({ content, selectedChannels, onNext }: CommercialOpportunityStepProps) {
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
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-[#7c8ba3] text-sm"
      >
        Great choice. Here's your commercial market opportunity...
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h2 className="text-3xl font-bold text-[#e2e8f0] font-sans">{headline}</h2>
        <p className="text-[#94a3b8] text-lg">{subheadline}</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat: any, i: number) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="p-3 rounded-xl bg-[#141b2d] border border-[#1e2a45] min-h-[80px] flex flex-col items-center justify-center"
          >
            <p className="text-xl font-bold text-blue-400">{stat.value}</p>
            <p className="text-[#94a3b8] text-[11px] mt-1 leading-tight text-center">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-3"
      >
        <p className="text-[#7c8ba3] text-sm uppercase tracking-widest">Your Coverage</p>
        <div className="flex justify-center gap-4">
          {CHANNEL_ICONS.map(ch => {
            const isSelected = selectedChannels.includes(ch.id);
            return (
              <div key={ch.id} className={`text-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-25'}`}>
                <ch.icon className={`w-8 h-8 ${ch.color} mx-auto mb-1`} />
                <p className="text-[#94a3b8] text-[11px]">{ch.label}</p>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div>
        <V3Button variant="primary" size="xl" className="w-full min-h-[48px] !bg-blue-600 hover:!bg-blue-500 !text-white font-semibold rounded-lg shadow-lg shadow-blue-500/25" onClick={onNext}>
          {cta}
        </V3Button>
        <p className="text-[#94a3b8] text-sm mt-3 flex items-center justify-center gap-1">Next: See real results <span>→</span></p>
      </div>
    </div>
  );
}
