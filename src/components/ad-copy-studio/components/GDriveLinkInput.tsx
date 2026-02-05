/**
 * GDriveLinkInput - Input component for Google Drive links with validation
 *
 * Features:
 * - Validates Google Drive URL format
 * - Shows validation status
 * - Loading state during import
 * - Support for multiple URLs (comma or newline separated)
 * - Enter key to submit
 */

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface GDriveLinkInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (urls: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  maxUrls?: number;
}

// =============================================================================
// Constants
// =============================================================================

const GDRIVE_URL_PATTERNS = [
  /^https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /^https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /^https?:\/\/docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a string is a valid Google Drive URL
 */
function isValidGDriveUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return GDRIVE_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Parse input to extract URLs
 */
function parseUrls(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

// =============================================================================
// Component
// =============================================================================

export function GDriveLinkInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  isLoading = false,
  maxUrls = 5,
}: GDriveLinkInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Parse and validate URLs
  const { urls, validUrls, invalidUrls } = useMemo(() => {
    const parsed = parseUrls(value);
    const valid: string[] = [];
    const invalid: string[] = [];

    parsed.forEach((url) => {
      if (isValidGDriveUrl(url)) {
        valid.push(url);
      } else {
        invalid.push(url);
      }
    });

    return { urls: parsed, validUrls: valid, invalidUrls: invalid };
  }, [value]);

  const hasInput = urls.length > 0;
  const hasValidUrls = validUrls.length > 0;
  const hasInvalidUrls = invalidUrls.length > 0;
  const isOverLimit = validUrls.length > maxUrls;
  const canSubmit = hasValidUrls && !hasInvalidUrls && !isOverLimit && !disabled && !isLoading;

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleSubmit = useCallback(() => {
    if (canSubmit) {
      onSubmit(validUrls);
    }
  }, [canSubmit, validUrls, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div
      className="rounded-xl border border-[#1e2a45] bg-[#141b2d] p-6"
      role="group"
      aria-labelledby="gdrive-import-label"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link className="h-5 w-5 text-[#94a3b8]" aria-hidden="true" />
        <span
          id="gdrive-import-label"
          className="text-xs font-medium uppercase tracking-wider text-[#64748b]"
        >
          Import from Google Drive
        </span>
      </div>

      {/* Input Row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Paste Google Drive link(s) here..."
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled || isLoading}
            className={cn(
              'bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]',
              'focus-visible:ring-blue-500',
              hasInput && hasValidUrls && !hasInvalidUrls && 'border-[#22c55e]/50',
              hasInput && hasInvalidUrls && 'border-[#ef4444]/50'
            )}
            aria-label="Google Drive URL input"
            aria-invalid={hasInvalidUrls}
            aria-describedby="gdrive-help gdrive-error"
          />

          {/* Validation indicator */}
          {hasInput && !isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {hasInvalidUrls ? (
                <AlertCircle className="h-4 w-4 text-[#ef4444]" />
              ) : (
                <CheckCircle className="h-4 w-4 text-[#22c55e]" />
              )}
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'min-w-[100px]',
            canSubmit
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-[#1e2a45] text-[#64748b] cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Import'
          )}
        </Button>
      </div>

      {/* Help Text / Errors */}
      <div className="mt-3 space-y-1.5">
        {hasInvalidUrls && (
          <p id="gdrive-error" className="text-xs text-[#ef4444] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Invalid Google Drive URL{invalidUrls.length > 1 ? 's' : ''}: {invalidUrls.join(', ')}
          </p>
        )}

        {isOverLimit && (
          <p className="text-xs text-[#ef4444] flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Maximum {maxUrls} URLs allowed. You have {validUrls.length}.
          </p>
        )}

        {hasValidUrls && !hasInvalidUrls && !isOverLimit && (
          <p className="text-xs text-[#22c55e] flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            {validUrls.length} valid URL{validUrls.length !== 1 ? 's' : ''} ready to import
          </p>
        )}

        <p id="gdrive-help" className="text-xs text-[#64748b]">
          Files must be shared as &quot;Anyone with link&quot;. Separate multiple URLs with commas or new lines.
        </p>
      </div>
    </div>
  );
}

export default GDriveLinkInput;
