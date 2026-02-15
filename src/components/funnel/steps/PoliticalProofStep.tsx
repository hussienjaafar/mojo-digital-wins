import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { ShieldCheck, FileCheck, CheckCircle, Award } from 'lucide-react';
import { V3Button } from '@/components/v3';

interface PoliticalProofStepProps {
  content?: VariantContent;
  onNext: () => void;
}

const BADGES = [
  { icon: ShieldCheck, label: 'National Voter File', stat: '2.1M voter records matched', color: 'text-emerald-400' },
  { icon: FileCheck, label: 'FEC Compliant', stat: 'FEC audit-ready compliance', color: 'text-blue-400' },
  { icon: CheckCircle, label: 'Campaign Verify', stat: '33% more swing voters reached', color: 'text-amber-400' },
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
        className="flex items-center justify-center gap-2 text-[#7c8ba3] text-sm"
      >
        <Award className="w-4 h-4" />
        <span>Cultural Authenticity & Privacy Guarantee</span>
      </motion.div>

      <div>
        <V3Button
          variant="success"
          size="xl"
          className="w-full min-h-[48px] !bg-emerald-600 hover:!bg-emerald-500 !text-white font-semibold rounded-lg shadow-lg shadow-emerald-500/25"
          onClick={onNext}
          disabled={!canProceed}
        >
          {canProceed ? cta : `Please review disclaimer (${disclaimerSeconds}s)`}
        </V3Button>
        {canProceed && <p className="text-[#94a3b8] text-sm mt-3 flex items-center justify-center gap-1">Next: Build your custom plan <span>→</span></p>}
      </div>
    </div>
  );
}
