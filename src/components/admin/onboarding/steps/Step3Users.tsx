import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserInvite, WizardStep } from '../types';
import { Users, Plus, Trash2, Upload, Mail, Loader2, Send, ChevronDown, UserPlus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Valid org roles
const ORG_ROLES = ['admin', 'manager', 'editor', 'viewer'] as const;
type OrgRole = typeof ORG_ROLES[number];

interface Step3UsersProps {
  organizationId: string;
  organizationName?: string;
  stepData: Record<string, unknown>;
  onComplete: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;
}

export function Step3Users({ organizationId, organizationName, stepData, onComplete, onBack, onDataChange }: Step3UsersProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserInvite[]>(
    (stepData.users as UserInvite[]) || []
  );
  const [bulkInput, setBulkInput] = useState('');

  // Report data changes to parent for persistence on back navigation
  useEffect(() => {
    onDataChange?.({ users });
  }, [users, onDataChange]);
  const [showBulkInput, setShowBulkInput] = useState(false);
  
  const [newUser, setNewUser] = useState<UserInvite>({
    email: '',
    full_name: '',
    role: 'viewer'
  });

  const addUser = () => {
    if (!newUser.email || !newUser.full_name) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both email and full name.',
        variant: 'destructive'
      });
      return;
    }

    if (users.some(u => u.email === newUser.email)) {
      toast({
        title: 'Duplicate email',
        description: 'This email has already been added.',
        variant: 'destructive'
      });
      return;
    }

    setUsers([...users, { ...newUser }]);
    setNewUser({ email: '', full_name: '', role: 'viewer' });
  };

  const removeUser = (email: string) => {
    setUsers(users.filter(u => u.email !== email));
  };

  const parseBulkInput = () => {
    const lines = bulkInput.split('\n').filter(l => l.trim());
    const parsed: UserInvite[] = [];
    const errors: string[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const [email, full_name, role = 'viewer'] = parts;
        if (email && full_name) {
          if (!users.some(u => u.email === email) && !parsed.some(p => p.email === email)) {
            parsed.push({
              email,
              full_name,
              role: (ORG_ROLES.includes(role as OrgRole) ? role : 'viewer') as OrgRole
            });
          }
        } else {
          errors.push(`Line ${idx + 1}: Missing email or name`);
        }
      } else {
        errors.push(`Line ${idx + 1}: Invalid format (expected: email, name, role)`);
      }
    });

    if (errors.length > 0) {
      toast({
        title: 'Some lines had errors',
        description: errors.slice(0, 3).join('\n'),
        variant: 'destructive'
      });
    }

    if (parsed.length > 0) {
      setUsers([...users, ...parsed]);
      setBulkInput('');
      setShowBulkInput(false);
      toast({
        title: 'Users added',
        description: `Added ${parsed.length} user(s) from bulk input.`
      });
    }
  };

  const handleSubmit = async () => {
    if (users.length === 0) {
      await onComplete(3, { users: [], invited_users: [], skipped: true });
      return;
    }

    setIsLoading(true);
    const invitedUsers: string[] = [];
    const errors: string[] = [];

    try {
      for (const user of users) {
        const { data, error } = await supabase.functions.invoke('send-user-invitation', {
          body: {
            email: user.email,
            invitationType: 'organization_member',
            organizationId: organizationId,
            role: user.role,
            customMessage: `Welcome to ${organizationName || 'the organization'}! You've been invited to join as a ${user.role}.`
          }
        });

        if (error) {
          errors.push(`${user.email}: ${error.message}`);
        } else if (!data?.success) {
          errors.push(`${user.email}: ${data?.error || 'Failed to send invitation'}`);
        } else {
          invitedUsers.push(user.email);
          
          await supabase.rpc('log_admin_action', {
            _action_type: 'invite_user',
            _table_affected: 'user_invitations',
            _record_id: data.invitation_id || null,
            _old_value: null,
            _new_value: { email: user.email, role: user.role, organization_id: organizationId }
          });
        }
      }

      if (errors.length > 0) {
        toast({
          title: 'Some invitations failed',
          description: errors.slice(0, 3).join('\n'),
          variant: 'destructive'
        });
      }

      if (invitedUsers.length > 0) {
        toast({
          title: 'Invitations sent',
          description: `Successfully sent ${invitedUsers.length} invitation(s).`
        });
      }

      await onComplete(3, { users, invited_users: invitedUsers, errors });
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to send invitations. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'editor': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-xl border border-[hsl(var(--portal-accent-blue))]/20 bg-[hsl(var(--portal-accent-blue))]/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10 flex items-center justify-center flex-shrink-0">
            <Send className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">Secure Email Invitations</p>
            <p className="text-[12px] text-[hsl(var(--portal-text-secondary))] mt-0.5">
              Invited users will receive an email with a secure link to create their account. No temporary passwords are sent.
            </p>
          </div>
        </div>
      </div>

      {/* Add User Card */}
      <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10 flex items-center justify-center">
              <UserPlus className="w-[18px] h-[18px] text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[hsl(var(--portal-text-primary))]">Add Team Member</h3>
              <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Invite users to join this organization</p>
            </div>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-medium text-[hsl(var(--portal-text-secondary))]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] focus:border-[hsl(var(--portal-accent-blue))] focus:ring-1 focus:ring-[hsl(var(--portal-accent-blue))]/20 transition-colors placeholder:text-[hsl(var(--portal-text-muted))]/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-[13px] font-medium text-[hsl(var(--portal-text-secondary))]">Full Name</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={newUser.full_name}
                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] focus:border-[hsl(var(--portal-accent-blue))] focus:ring-1 focus:ring-[hsl(var(--portal-accent-blue))]/20 transition-colors placeholder:text-[hsl(var(--portal-text-muted))]/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-[13px] font-medium text-[hsl(var(--portal-text-secondary))]">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: OrgRole) => 
                  setNewUser({ ...newUser, role: value })
                }
              >
                <SelectTrigger className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                  <SelectItem value="manager">Manager (full editing)</SelectItem>
                  <SelectItem value="editor">Editor (basic editing)</SelectItem>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={addUser} variant="outline" size="sm" className="h-9">
            <Plus className="h-4 w-4 mr-2" />
            Add to List
          </Button>
        </div>
      </div>

      {/* Bulk Import Card */}
      <Collapsible open={showBulkInput} onOpenChange={setShowBulkInput}>
        <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
          <CollapsibleTrigger asChild>
            <div className="px-5 py-4 cursor-pointer hover:bg-[hsl(var(--portal-bg-hover))] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--portal-accent-purple))]/10 flex items-center justify-center">
                    <Upload className="w-[18px] h-[18px] text-[hsl(var(--portal-accent-purple))]" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-[hsl(var(--portal-text-primary))]">Bulk Import</h3>
                    <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Import multiple users at once via CSV</p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-[hsl(var(--portal-text-muted))] transition-transform ${showBulkInput ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5 space-y-3">
              <div className="space-y-2">
                <Label className="text-[12px] text-[hsl(var(--portal-text-muted))]">Format: email, name, role (one per line)</Label>
                <Textarea
                  placeholder="john@example.com, John Doe, admin&#10;jane@example.com, Jane Smith, viewer"
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                  rows={4}
                  className="bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] text-[13px]"
                />
              </div>
              <Button onClick={parseBulkInput} variant="outline" size="sm" className="h-9">
                Parse & Add
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Users List Card */}
      <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))]/50">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">
              Invite List
            </span>
            {users.length > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {users.length} user{users.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        
        {users.length > 0 ? (
          <div className="divide-y divide-[hsl(var(--portal-border))]">
            {users.map(user => (
              <div key={user.email} className="px-5 py-3 flex items-center justify-between hover:bg-[hsl(var(--portal-bg-hover))] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--portal-bg-tertiary))] flex items-center justify-center">
                    <Mail className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">{user.full_name}</p>
                    <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(user.role)} className="text-[11px]">
                    {user.role}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUser(user.email)}
                    className="h-8 w-8 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl border-2 border-dashed border-[hsl(var(--portal-border))] flex items-center justify-center">
              <Users className="h-5 w-5 text-[hsl(var(--portal-text-muted))]" />
            </div>
            <p className="text-[13px] font-medium text-[hsl(var(--portal-text-secondary))]">No users added yet</p>
            <p className="text-[12px] text-[hsl(var(--portal-text-muted))] mt-1">Add users to invite, or skip this step</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="h-10 px-5">
          Back
        </Button>
        <div className="flex gap-2">
          {users.length === 0 && (
            <Button variant="ghost" onClick={handleSubmit} disabled={isLoading} className="h-10 px-5">
              Skip for now
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isLoading} className="h-10 px-5">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {users.length > 0 ? 'Sending Invitations...' : 'Continuing...'}
              </>
            ) : users.length > 0 ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invitations & Continue
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
