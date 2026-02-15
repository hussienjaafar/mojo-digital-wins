import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VariantContent } from '@/hooks/useFunnelVariants';
import { z } from 'zod';
import { V3Button } from '@/components/v3';
import FunnelInput from '@/components/funnel/FunnelInput';
import { Check, ChevronDown } from 'lucide-react';

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

const BUDGET_OPTIONS = [
  { value: '$50k+', label: '$50k+', color: 'from-amber-600 to-amber-500', ring: 'ring-amber-500/50' },
  { value: '$10k-$50k', label: '$10k – $50k', color: 'from-emerald-600 to-emerald-500', ring: 'ring-emerald-500/50' },
  { value: '$5k-$10k', label: '$5k – $10k', color: 'from-blue-600 to-blue-500', ring: 'ring-blue-500/50' },
];

const CHANNEL_LABELS: Record<string, string> = {
  ctv: 'CTV / Streaming',
  digital: 'Digital Ads',
  direct_mail: 'Direct Mailers',
  ooh: 'Billboards (OOH)',
  sms: 'SMS Fundraising',
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [section2Visited, setSection2Visited] = useState(false);
  const [section3Visited, setSection3Visited] = useState(false);

  useEffect(() => {
    if (prefillEmail && !email) setEmail(prefillEmail);
    if (prefillOrg && !organization) setOrganization(prefillOrg);
  }, [prefillEmail, prefillOrg]);

  // Track section visits
  useEffect(() => {
    if (activeSection >= 1) setSection2Visited(true);
    if (activeSection >= 2) setSection3Visited(true);
  }, [activeSection]);

  const headline = content?.headline || "Let's Build Your Strategy";
  const cta = content?.cta || 'Submit & Connect';
  const kpiOptions = segment === 'political' ? POLITICAL_KPIS : COMMERCIAL_KPIS;
  const isPolitical = segment === 'political';

  // Segment-aware accent colors
  const accentBorderActive = isPolitical ? 'border-emerald-500/40' : 'border-blue-500/40';
  const accentBg = isPolitical ? 'bg-emerald-500/10' : 'bg-blue-500/10';
  const accentBorder = isPolitical ? 'border-emerald-500/50' : 'border-blue-500/50';
  const accentCheckBg = isPolitical ? 'border-emerald-500 bg-emerald-500' : 'border-blue-500 bg-blue-500';
  const accentToggle = isPolitical ? 'bg-emerald-500' : 'bg-blue-500';
  const ctaClasses = isPolitical
    ? '!bg-emerald-600 hover:!bg-emerald-500 shadow-emerald-500/25'
    : '!bg-blue-600 hover:!bg-blue-500 shadow-blue-500/25';
  const continueClasses = isPolitical
    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20';

  const toggleKpi = (kpi: string) => {
    setKpis(prev => prev.includes(kpi) ? prev.filter(k => k !== kpi) : [...prev, kpi]);
  };

  const handleFieldBlur = (fieldName: string) => {
    const hasError = !!errors[fieldName];
    onFieldBlur?.(fieldName, hasError);
  };

  const section1Complete = name.trim() && email.trim() && organization.trim() && role.trim();
  const section2Complete = section2Visited;
  const allSectionsReady = section1Complete && section2Visited && section3Visited;

  const handleSubmit = async () => {
    const result = schema.safeParse({ name, email, organization, role, buyingAuthorityInfo: buyingAuthority });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      if (fieldErrors.name || fieldErrors.email || fieldErrors.organization || fieldErrors.role) {
        setActiveSection(0);
      }
      return;
    }
    if (!budget) {
      setErrors({ budget: 'Select a budget range' });
      setActiveSection(2);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        organization: organization.trim(),
        role: role.trim(),
        isDecisionMaker,
        buyingAuthorityInfo: buyingAuthority.trim(),
        performanceKpis: kpis,
        budgetRange: budget,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const channelLabels = selectedChannels.map(id => CHANNEL_LABELS[id] || id).join(', ');

  return (
    <div className="w-full max-w-lg mx-auto space-y-5 overflow-y-auto max-h-[calc(100vh-120px)] pb-20 px-1 scrollbar-thin scrollbar-thumb-[#1e2a45]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-[#e2e8f0]">{headline}</h2>
      </motion.div>

      {/* Section 1: About You */}
      <div className={`rounded-xl border overflow-hidden transition-colors ${activeSection === 0 ? accentBorderActive : 'border-[#1e2a45]'}`}>
        <button
          onClick={() => setActiveSection(activeSection === 0 ? -1 : 0)}
          className="w-full flex items-center justify-between p-4 bg-[#141b2d] text-left hover:bg-[#182036] transition-colors"
        >
          <div className="flex items-center gap-3">
            {section1Complete ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </motion.div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-[#1e2a45] flex items-center justify-center">
                <span className="text-[10px] text-[#7c8ba3]">1</span>
              </div>
            )}
            <span className="text-[#e2e8f0] font-medium text-sm">About You</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#7c8ba3] transition-transform ${activeSection === 0 ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {activeSection === 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 bg-[#0d1321]">
                <FunnelInput
                  type="text" autoComplete="name" enterKeyHint="next" label="Full name" value={name}
                  onChange={e => setName(e.target.value)}
                  onFocus={() => onFieldFocus?.('name')}
                  onBlur={() => handleFieldBlur('name')}
                  error={errors.name}
                />
                <FunnelInput
                  type="email" inputMode="email" autoComplete="email" enterKeyHint="next" label="Work email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => onFieldFocus?.('email')}
                  onBlur={() => handleFieldBlur('email')}
                  error={errors.email}
                />
                <FunnelInput
                  type="text" autoComplete="organization" enterKeyHint="next" label="Organization" value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  onFocus={() => onFieldFocus?.('organization')}
                  onBlur={() => handleFieldBlur('organization')}
                  error={errors.organization}
                />
                <FunnelInput
                  type="text" autoComplete="organization-title" enterKeyHint="next" label="Your role" value={role}
                  onChange={e => setRole(e.target.value)}
                  onFocus={() => onFieldFocus?.('role')}
                  onBlur={() => handleFieldBlur('role')}
                  error={errors.role}
                />
                {section1Complete && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setActiveSection(1)}
                    className={`w-full mt-2 py-2.5 px-4 rounded-lg ${continueClasses} text-white text-sm font-semibold transition-colors shadow-md`}
                  >
                    Continue to Decision Making →
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section 2: Decision Making */}
      <div className={`rounded-xl border overflow-hidden transition-all ${section1Complete ? 'opacity-100' : 'opacity-40 pointer-events-none'} ${activeSection === 1 ? accentBorderActive : 'border-[#1e2a45]'}`}>
        <button
          onClick={() => setActiveSection(activeSection === 1 ? -1 : 1)}
          className="w-full flex items-center justify-between p-4 bg-[#141b2d] text-left hover:bg-[#182036] transition-colors"
        >
          <div className="flex items-center gap-3">
            {section2Complete && activeSection !== 1 ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </motion.div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-[#1e2a45] flex items-center justify-center">
                <span className="text-[10px] text-[#7c8ba3]">2</span>
              </div>
            )}
            <span className="text-[#e2e8f0] font-medium text-sm">Decision Making</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#7c8ba3] transition-transform ${activeSection === 1 ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {activeSection === 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 bg-[#0d1321]">
                <button
                  onClick={() => setIsDecisionMaker(!isDecisionMaker)}
                  className={`w-full min-h-[48px] p-4 rounded-xl border transition-all flex items-center justify-between ${
                    isDecisionMaker ? `${accentBorder} ${accentBg}` : 'border-[#1e2a45] bg-[#141b2d]'
                  }`}
                >
                  <span className="text-[#e2e8f0] text-base">Are you a decision maker?</span>
                  <div className={`w-12 h-7 rounded-full transition-all relative ${isDecisionMaker ? accentToggle : 'bg-[#1e2a45]'}`}>
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${isDecisionMaker ? 'left-6' : 'left-1'}`} />
                  </div>
                </button>
                <FunnelInput
                  type="text" enterKeyHint="next" label="Who else is involved in decisions?" value={buyingAuthority}
                  onChange={e => setBuyingAuthority(e.target.value)}
                  onFocus={() => onFieldFocus?.('buyingAuthority')}
                  onBlur={() => handleFieldBlur('buyingAuthority')}
                />
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setActiveSection(2)}
                  className={`w-full mt-2 py-2.5 px-4 rounded-lg ${continueClasses} text-white text-sm font-semibold transition-colors shadow-md`}
                >
                  Continue to Goals & Budget →
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section 3: Goals & Budget */}
      <div className={`rounded-xl border overflow-hidden transition-all ${section1Complete ? 'opacity-100' : 'opacity-40 pointer-events-none'} ${activeSection === 2 ? accentBorderActive : 'border-[#1e2a45]'}`}>
        <button
          onClick={() => setActiveSection(activeSection === 2 ? -1 : 2)}
          className="w-full flex items-center justify-between p-4 bg-[#141b2d] text-left hover:bg-[#182036] transition-colors"
        >
          <div className="flex items-center gap-3">
            {section3Visited && budget ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </motion.div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-[#1e2a45] flex items-center justify-center">
                <span className="text-[10px] text-[#7c8ba3]">3</span>
              </div>
            )}
            <span className="text-[#e2e8f0] font-medium text-sm">Goals & Budget</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#7c8ba3] transition-transform ${activeSection === 2 ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {activeSection === 2 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4 bg-[#0d1321]">
                {/* Channel context */}
                {channelLabels && (
                  <p className="text-[#7c8ba3] text-xs">Based on your channels: {channelLabels}</p>
                )}

                {/* KPI Multi-select */}
                <div className="space-y-2">
                  <p className="text-[#94a3b8] text-sm font-medium">Primary performance KPI(s)</p>
                  {kpiOptions.map(kpi => (
                    <motion.button
                      key={kpi}
                      onClick={() => toggleKpi(kpi)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full min-h-[48px] p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        kpis.includes(kpi) ? `${accentBorder} ${accentBg} text-[#e2e8f0]` : 'border-[#1e2a45] bg-[#141b2d] text-[#94a3b8]'
                      }`}
                    >
                      <motion.div
                        animate={kpis.includes(kpi) ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.2 }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          kpis.includes(kpi) ? accentCheckBg : 'border-[#1e2a45]'
                        }`}
                      >
                        {kpis.includes(kpi) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </motion.div>
                      <span className="text-sm">{kpi}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Budget Selection */}
                <div className="space-y-2">
                  <p className="text-[#94a3b8] text-sm font-medium">Budget range</p>
                  <div className="space-y-3">
                    {BUDGET_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setBudget(opt.value)}
                        className={`w-full h-16 min-h-[48px] rounded-xl font-semibold text-lg text-white transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
                          budget === opt.value
                            ? `bg-gradient-to-r ${opt.color} ring-2 ${opt.ring}`
                            : 'bg-[#141b2d] border border-[#1e2a45] hover:border-[#2d3b55]'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          budget === opt.value ? 'border-white' : 'border-[#7c8ba3]'
                        }`}>
                          {budget === opt.value && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2.5 h-2.5 rounded-full bg-white"
                            />
                          )}
                        </div>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {errors.budget && <p className="text-red-400 text-xs mt-1">{errors.budget}</p>}
                  <p className="text-[#7c8ba3] text-xs text-center mt-2">
                    Limited Q1 2026 onboarding slots remaining
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Submit - only show when all sections visited */}
      {allSectionsReady ? (
        <V3Button
          variant={isPolitical ? 'success' : 'primary'}
          size="xl"
          className={`w-full min-h-[48px] ${ctaClasses} !text-white font-semibold rounded-lg shadow-lg`}
          onClick={handleSubmit}
          isLoading={isSubmitting}
          loadingText="Submitting..."
        >
          {cta}
        </V3Button>
      ) : (
        <p className="text-[#7c8ba3] text-xs text-center">Complete all sections above to submit</p>
      )}
    </div>
  );
}
