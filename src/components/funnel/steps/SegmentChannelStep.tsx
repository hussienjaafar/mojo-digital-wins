import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { Building2, Vote } from 'lucide-react';

interface SegmentChannelStepProps {
  content?: VariantContent;
  segment: string | null;
  selectedChannels: string[];
  onSegmentSelect: (segment: string) => void;
  onChannelsChange: (channels: string[]) => void;
  onNext: () => void;
}

const CHANNELS_BASE = [
  { id: 'ctv', label: 'CTV / Streaming' },
  { id: 'digital', label: 'Digital Ads' },
  { id: 'direct_mail', label: 'Direct Mailers' },
  { id: 'ooh', label: 'Billboards (OOH)' },
];

const SMS_CHANNEL = { id: 'sms', label: 'SMS Fundraising' };

export default function SegmentChannelStep({
  content,
  segment,
  selectedChannels,
  onSegmentSelect,
  onChannelsChange,
  onNext,
}: SegmentChannelStepProps) {
  const [localSegment, setLocalSegment] = useState(segment);

  const headline = content?.headline || 'How Can We Help You Win?';
  const subheadline = content?.subheadline || 'Choose your path to precision audience engagement.';
  const cta = content?.cta || 'Continue';

  const channels = localSegment === 'political'
    ? [...CHANNELS_BASE, SMS_CHANNEL]
    : CHANNELS_BASE;

  const handleSegment = (s: string) => {
    setLocalSegment(s);
    onSegmentSelect(s);
  };

  const toggleChannel = (id: string) => {
    const next = selectedChannels.includes(id)
      ? selectedChannels.filter(c => c !== id)
      : [...selectedChannels, id];
    onChannelsChange(next);
  };

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8 pb-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h2 className="text-3xl font-bold text-white">{headline}</h2>
        <p className="text-white/60 text-lg">{subheadline}</p>
      </motion.div>

      {/* Segment Cards */}
      <div className="space-y-4">
        <button
          onClick={() => handleSegment('commercial')}
          className={`w-full min-h-[72px] p-5 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
            localSegment === 'commercial'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-white/20 bg-white/5 hover:border-white/40'
          }`}
        >
          <Building2 className="w-8 h-8 text-blue-400 shrink-0" />
          <div>
            <p className="text-white font-semibold text-lg">Commercial Brand / Retailer</p>
            <p className="text-white/50 text-sm">CPG, Healthcare, Finance, Retail</p>
          </div>
        </button>

        <button
          onClick={() => handleSegment('political')}
          className={`w-full min-h-[72px] p-5 rounded-2xl border-2 transition-all flex items-center gap-4 text-left ${
            localSegment === 'political'
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-white/20 bg-white/5 hover:border-white/40'
          }`}
        >
          <Vote className="w-8 h-8 text-emerald-400 shrink-0" />
          <div>
            <p className="text-white font-semibold text-lg">Political Campaign / Non-Profit</p>
            <p className="text-white/50 text-sm">Campaigns, PACs, Advocacy, 501(c)</p>
          </div>
        </button>
      </div>

      {/* Channel Checklist */}
      <AnimatePresence>
        {localSegment && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <p className="text-white/80 font-medium text-left">
              Which pillars are in your 2026 work plan?
            </p>
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => toggleChannel(ch.id)}
                className={`w-full min-h-[48px] p-4 rounded-xl border transition-all flex items-center gap-3 text-left ${
                  selectedChannels.includes(ch.id)
                    ? 'border-blue-500/50 bg-blue-500/10 text-white'
                    : 'border-white/15 bg-white/5 text-white/70 hover:border-white/30'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    selectedChannels.includes(ch.id) ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                  }`}
                >
                  {selectedChannels.includes(ch.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-base">{ch.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {localSegment && selectedChannels.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <button
            onClick={onNext}
            className="w-full h-14 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-lg active:scale-[0.98] transition-all"
          >
            {cta}
          </button>
        </motion.div>
      )}
    </div>
  );
}
