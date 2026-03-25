import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  calculatePasswordStrength,
  getPasswordRequirements,
  REQUIREMENT_LABELS,
  type PasswordRequirements,
} from '@/lib/password-validation';

interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export function PasswordStrengthMeter({
  password,
  showRequirements = true,
  className,
}: PasswordStrengthMeterProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);
  const requirements = useMemo(() => getPasswordRequirements(password), [password]);

  if (!password) {
    return null;
  }

  const getStrengthStyles = () => {
    switch (strength.label) {
      case 'Weak':
        return {
          text: 'text-destructive',
          indicator: 'bg-destructive',
        };
      case 'Medium':
        return {
          text: 'text-[hsl(45_93%_47%)]',
          indicator: 'bg-[hsl(45_93%_47%)]',
        };
      case 'Strong':
        return {
          text: 'text-[hsl(142_76%_36%)]',
          indicator: 'bg-[hsl(142_76%_36%)]',
        };
    }
  };

  const styles = getStrengthStyles();

  return (
    <div className={cn('space-y-3', className)} role="status" aria-live="polite">
      {/* Strength Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span className={cn('font-medium transition-colors duration-200', styles.text)}>
            {strength.label}
          </span>
        </div>
        <Progress
          value={strength.percentage}
          className="h-1.5"
          indicatorClassName={cn('transition-all duration-300', styles.indicator)}
        />
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Requirements:</p>
          <ul className="grid grid-cols-1 gap-1" aria-label="Password requirements">
            {(Object.entries(requirements) as [keyof PasswordRequirements, boolean][]).map(
              ([key, met]) => (
                <li
                  key={key}
                  className={cn(
                    'flex items-center gap-2 text-xs transition-colors duration-200',
                    met ? 'text-[hsl(142_76%_36%)]' : 'text-muted-foreground'
                  )}
                >
                  {met ? (
                    <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <X className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  )}
                  <span>{REQUIREMENT_LABELS[key]}</span>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PasswordStrengthMeter;
