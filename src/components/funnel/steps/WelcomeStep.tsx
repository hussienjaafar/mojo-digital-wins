import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';

interface WelcomeStepProps {
  content?: VariantContent;
  onNext: (email: string, organization: string) => void;
  onEmailBlur: (email: string, organization: string) => void;
}

export default function WelcomeStep({ content, onNext, onEmailBlur }: WelcomeStepProps) {
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const headline = content?.headline || '$170.8 Billion. One Platform.';
  const subheadline = content?.subheadline || 'Reach the fastest-growing consumer market in America.';
  const cta = content?.cta || 'Get Started';

  const handleSubmit = () => {
    if (email.trim()) {
      onNext(email.trim(), organization.trim());
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8">
      {/* Video hero placeholder */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-white/5 border border-white/10">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
          poster=""
        >
          {/* Add video source when available */}
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1a] via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-white/90 text-sm font-medium bg-black/60 px-3 py-1 rounded inline-block">
            Precision Audience Intelligence
          </p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          {headline}
        </h1>
        <p className="text-white/60 text-lg">{subheadline}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-4"
      >
        <input
          ref={emailRef}
          type="email"
          placeholder="Work email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => onEmailBlur(email, organization)}
          className="w-full h-14 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-base"
        />
        <input
          type="text"
          placeholder="Organization name"
          value={organization}
          onChange={e => setOrganization(e.target.value)}
          className="w-full h-14 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-base"
        />
        <button
          onClick={handleSubmit}
          disabled={!email.trim()}
          className="w-full h-14 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-lg transition-all hover:from-blue-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {cta}
        </button>
      </motion.div>
    </div>
  );
}
