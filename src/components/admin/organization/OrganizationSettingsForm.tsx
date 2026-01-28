import { useState, useEffect } from 'react';
import { V3Card } from '@/components/v3/V3Card';
import { V3Button } from '@/components/v3/V3Button';
import { V3Badge } from '@/components/v3/V3Badge';
import { V3SectionHeader } from '@/components/v3/V3SectionHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
    <V3Card accent="green">
      <V3SectionHeader
        title="Organization Settings"
        subtitle="Security, seat limits, and session management"
        icon={Settings2}
        size="md"
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        {/* Security Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[hsl(var(--portal-border))]">
            <Shield className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
            <h3 className="font-medium text-[hsl(var(--portal-text-primary))]">Security</h3>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mfa" className="text-[hsl(var(--portal-text-primary))]">
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
            <div className="space-y-2 pl-4 border-l-2 border-[hsl(var(--portal-accent-blue)/0.3)]">
              <Label htmlFor="grace" className="text-[hsl(var(--portal-text-primary))]">
                MFA Grace Period (days)
              </Label>
              <Input
                id="grace"
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
                className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))] w-32"
              />
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                Days users have to set up MFA after first login (0 = immediate)
              </p>
            </div>
          )}
        </div>

        {/* Seat Management Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[hsl(var(--portal-border))]">
            <Users className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
            <h3 className="font-medium text-[hsl(var(--portal-text-primary))]">Seat Management</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchased" className="text-[hsl(var(--portal-text-primary))]">
                Purchased Seats
              </Label>
              <Input
                id="purchased"
                type="number"
                min={1}
                value={formData.purchased_seats}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    purchased_seats: parseInt(e.target.value) || 1,
                  }))
                }
                className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
              />
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">Paid user seats</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bonus" className="text-[hsl(var(--portal-text-primary))]">
                Bonus Seats
              </Label>
              <Input
                id="bonus"
                type="number"
                min={0}
                value={formData.bonus_seats}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    bonus_seats: parseInt(e.target.value) || 0,
                  }))
                }
                className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
              />
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">Complimentary seats</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[hsl(var(--portal-text-primary))]">Total Available</Label>
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
            <h3 className="font-medium text-[hsl(var(--portal-text-primary))]">Session Management</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessions" className="text-[hsl(var(--portal-text-primary))]">
              Max Concurrent Sessions per User
            </Label>
            <Input
              id="sessions"
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
              className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))] w-32"
            />
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
              Limits how many devices/browsers a user can be logged in from simultaneously. Setting to 1 prevents
              credential sharing.
            </p>
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
          <V3Button type="submit" disabled={isSaving || !hasChanges} isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
            Save Settings
          </V3Button>
        </div>
      </form>
    </V3Card>
  );
}
