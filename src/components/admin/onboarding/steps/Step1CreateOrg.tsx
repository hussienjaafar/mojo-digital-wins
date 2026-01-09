import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { V3Button } from '@/components/v3/V3Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Globe, Mail, Image, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CreateOrgData } from '../types';

interface Step1CreateOrgProps {
  initialData?: Partial<CreateOrgData>;
  onComplete: (orgId: string, data: CreateOrgData) => void;
  onDataChange?: (data: Partial<CreateOrgData>) => void;
}

export function Step1CreateOrg({ initialData, onComplete, onDataChange }: Step1CreateOrgProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateOrgData>({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    primary_contact_email: initialData?.primary_contact_email || '',
    logo_url: initialData?.logo_url || '',
    website_url: initialData?.website_url || '',
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

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
    
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Organization name and slug are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create the organization
      const { data: org, error: orgError } = await (supabase as any)
        .from('client_organizations')
        .insert({
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          primary_contact_email: formData.primary_contact_email?.trim() || null,
          logo_url: formData.logo_url?.trim() || null,
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
          name: formData.name,
          slug: formData.slug,
          primary_contact_email: formData.primary_contact_email || null,
        },
      });

      toast({
        title: 'Organization Created',
        description: `${formData.name} has been created successfully`,
      });

      onComplete(org.id, formData);
    } catch (err: any) {
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
              <Building2 className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <CardTitle className="text-lg">Organization Details</CardTitle>
              <CardDescription>Basic information about the client</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
                value={formData.slug}
                onChange={(e) => handleFieldChange('slug', e.target.value)}
                placeholder="acme-corporation"
                required
                className="bg-[hsl(var(--portal-bg-secondary))]"
              />
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                Auto-generated from name
              </p>
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
        </CardContent>
      </Card>

      <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple))]/10">
              <Globe className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
            </div>
            <div>
              <CardTitle className="text-lg">Branding & Web Presence</CardTitle>
              <CardDescription>Optional - can be completed later</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
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
