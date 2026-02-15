import { useState, useId, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface FunnelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  showValid?: boolean;
}

const FunnelInput = forwardRef<HTMLInputElement, FunnelInputProps>(
  ({ label, error, showValid, className, value, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const id = useId();
    const hasValue = value !== undefined && value !== '';
    const isFloating = focused || hasValue;

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={cn(
            'w-full h-14 px-4 pt-5 pb-2 rounded-xl bg-[#141b2d] border text-[#e2e8f0] text-base transition-colors peer',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50',
            error ? 'border-red-500/50' : 'border-[#1e2a45]',
            className
          )}
          placeholder=" "
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            'absolute left-4 transition-all duration-200 pointer-events-none',
            isFloating
              ? 'top-1.5 text-[10px] text-[#7c8ba3]'
              : 'top-1/2 -translate-y-1/2 text-base text-[#64748b]'
          )}
        >
          {label}
        </label>
        {showValid && hasValue && !error && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <Check className="w-4 h-4 text-emerald-400" />
          </motion.div>
        )}
        {error && (
          <p className="text-red-400 text-xs mt-1">{error}</p>
        )}
      </div>
    );
  }
);

FunnelInput.displayName = 'FunnelInput';
export default FunnelInput;
