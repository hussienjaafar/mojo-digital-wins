import React, { useState, useEffect } from 'react';
import { V3Button } from '@/components/v3/V3Button';
import { V3Badge } from '@/components/v3/V3Badge';
import { PortalFormInput } from '@/components/admin/forms/PortalFormInput';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings2, Save, Shield, Users, MonitorSmartphone } from 'lucide-react';

interface OrganizationSettings {
  mfa_required: boolean;
  mfa_grace_period_days: number | null;
  purchased_seats: number;
  bonus_seats: number;
  max_concurrent_sessions: number;
}

interface OrganizationSettingsFormProps {
  organization: OrganizationSettings;
  onSave: (data: Partial<OrganizationSettings>) => Promise<void>;
}

export function OrganizationSettingsForm({ organization, onSave }: OrganizationSettingsFormProps) {
  const [formData, setFormData] = useState({
    mfa_required: organization.mfa_required ?? false,
    mfa_grace_period_days: organization.mfa_grace_period_days ?? 7,
    purchased_seats: organization.purchased_seats ?? 2,
    bonus_seats: organization.bonus_seats ?? 0,
    max_concurrent_sessions: organization.max_concurrent_sessions ?? 1,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const changed =
      formData.mfa_required !== (organization.mfa_required ?? false) ||
      formData.mfa_grace_period_days !== (organization.mfa_grace_period_days ?? 7) ||
      formData.purchased_seats !== (organization.purchased_seats ?? 2) ||
      formData.bonus_seats !== (organization.bonus_seats ?? 0) ||
      formData.max_concurrent_sessions !== (organization.max_concurrent_sessions ?? 1);
    setHasChanges(changed);
  }, [formData, organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
      await onSave({
        mfa_required: formData.mfa_required,
        mfa_grace_period_days: formData.mfa_required ? formData.mfa_grace_period_days : null,
        purchased_seats: formData.purchased_seats,
        bonus_seats: formData.bonus_seats,
        max_concurrent_sessions: formData.max_concurrent_sessions,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalSeats = formData.purchased_seats + formData.bonus_seats;

  return (
    <div className="portal-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[hsl(var(--portal-success)/0.1)]">
          <Settings2 className="w-5 h-5 text-[hsl(var(--portal-success))]" />
        </div>
        <div>
          <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
            Organization Settings
          </h3>
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">
            Security, seat limits, and session management
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Security Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[hsl(var(--portal-border))]">
            <Shield className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
            <h4 className="font-medium text-[hsl(var(--portal-text-primary))]">Security</h4>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mfa" className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                Require Multi-Factor Authentication
              </Label>
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                All users must set up MFA to access the portal
              </p>
            </div>
            <Switch
              id="mfa"
              checked={formData.mfa_required}
              onCheckedChange={checked => setFormData(prev => ({ ...prev, mfa_required: checked }))}
            />
          </div>

          {formData.mfa_required && (
            <div className="pl-4 border-l-2 border-[hsl(var(--portal-accent-blue)/0.3)]">
              <PortalFormInput
                label="MFA Grace Period (days)"
                type="number"
                min={0}
                max={30}
                value={formData.mfa_grace_period_days}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    mfa_grace_period_days: parseInt(e.target.value) || 0,
                  }))
                }
                description="Days users have to set up MFA after first login (0 = immediate)"
                containerClassName="w-32"
              />
            </div>
          )}
        </div>

        {/* Seat Management Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[hsl(var(--portal-border))]">
            <Users className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
            <h4 className="font-medium text-[hsl(var(--portal-text-primary))]">Seat Management</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PortalFormInput
              label="Purchased Seats"
              type="number"
              min={1}
              value={formData.purchased_seats}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  purchased_seats: parseInt(e.target.value) || 1,
                }))
              }
              description="Paid user seats"
            />

            <PortalFormInput
              label="Bonus Seats"
              type="number"
              min={0}
              value={formData.bonus_seats}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  bonus_seats: parseInt(e.target.value) || 0,
                }))
              }
              description="Complimentary seats"
            />

            <div className="space-y-2">
              <Label className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Total Available</Label>
              <div className="h-10 px-3 rounded-md border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))] flex items-center">
                <span className="font-bold text-lg text-[hsl(var(--portal-text-primary))]">{totalSeats}</span>
                <span className="text-sm text-[hsl(var(--portal-text-muted))] ml-2">seats</span>
              </div>
            </div>
          </div>
        </div>

        {/* Session Management Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[hsl(var(--portal-border))]">
            <MonitorSmartphone className="w-4 h-4 text-[hsl(var(--portal-success))]" />
            <h4 className="font-medium text-[hsl(var(--portal-text-primary))]">Session Management</h4>
          </div>

          <PortalFormInput
            label="Max Concurrent Sessions per User"
            type="number"
            min={1}
            max={10}
            value={formData.max_concurrent_sessions}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                max_concurrent_sessions: parseInt(e.target.value) || 1,
              }))
            }
            description="Limits how many devices/browsers a user can be logged in from simultaneously. Setting to 1 prevents credential sharing."
            containerClassName="w-32"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[hsl(var(--portal-border))]">
          <div>
            {hasChanges && (
              <V3Badge variant="warning" size="sm">
                Unsaved changes
              </V3Badge>
            )}
          </div>
          <V3Button type="submit" disabled={isSaving || !hasChanges} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
            Save Settings
          </V3Button>
        </div>
      </form>
    </div>
  );
}
