import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { CalendarClock, ExternalLink } from 'lucide-react';

interface ThankYouStepProps {
  content?: VariantContent;
  redirectToCalendar: boolean;
  leadScore: number;
}

const CALENDLY_URL = 'https://calendly.com'; // Replace with actual Calendly URL

export default function ThankYouStep({ content, redirectToCalendar, leadScore }: ThankYouStepProps) {
  const [countdown, setCountdown] = useState(redirectToCalendar ? 1.5 : 0);

  const headline = redirectToCalendar
    ? 'Connecting You With Our Team...'
    : content?.headline || "Welcome to the Inner Circle";
  const subheadline = redirectToCalendar
    ? 'Redirecting to schedule your strategy session.'
    : content?.subheadline || "We'll be in touch within 24 hours with a tailored strategy.";

  useEffect(() => {
    if (!redirectToCalendar) return;
    const timer = setTimeout(() => {
      window.location.href = CALENDLY_URL;
    }, 1500);
    return () => clearTimeout(timer);
  }, [redirectToCalendar]);

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
        className="space-y-4"
      >
        {redirectToCalendar ? (
          <div className="w-20 h-20 rounded-full bg-[#141b2d] border border-[#1e2a45] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CalendarClock className="w-10 h-10 text-emerald-400 animate-pulse" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-[#141b2d] border border-[#1e2a45] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        <h2 className="text-3xl font-bold text-[#e2e8f0]">{headline}</h2>
        <p className="text-[#94a3b8] text-lg">{subheadline}</p>
      </motion.div>

      {!redirectToCalendar && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <p className="text-[#64748b] text-sm">Connect with us</p>
          <div className="flex justify-center gap-6">
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-[#64748b] hover:text-[#e2e8f0] transition-colors">
              <ExternalLink className="w-6 h-6" />
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
