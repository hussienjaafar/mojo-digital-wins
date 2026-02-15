import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { z } from 'zod';
import { V3Button } from '@/components/v3';
import { FUNNEL_INPUT } from '@/components/funnel/funnelTheme';

interface QualificationStepProps {
  content?: VariantContent;
  segment: string | null;
  selectedChannels: string[];
  prefillEmail: string;
  prefillOrg: string;
  onSubmit: (data: QualificationData) => void;
  onFieldFocus?: (fieldName: string) => void;
  onFieldBlur?: (fieldName: string, hadError: boolean) => void;
}

export interface QualificationData {
  name: string;
  email: string;
  organization: string;
  role: string;
  isDecisionMaker: boolean;
  buyingAuthorityInfo: string;
  performanceKpis: string[];
  budgetRange: string;
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Valid email required').max(255),
  organization: z.string().trim().min(1, 'Organization is required').max(200),
  role: z.string().trim().min(1, 'Role is required').max(100),
  buyingAuthorityInfo: z.string().max(500).optional(),
});

const COMMERCIAL_KPIS = [
  'ROAS',
  'Cost Per Acquisition',
  'Cost Per Verified Patient',
  'Brand Lift',
];

const POLITICAL_KPIS = [
  'Voter Persuasion Lift',
  'Donor Lifetime Value',
  'Cost Per Acquisition',
  'Voter Registration Rate',
];

// Reverse anchoring: highest first
const BUDGET_OPTIONS = [
  { value: '$50k+', label: '$50k+', color: 'from-amber-600 to-amber-500', ring: 'ring-amber-500/50' },
  { value: '$10k-$50k', label: '$10k – $50k', color: 'from-emerald-600 to-emerald-500', ring: 'ring-emerald-500/50' },
  { value: '$5k-$10k', label: '$5k – $10k', color: 'from-blue-600 to-blue-500', ring: 'ring-blue-500/50' },
];

export default function QualificationStep({
  content,
  segment,
  selectedChannels,
  prefillEmail,
  prefillOrg,
  onSubmit,
  onFieldFocus,
  onFieldBlur,
}: QualificationStepProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(prefillEmail);
  const [organization, setOrganization] = useState(prefillOrg);
  const [role, setRole] = useState('');
  const [isDecisionMaker, setIsDecisionMaker] = useState(false);
  const [buyingAuthority, setBuyingAuthority] = useState('');
  const [kpis, setKpis] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prefillEmail && !email) setEmail(prefillEmail);
    if (prefillOrg && !organization) setOrganization(prefillOrg);
  }, [prefillEmail, prefillOrg]);

  const headline = content?.headline || "Let's Build Your Strategy";
  const cta = content?.cta || 'Submit & Connect';
  const kpiOptions = segment === 'political' ? POLITICAL_KPIS : COMMERCIAL_KPIS;

  const toggleKpi = (kpi: string) => {
    setKpis(prev => prev.includes(kpi) ? prev.filter(k => k !== kpi) : [...prev, kpi]);
  };

  const handleFieldBlur = (fieldName: string) => {
    const hasError = !!errors[fieldName];
    onFieldBlur?.(fieldName, hasError);
  };

  const handleSubmit = () => {
    const result = schema.safeParse({ name, email, organization, role, buyingAuthorityInfo: buyingAuthority });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    if (!budget) {
      setErrors({ budget: 'Select a budget range' });
      return;
    }
    setErrors({});
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      organization: organization.trim(),
      role: role.trim(),
      isDecisionMaker,
      buyingAuthorityInfo: buyingAuthority.trim(),
      performanceKpis: kpis,
      budgetRange: budget,
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-6 overflow-y-auto max-h-[calc(100vh-120px)] pb-20 px-1 scrollbar-thin scrollbar-thumb-[#1e2a45]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-[#e2e8f0]">{headline}</h2>
      </motion.div>

      <div className="space-y-4">
        <div>
          <input
            type="text"
            autoComplete="name"
            enterKeyHint="next"
            placeholder="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={() => onFieldFocus?.('name')}
            onBlur={() => handleFieldBlur('name')}
            className={FUNNEL_INPUT}
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            placeholder="Work email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onFocus={() => onFieldFocus?.('email')}
            onBlur={() => handleFieldBlur('email')}
            className={FUNNEL_INPUT}
          />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </div>
        <div>
          <input
            type="text"
            autoComplete="organization"
            enterKeyHint="next"
            placeholder="Organization"
            value={organization}
            onChange={e => setOrganization(e.target.value)}
            onFocus={() => onFieldFocus?.('organization')}
            onBlur={() => handleFieldBlur('organization')}
            className={FUNNEL_INPUT}
          />
          {errors.organization && <p className="text-red-400 text-xs mt-1">{errors.organization}</p>}
        </div>
        <div>
          <input
            type="text"
            autoComplete="organization-title"
            enterKeyHint="next"
            placeholder="Your role"
            value={role}
            onChange={e => setRole(e.target.value)}
            onFocus={() => onFieldFocus?.('role')}
            onBlur={() => handleFieldBlur('role')}
            className={FUNNEL_INPUT}
          />
          {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role}</p>}
        </div>

        {/* Decision Maker Toggle */}
        <button
          onClick={() => setIsDecisionMaker(!isDecisionMaker)}
          className={`w-full min-h-[48px] p-4 rounded-xl border transition-all flex items-center justify-between ${
            isDecisionMaker ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#1e2a45] bg-[#141b2d]'
          }`}
        >
          <span className="text-[#e2e8f0] text-base">Are you a decision maker?</span>
          <div className={`w-12 h-7 rounded-full transition-all relative ${isDecisionMaker ? 'bg-blue-500' : 'bg-[#1e2a45]'}`}>
            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${isDecisionMaker ? 'left-6' : 'left-1'}`} />
          </div>
        </button>

        <div>
          <input
            type="text"
            enterKeyHint="next"
            placeholder="Who else is involved in decisions?"
            value={buyingAuthority}
            onChange={e => setBuyingAuthority(e.target.value)}
            onFocus={() => onFieldFocus?.('buyingAuthority')}
            onBlur={() => handleFieldBlur('buyingAuthority')}
            className={FUNNEL_INPUT}
          />
        </div>

        {/* KPI Multi-select */}
        <div className="space-y-2">
          <p className="text-[#94a3b8] text-sm font-medium">Primary performance KPI(s)</p>
          {kpiOptions.map(kpi => (
            <button
              key={kpi}
              onClick={() => toggleKpi(kpi)}
              className={`w-full min-h-[48px] p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                kpis.includes(kpi) ? 'border-blue-500/50 bg-blue-500/10 text-[#e2e8f0]' : 'border-[#1e2a45] bg-[#141b2d] text-[#94a3b8]'
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                kpis.includes(kpi) ? 'border-blue-500 bg-blue-500' : 'border-[#1e2a45]'
              }`}>
                {kpis.includes(kpi) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm">{kpi}</span>
            </button>
          ))}
        </div>

        {/* Budget Selection — reverse anchored (highest first) */}
        <div className="space-y-2">
          <p className="text-[#94a3b8] text-sm font-medium">Budget range</p>
          <div className="space-y-3">
            {BUDGET_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setBudget(opt.value)}
                className={`w-full h-16 min-h-[48px] rounded-xl font-semibold text-lg text-white transition-all active:scale-[0.98] ${
                  budget === opt.value
                    ? `bg-gradient-to-r ${opt.color} ring-2 ${opt.ring}`
                    : 'bg-[#141b2d] border border-[#1e2a45] hover:border-[#2d3b55]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {errors.budget && <p className="text-red-400 text-xs mt-1">{errors.budget}</p>}
          {/* Scarcity micro-copy */}
          <p className="text-[#64748b] text-xs text-center mt-2">
            Limited Q1 2026 onboarding slots remaining
          </p>
        </div>
      </div>

      <V3Button variant="primary" size="xl" className="w-full min-h-[48px]" onClick={handleSubmit}>
        {cta}
      </V3Button>
    </div>
  );
}
