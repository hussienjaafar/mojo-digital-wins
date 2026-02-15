import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { ShieldCheck, FileCheck, CheckCircle, Award } from 'lucide-react';

interface PoliticalProofStepProps {
  content?: VariantContent;
  onNext: () => void;
}

const BADGES = [
  { icon: ShieldCheck, label: 'National Voter File', color: 'text-emerald-400' },
  { icon: FileCheck, label: 'FEC Compliant', color: 'text-blue-400' },
  { icon: CheckCircle, label: 'Campaign Verify', color: 'text-amber-400' },
];

export default function PoliticalProofStep({ content, onNext }: PoliticalProofStepProps) {
  const headline = content?.headline || 'Campaign-Grade Intelligence';
  const subheadline = content?.subheadline || 'National Voter File. FEC-compliant. Verified delivery.';
  const cta = content?.cta || 'Qualify My Campaign';

  // FEC REG 2011-02: 4-second minimum display timer
  const [disclaimerSeconds, setDisclaimerSeconds] = useState(4);
  const canProceed = disclaimerSeconds <= 0;

  useEffect(() => {
    if (disclaimerSeconds <= 0) return;
    const t = setTimeout(() => setDisclaimerSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [disclaimerSeconds]);

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

      {/* FEC REG 2011-02 Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <p className="text-amber-300/90 text-xs leading-relaxed">
          <strong>FEC Disclosure (REG 2011-02):</strong> All political advertising facilitated through this platform complies with Federal Election Commission regulations. Creative samples shown are for demonstration purposes. "Paid for by" disclaimers are required on all distributed materials.
        </p>
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
        disabled={!canProceed}
        className="w-full h-14 min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-lg active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {canProceed ? cta : `Please review disclaimer (${disclaimerSeconds}s)`}
      </button>
    </div>
  );
}
