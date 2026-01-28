import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { V3Button } from '@/components/v3/V3Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Save, Loader2, CheckCircle2, XCircle, Image } from 'lucide-react';
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
  website_url: string | null;
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
    website_url: organization.website_url || '',
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
      formData.website_url !== (organization.website_url || '') ||
      formData.timezone !== (organization.timezone || 'America/New_York');
    setHasChanges(changed);
  }, [formData, organization]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const checkSlugAvailability = useCallback(async (slug: string) => {
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
        .neq('id', organization.id) // Exclude current org
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
  }, [organization.id, organization.slug]);

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
      // Auto-generate slug only if slug hasn't been manually edited
      slug: prev.slug === generateSlug(organization.name) ? generateSlug(name) : prev.slug,
    }));
  };

  const isValidEmail = (email: string) => {
    if (!email) return true; // Optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isValidUrl = (url: string) => {
    if (!url) return true; // Optional field
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    if (!formData.slug.trim()) {
      return;
    }

    if (slugAvailability === 'taken') {
      return;
    }

    if (!isValidEmail(formData.primary_contact_email)) {
      return;
    }

    if (!isValidUrl(formData.website_url) || !isValidUrl(formData.logo_url)) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        logo_url: formData.logo_url.trim() || null,
        primary_contact_email: formData.primary_contact_email.trim() || null,
        website_url: formData.website_url.trim() || null,
        timezone: formData.timezone,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Organization Details
        </CardTitle>
        <CardDescription>
          Basic information about the organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="space-y-2">
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

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug *</Label>
              <div className="relative">
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="acme-corporation"
                  required
                  className="bg-[hsl(var(--portal-bg-secondary))] pr-10"
                />
                {slugAvailability === 'checking' && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {slugAvailability === 'available' && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--portal-success))]" />
                )}
                {slugAvailability === 'taken' && (
                  <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--portal-error))]" />
                )}
              </div>
              {slugMessage && (
                <p className={`text-xs ${slugAvailability === 'taken' ? 'text-[hsl(var(--portal-error))]' : slugAvailability === 'available' ? 'text-[hsl(var(--portal-success))]' : 'text-muted-foreground'}`}>
                  {slugMessage}
                </p>
              )}
            </div>

            {/* Primary Contact Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Primary Contact Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.primary_contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, primary_contact_email: e.target.value }))}
                placeholder="contact@acme.com"
                className="bg-[hsl(var(--portal-bg-secondary))]"
              />
              {formData.primary_contact_email && !isValidEmail(formData.primary_contact_email) && (
                <p className="text-xs text-[hsl(var(--portal-error))]">Please enter a valid email address</p>
              )}
            </div>

            {/* Website URL */}
            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <Input
                id="website"
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://www.acme.com"
                className="bg-[hsl(var(--portal-bg-secondary))]"
              />
              {formData.website_url && !isValidUrl(formData.website_url) && (
                <p className="text-xs text-[hsl(var(--portal-error))]">Please enter a valid URL</p>
              )}
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <div className="flex gap-3">
                <Input
                  id="logo"
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  className="bg-[hsl(var(--portal-bg-secondary))] flex-1"
                />
                {formData.logo_url && isValidUrl(formData.logo_url) && (
                  <div className="w-10 h-10 rounded border border-[hsl(var(--portal-border))] overflow-hidden flex-shrink-0">
                    <img 
                      src={formData.logo_url} 
                      alt="Logo preview" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
              {formData.logo_url && !isValidUrl(formData.logo_url) && (
                <p className="text-xs text-[hsl(var(--portal-error))]">Please enter a valid URL</p>
              )}
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map(tz => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[hsl(var(--portal-border))]">
            <div>
              {hasChanges && (
                <Badge variant="outline" className="text-[hsl(var(--portal-warning))]">
                  Unsaved changes
                </Badge>
              )}
            </div>
            <V3Button
              type="submit"
              disabled={isSaving || slugAvailability === 'taken' || !hasChanges}
              isLoading={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </V3Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
