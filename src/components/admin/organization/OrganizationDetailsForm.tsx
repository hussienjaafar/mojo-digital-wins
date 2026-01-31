import React, { useState, useEffect, useCallback } from 'react';
import { V3Button } from '@/components/v3/V3Button';
import { V3Badge } from '@/components/v3/V3Badge';
import { PortalFormInput } from '@/components/admin/forms/PortalFormInput';
import { PortalFormSelect } from '@/components/admin/forms/PortalFormSelect';
import { LogoUploadField } from '@/components/admin/forms/LogoUploadField';
import { FileText, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Common timezones
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
];

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_contact_email: string | null;
  timezone: string | null;
}

interface OrganizationDetailsFormProps {
  organization: OrganizationData;
  onSave: (data: Partial<OrganizationData>) => Promise<void>;
}

type SlugAvailability = 'idle' | 'checking' | 'available' | 'taken';

export function OrganizationDetailsForm({ organization, onSave }: OrganizationDetailsFormProps) {
  const [formData, setFormData] = useState({
    name: organization.name,
    slug: organization.slug,
    logo_url: organization.logo_url || '',
    primary_contact_email: organization.primary_contact_email || '',
    timezone: organization.timezone || 'America/New_York',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [slugAvailability, setSlugAvailability] = useState<SlugAvailability>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const changed =
      formData.name !== organization.name ||
      formData.slug !== organization.slug ||
      formData.logo_url !== (organization.logo_url || '') ||
      formData.primary_contact_email !== (organization.primary_contact_email || '') ||
      formData.timezone !== (organization.timezone || 'America/New_York');
    setHasChanges(changed);
  }, [formData, organization]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const checkSlugAvailability = useCallback(
    async (slug: string) => {
      const candidate = slug.trim();
      if (!candidate || candidate === organization.slug) {
        setSlugAvailability('idle');
        setSlugMessage('');
        return;
      }

      setSlugAvailability('checking');
      setSlugMessage('Checking availability…');

      try {
        const { data, error } = await (supabase as any)
          .from('client_organizations')
          .select('id')
          .eq('slug', candidate)
          .neq('id', organization.id)
          .maybeSingle();

        if (error) throw error;

        if (data?.id) {
          setSlugAvailability('taken');
          setSlugMessage('Slug is already in use.');
        } else {
          setSlugAvailability('available');
          setSlugMessage('Slug is available.');
        }
      } catch (err: any) {
        console.warn('[OrganizationDetailsForm] slug check failed', err);
        setSlugAvailability('idle');
        setSlugMessage('');
      }
    },
    [organization.id, organization.slug]
  );

  // Debounced slug check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.slug && formData.slug !== organization.slug) {
        checkSlugAvailability(formData.slug);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.slug, checkSlugAvailability, organization.slug]);

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug === generateSlug(organization.name) ? generateSlug(name) : prev.slug,
    }));
  };

  const isValidEmail = (email: string) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return;
    if (!formData.slug.trim()) return;
    if (slugAvailability === 'taken') return;
    if (!isValidEmail(formData.primary_contact_email)) return;
    if (!isValidUrl(formData.logo_url)) return;

    setIsSaving(true);
    try {
      await onSave({
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        logo_url: formData.logo_url.trim() || null,
        primary_contact_email: formData.primary_contact_email.trim() || null,
        timezone: formData.timezone,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="portal-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
          <FileText className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
        </div>
        <div>
          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
            Organization Details
          </h3>
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">
            Basic information about the organization
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <PortalFormInput
            label="Organization Name *"
            value={formData.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Acme Corporation"
            required
          />

          {/* Slug */}
          <div className="space-y-2">
            <PortalFormInput
              label="URL Slug *"
              value={formData.slug}
              onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="acme-corporation"
              required
            />
            <div className="flex items-center gap-2">
              {slugAvailability === 'checking' && (
                <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--portal-text-muted))]" />
              )}
              {slugAvailability === 'available' && (
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--portal-success))]" />
              )}
              {slugAvailability === 'taken' && (
                <XCircle className="w-4 h-4 text-[hsl(var(--portal-error))]" />
              )}
              {slugMessage && (
                <span
                  className={`text-xs ${
                    slugAvailability === 'taken'
                      ? 'text-[hsl(var(--portal-error))]'
                      : slugAvailability === 'available'
                      ? 'text-[hsl(var(--portal-success))]'
                      : 'text-[hsl(var(--portal-text-muted))]'
                  }`}
                >
                  {slugMessage}
                </span>
              )}
            </div>
          </div>

          {/* Primary Contact Email */}
          <PortalFormInput
            label="Primary Contact Email"
            type="email"
            value={formData.primary_contact_email}
            onChange={e => setFormData(prev => ({ ...prev, primary_contact_email: e.target.value }))}
            placeholder="contact@acme.com"
            error={
              formData.primary_contact_email && !isValidEmail(formData.primary_contact_email)
                ? 'Please enter a valid email address'
                : undefined
            }
          />

          {/* Timezone */}
          <PortalFormSelect
            label="Timezone"
            value={formData.timezone}
            onValueChange={value => setFormData(prev => ({ ...prev, timezone: value }))}
            options={TIMEZONE_OPTIONS}
            placeholder="Select timezone"
          />

          {/* Logo - full width */}
          <div className="md:col-span-2">
            <LogoUploadField
              value={formData.logo_url}
              onChange={(url) => setFormData(prev => ({ ...prev, logo_url: url }))}
              organizationId={organization.id}
              label="Organization Logo"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[hsl(var(--portal-border))]">
          <div>
            {hasChanges && (
              <V3Badge variant="warning" size="sm">
                Unsaved changes
              </V3Badge>
            )}
          </div>
          <V3Button
            type="submit"
            disabled={isSaving || slugAvailability === 'taken' || !hasChanges}
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </V3Button>
        </div>
      </form>
    </div>
  );
}
