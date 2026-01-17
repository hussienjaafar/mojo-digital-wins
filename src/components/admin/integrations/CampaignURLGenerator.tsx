/**
 * Campaign URL Generator Component
 *
 * Generates tracking URLs for Meta ad campaigns that route through
 * our redirect endpoint to capture fbp/fbc cookies before ActBlue.
 */

import { useState, useMemo } from 'react';
import { Copy, CheckCircle, Link2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface CampaignURLGeneratorProps {
  organizationSlug: string;
  organizationName?: string;
}

export function CampaignURLGenerator({
  organizationSlug,
  organizationName,
}: CampaignURLGeneratorProps) {
  const [formName, setFormName] = useState('');
  const [refcode, setRefcode] = useState('');
  const [amount, setAmount] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get the base URL from environment or default to production
  const baseUrl = useMemo(() => {
    // In development, use localhost; in production, use the actual domain
    if (typeof window !== 'undefined') {
      const { protocol, host } = window.location;
      return `${protocol}//${host}`;
    }
    return 'https://mojo.digital';
  }, []);

  // Generate the URL reactively
  const generatedUrl = useMemo(() => {
    if (!formName.trim()) return '';

    const url = new URL(`${baseUrl}/r`);
    url.searchParams.set('org', organizationSlug);
    url.searchParams.set('form', formName.trim());

    if (refcode.trim()) {
      url.searchParams.set('refcode', refcode.trim());
    }
    if (amount.trim()) {
      url.searchParams.set('amount', amount.trim());
    }
    if (recurring) {
      url.searchParams.set('recurring', 'true');
    }

    return url.toString();
  }, [baseUrl, organizationSlug, formName, refcode, amount, recurring]);

  // Copy to clipboard
  const handleCopy = async () => {
    if (!generatedUrl) return;

    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Campaign URL Generator
        </h3>
        {organizationName && (
          <p className="text-sm text-muted-foreground">{organizationName}</p>
        )}
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* ActBlue Form Name */}
        <div className="space-y-2">
          <Label htmlFor="formName">
            ActBlue Form Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="formName"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., moliticometa"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            The form name from your ActBlue URL (the part after /donate/)
          </p>
        </div>

        {/* Refcode */}
        <div className="space-y-2">
          <Label htmlFor="refcode">Refcode</Label>
          <Input
            id="refcode"
            value={refcode}
            onChange={(e) => setRefcode(e.target.value)}
            placeholder="e.g., meta_jan25_video1"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Your attribution tracking code (passed to ActBlue)
          </p>
        </div>

        {/* Amount and Recurring Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (optional)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 25"
              min="1"
            />
          </div>
          <div className="flex items-end pb-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={recurring}
                onCheckedChange={(checked) => setRecurring(checked === true)}
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Recurring donation
              </Label>
            </div>
          </div>
        </div>
      </div>

      {/* Generated URL */}
      {generatedUrl && (
        <div className="space-y-2 pt-2 border-t">
          <Label>Generated URL</Label>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm break-all border">
              {generatedUrl}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0 h-auto min-h-[44px]"
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="flex gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Use this URL in your Meta ad campaigns. When users click, we'll capture their
          browser cookies (fbp/fbc) before redirecting to ActBlue, enabling accurate
          conversion tracking.
        </p>
      </div>

      {/* Example */}
      {!formName && (
        <div className="text-xs text-muted-foreground">
          <strong>Example:</strong>{' '}
          <code className="bg-muted px-1 py-0.5 rounded">
            {baseUrl}/r?org={organizationSlug}&form=your-form&refcode=meta_jan25
          </code>
        </div>
      )}
    </div>
  );
}
