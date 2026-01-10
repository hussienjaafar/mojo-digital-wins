import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { V3Button } from '@/components/v3/V3Button';
// Card components removed - using integrated layout
import { Building2, Globe, Mail, Image, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { CreateOrgData } from '../types';

interface Step1CreateOrgProps {
  initialData?: Partial<CreateOrgData>;
  onComplete: (orgId: string, data: CreateOrgData) => void | Promise<void>;
  onDataChange?: (data: Partial<CreateOrgData>) => void;
}

export function Step1CreateOrg({ initialData, onComplete, onDataChange }: Step1CreateOrgProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const slugInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<CreateOrgData>({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    primary_contact_email: initialData?.primary_contact_email || '',
    logo_url: initialData?.logo_url || '',
    website_url: initialData?.website_url || '',
  });

  const [slugAvailability, setSlugAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [slugAvailabilityMsg, setSlugAvailabilityMsg] = useState<string>('');

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const isValidEmail = (value: string) => {
    // Simple, pragmatic validation (we still let the backend be the source of truth)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const normalizeHttpUrl = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    // Users often paste domains without protocol; normalize to https://
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const url = new URL(withProtocol);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.toString();
    } catch {
      return null;
    }
  };

  const checkSlugAvailability = async (slug: string) => {
    const candidate = slug.trim();
    if (!candidate) {
      setSlugAvailability('idle');
      setSlugAvailabilityMsg('');
      return;
    }

    setSlugAvailability('checking');
    setSlugAvailabilityMsg('Checking availability…');

    try {
      const { data, error } = await (supabase as any)
        .from('client_organizations')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();

      if (error) throw error;

      if (data?.id) {
        setSlugAvailability('taken');
        setSlugAvailabilityMsg('Slug is already in use.');
      } else {
        setSlugAvailability('available');
        setSlugAvailabilityMsg('Slug is available.');
      }
    } catch (err: any) {
      // If we can't check (permissions/etc.), don't block submit.
      logger.warn('[Step1CreateOrg] slug availability check failed', err);
      setSlugAvailability('idle');
      setSlugAvailabilityMsg('');
    }
  };

  const suggestUniqueSlug = async (base: string) => {
    const root = base.trim();
    if (!root) return root;

    try {
      const { data, error } = await (supabase as any)
        .from('client_organizations')
        .select('slug')
        .ilike('slug', `${root}%`);

      if (error) throw error;

      const existing = new Set<string>((data || []).map((r: any) => String(r.slug)));
      if (!existing.has(root)) return root;

      let maxSuffix = 1;
      for (const s of existing) {
        const match = s.match(new RegExp(`^${root}-(\\d+)$`));
        if (match?.[1]) maxSuffix = Math.max(maxSuffix, Number(match[1]));
      }
      return `${root}-${maxSuffix + 1}`;
    } catch (err) {
      // Fallback: timestamp-based suffix
      return `${root}-${Date.now().toString().slice(-4)}`;
    }
  };

  // Debounced slug availability check (best-effort)
  const slugToCheck = useMemo(() => formData.slug.trim(), [formData.slug]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      void checkSlugAvailability(slugToCheck);
    }, 400);

    return () => window.clearTimeout(t);
  }, [slugToCheck]);

  const handleNameChange = (name: string) => {
    const newData = {
      ...formData,
      name,
      slug: generateSlug(name),
    };
    setFormData(newData);
    onDataChange?.(newData);
  };

  const handleFieldChange = (field: keyof CreateOrgData, value: string) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onDataChange?.(newData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    logger.info('[Step1CreateOrg] submit start', {
      name: formData.name,
      slug: formData.slug,
      hasEmail: Boolean(formData.primary_contact_email?.trim()),
      hasWebsite: Boolean(formData.website_url?.trim()),
      hasLogo: Boolean(formData.logo_url?.trim()),
      slugAvailability,
    });

    // We intentionally use custom validation because optional email/url fields
    // can cause the browser to block submit silently.
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Organization name and slug are required',
        variant: 'destructive',
      });
      return;
    }

    if (slugAvailability === 'taken') {
      toast({
        title: 'Slug already in use',
        description: 'Please choose a different slug before continuing.',
        variant: 'destructive',
      });
      slugInputRef.current?.focus();
      return;
    }

    const email = formData.primary_contact_email.trim();
    if (email && !isValidEmail(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address (or leave it blank).',
        variant: 'destructive',
      });
      return;
    }

    const websiteUrl = normalizeHttpUrl(formData.website_url);
    if (websiteUrl === null) {
      toast({
        title: 'Invalid website URL',
        description: 'Please enter a valid website URL (e.g. https://example.org) or leave it blank.',
        variant: 'destructive',
      });
      return;
    }

    const logoUrl = normalizeHttpUrl(formData.logo_url);
    if (logoUrl === null) {
      toast({
        title: 'Invalid logo URL',
        description: 'Please enter a valid logo URL (e.g. https://example.org/logo.png) or leave it blank.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedData: CreateOrgData = {
      ...formData,
      primary_contact_email: email,
      website_url: websiteUrl,
      logo_url: logoUrl,
    };

    setIsSubmitting(true);

    try {
      // Create the organization
      const { data: org, error: orgError } = await (supabase as any)
        .from('client_organizations')
        .insert({
          name: normalizedData.name.trim(),
          slug: normalizedData.slug.trim(),
          primary_contact_email: normalizedData.primary_contact_email?.trim() || null,
          logo_url: normalizedData.logo_url?.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Log the audit action
      await supabase.rpc('log_admin_action', {
        _action_type: 'create_organization',
        _table_affected: 'client_organizations',
        _record_id: org.id,
        _new_value: {
          name: normalizedData.name,
          slug: normalizedData.slug,
          primary_contact_email: normalizedData.primary_contact_email || null,
        },
      });

      toast({
        title: 'Organization Created',
        description: `${normalizedData.name} has been created successfully`,
      });

      logger.info('[Step1CreateOrg] org created', { id: org.id, slug: normalizedData.slug });

      // Await to keep the button in a loading state until the wizard advances
      await Promise.resolve(onComplete(org.id, normalizedData));
    } catch (err: any) {
      logger.error('[Step1CreateOrg] submit failed', err);

      const isUniqueSlug =
        err?.code === '23505' ||
        String(err?.message || '').includes('client_organizations_slug_key') ||
        String(err?.message || '').includes('duplicate key value');

      if (isUniqueSlug) {
        const suggested = await suggestUniqueSlug(generateSlug(formData.name) || formData.slug);
        setFormData(prev => ({ ...prev, slug: suggested }));
        onDataChange?.({ ...formData, slug: suggested });
        setSlugAvailability('idle');
        setSlugAvailabilityMsg('');

        toast({
          title: 'Slug already exists',
          description: `We suggested a new slug: “${suggested}”. Click Create & Continue again.`,
          variant: 'destructive',
        });

        // focus so the user sees what changed
        window.setTimeout(() => slugInputRef.current?.focus(), 0);
        return;
      }

      toast({
        title: 'Error',
        description: err.message || 'Failed to create organization',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Organization Details Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-[hsl(var(--portal-border))]">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
            <Building2 className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Organization Details</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Basic information about the client</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corporation"
              required
              className="bg-[hsl(var(--portal-bg-secondary))]"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug *</Label>
            <Input
              id="slug"
              ref={slugInputRef}
              value={formData.slug}
              onChange={(e) => handleFieldChange('slug', e.target.value)}
              placeholder="acme-corporation"
              required
              className="bg-[hsl(var(--portal-bg-secondary))]"
            />
            {slugAvailabilityMsg ? (
              <p
                className={
                  "text-xs " +
                  (slugAvailability === 'taken'
                    ? 'text-destructive'
                    : slugAvailability === 'available'
                      ? 'text-[hsl(var(--portal-text-muted))]'
                      : 'text-[hsl(var(--portal-text-muted))]')
                }
                aria-live="polite"
              >
                {slugAvailabilityMsg}
              </p>
            ) : (
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">Auto-generated from name</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Primary Contact Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.primary_contact_email}
              onChange={(e) => handleFieldChange('primary_contact_email', e.target.value)}
              placeholder="contact@acme.com"
              className="bg-[hsl(var(--portal-bg-secondary))]"
            />
          </div>
        </div>
      </div>

      {/* Branding Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-[hsl(var(--portal-border))]">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple))]/10">
            <Globe className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Branding & Web Presence</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Optional - can be completed later</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Website URL
            </Label>
            <Input
              id="website"
              type="url"
              value={formData.website_url}
              onChange={(e) => handleFieldChange('website_url', e.target.value)}
              placeholder="https://acme.com"
              className="bg-[hsl(var(--portal-bg-secondary))]"
            />
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              Used to auto-extract organization profile
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="logo" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Logo URL
            </Label>
            <Input
              id="logo"
              type="url"
              value={formData.logo_url}
              onChange={(e) => handleFieldChange('logo_url', e.target.value)}
              placeholder="https://acme.com/logo.png"
              className="bg-[hsl(var(--portal-bg-secondary))]"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-[hsl(var(--portal-border))]">
        <V3Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create & Continue'
          )}
        </V3Button>
      </div>
    </form>
  );
}
