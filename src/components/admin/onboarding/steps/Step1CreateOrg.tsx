import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building2, Globe, Mail, Image, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const normalizeHttpUrl = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return '';
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
        setSlugAvailabilityMsg('This slug is already in use');
      } else {
        setSlugAvailability('available');
        setSlugAvailabilityMsg('Slug is available');
      }
    } catch (err: any) {
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
      return `${root}-${Date.now().toString().slice(-4)}`;
    }
  };

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
      slugAvailability,
    });

    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({
        title: 'Required fields missing',
        description: 'Please enter organization name and slug',
        variant: 'destructive',
      });
      return;
    }

    if (slugAvailability === 'taken') {
      toast({
        title: 'Slug already in use',
        description: 'Please choose a different slug',
        variant: 'destructive',
      });
      slugInputRef.current?.focus();
      return;
    }

    const email = formData.primary_contact_email.trim();
    if (email && !isValidEmail(email)) {
      toast({
        title: 'Invalid email format',
        description: 'Please enter a valid email or leave it blank',
        variant: 'destructive',
      });
      return;
    }

    const websiteUrl = normalizeHttpUrl(formData.website_url);
    if (websiteUrl === null) {
      toast({
        title: 'Invalid website URL',
        description: 'Please enter a valid URL or leave it blank',
        variant: 'destructive',
      });
      return;
    }

    const logoUrl = normalizeHttpUrl(formData.logo_url);
    if (logoUrl === null) {
      toast({
        title: 'Invalid logo URL',
        description: 'Please enter a valid URL or leave it blank',
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
        title: 'Organization created',
        description: `${normalizedData.name} has been created successfully`,
      });

      logger.info('[Step1CreateOrg] org created', { id: org.id, slug: normalizedData.slug });
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
          description: `Suggested new slug: "${suggested}"`,
          variant: 'destructive',
        });

        window.setTimeout(() => slugInputRef.current?.focus(), 0);
        return;
      }

      toast({
        title: 'Error creating organization',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Section: Organization Details */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
            <Building2 className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">Organization Details</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Required information to create the client</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Organization Name <span className="text-[hsl(var(--portal-error))]">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Foundation"
              required
              className="h-10 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm font-medium">
              URL Slug <span className="text-[hsl(var(--portal-error))]">*</span>
            </Label>
            <Input
              id="slug"
              ref={slugInputRef}
              value={formData.slug}
              onChange={(e) => handleFieldChange('slug', e.target.value)}
              placeholder="acme-foundation"
              required
              className="h-10 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
            />
            <div className="flex items-center gap-1.5 text-xs">
              {slugAvailability === 'checking' && (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--portal-text-muted))]" />
                  <span className="text-[hsl(var(--portal-text-muted))]">{slugAvailabilityMsg}</span>
                </>
              )}
              {slugAvailability === 'available' && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-[hsl(var(--portal-success))]" />
                  <span className="text-[hsl(var(--portal-success))]">{slugAvailabilityMsg}</span>
                </>
              )}
              {slugAvailability === 'taken' && (
                <>
                  <AlertCircle className="h-3 w-3 text-[hsl(var(--portal-error))]" />
                  <span className="text-[hsl(var(--portal-error))]">{slugAvailabilityMsg}</span>
                </>
              )}
              {slugAvailability === 'idle' && !slugAvailabilityMsg && (
                <span className="text-[hsl(var(--portal-text-muted))]">Auto-generated from name</span>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-[hsl(var(--portal-text-muted))]" />
              Contact Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.primary_contact_email}
              onChange={(e) => handleFieldChange('primary_contact_email', e.target.value)}
              placeholder="contact@example.com"
              className="h-10 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
            />
          </div>
        </div>
      </section>

      {/* Section: Branding */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple))]/10">
            <Globe className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">Branding & Web Presence</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Optional — website enables AI profile extraction</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="website" className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[hsl(var(--portal-text-muted))]" />
              Website URL
            </Label>
            <Input
              id="website"
              type="url"
              value={formData.website_url}
              onChange={(e) => handleFieldChange('website_url', e.target.value)}
              placeholder="https://acme.org"
              className="h-10 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
            />
            <p className="text-[10px] text-[hsl(var(--portal-text-muted))]">
              Used to auto-extract mission and focus areas
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="logo" className="text-sm font-medium flex items-center gap-2">
              <Image className="w-3.5 h-3.5 text-[hsl(var(--portal-text-muted))]" />
              Logo URL
            </Label>
            <Input
              id="logo"
              type="url"
              value={formData.logo_url}
              onChange={(e) => handleFieldChange('logo_url', e.target.value)}
              placeholder="https://acme.org/logo.png"
              className="h-10 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
            />
          </div>
        </div>
      </section>

      {/* Footer Actions */}
      <div className="flex justify-end pt-6 border-t border-[hsl(var(--portal-border))]">
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className="min-w-[160px] h-10"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create & Continue'
          )}
        </Button>
      </div>
    </form>
  );
}
