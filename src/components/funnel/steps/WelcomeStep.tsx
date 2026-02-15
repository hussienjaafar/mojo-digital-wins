import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { V3Button } from '@/components/v3';
import FunnelInput from '@/components/funnel/FunnelInput';
import { Check } from 'lucide-react';

interface WelcomeStepProps {
  content?: VariantContent;
  onNext: (email: string, organization: string) => void;
  onEmailBlur: (email: string, organization: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WelcomeStep({ content, onNext, onEmailBlur }: WelcomeStepProps) {
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  const headline = content?.headline || '$170.8 Billion. One Platform.';
  const subheadline = content?.subheadline || 'Reach the fastest-growing consumer market in America.';
  const cta = content?.cta || 'Get Started';

  const validateEmail = useCallback((val: string) => {
    if (!val.trim()) return '';
    return EMAIL_REGEX.test(val.trim()) ? '' : 'Enter a valid work email';
  }, []);

  const handleEmailBlur = () => {
    setEmailTouched(true);
    const err = validateEmail(email);
    setEmailError(err);
    if (!err && email.trim()) {
      onEmailBlur(email, organization);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const err = validateEmail(email);
    setEmailError(err);
    setEmailTouched(true);
    if (!err && email.trim()) {
      onNext(email.trim(), organization.trim());
    }
  };

  const isValid = email.trim() && !validateEmail(email);

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-[#e2e8f0] tracking-tight">
          {headline}
        </h1>
        <p className="text-[#94a3b8] text-lg">{subheadline}</p>
      </motion.div>

      {/* Social proof counter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-center gap-2 text-[#7c8ba3] text-sm"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>50+ organizations already onboarded</span>
        </span>
      </motion.div>

      {/* Value proposition checklist */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col items-start gap-2 max-w-xs mx-auto"
      >
        {[
          'Custom audience intelligence report',
          'Channel-specific recommendations',
          'ROI projection for your market',
        ].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-[#94a3b8] text-sm text-left">{item}</span>
          </div>
        ))}
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
        onSubmit={handleSubmit}
      >
        <FunnelInput
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="next"
          label="Work email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          error={emailTouched ? emailError : undefined}
          showValid={emailTouched && !emailError && !!email.trim()}
        />
        <FunnelInput
          type="text"
          autoComplete="organization"
          enterKeyHint="done"
          label="Organization name"
          value={organization}
          onChange={e => setOrganization(e.target.value)}
        />
        <V3Button
          type="submit"
          variant="primary"
          size="xl"
          className="w-full min-h-[48px]"
          disabled={!isValid}
        >
          {cta}
        </V3Button>
        <p className="text-[#7c8ba3] text-xs">Next: Choose your path</p>
      </motion.form>
    </div>
  );
}
