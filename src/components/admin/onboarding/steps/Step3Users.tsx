import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserInvite, WizardStep } from '../types';
import { Users, Plus, Trash2, Upload, Mail, Loader2, Send, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const ORG_ROLES = ['admin', 'manager', 'editor', 'viewer'] as const;
type OrgRole = typeof ORG_ROLES[number];

interface Step3UsersProps {
  organizationId: string;
  organizationName?: string;
  stepData: Record<string, unknown>;
  onComplete: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

export function Step3Users({ organizationId, organizationName, stepData, onComplete, onBack }: Step3UsersProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserInvite[]>(
    (stepData.users as UserInvite[]) || []
  );
  const [bulkInput, setBulkInput] = useState('');
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
        description: 'Please enter both email and full name',
        variant: 'destructive'
      });
      return;
    }

    if (users.some(u => u.email === newUser.email)) {
      toast({
        title: 'Duplicate email',
        description: 'This email has already been added',
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
        errors.push(`Line ${idx + 1}: Invalid format`);
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
        description: `Added ${parsed.length} user(s)`
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
          errors.push(`${user.email}: ${data?.error || 'Failed to send'}`);
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
          description: `Successfully sent ${invitedUsers.length} invitation(s)`
        });
      }

      await onComplete(3, { users, invited_users: invitedUsers, errors });
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to send invitations',
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
    <div className="space-y-8">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-[hsl(var(--portal-accent-blue))]/5 border border-[hsl(var(--portal-accent-blue))]/20">
        <Info className="h-4 w-4 text-[hsl(var(--portal-accent-blue))] mt-0.5 flex-shrink-0" />
        <div className="text-sm text-[hsl(var(--portal-text-secondary))]">
          <p className="font-medium text-[hsl(var(--portal-text-primary))]">Secure invitation flow</p>
          <p className="mt-1">Invited users receive an email with a secure link to create their account. No temporary passwords are sent.</p>
        </div>
      </div>

      {/* Add User Section */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
            <Users className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">Add Team Members</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Invite users who will access the platform</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={newUser.email}
              onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              className="h-10 bg-[hsl(var(--portal-bg-secondary))]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-sm">Full Name</Label>
            <Input
              id="full_name"
              placeholder="John Doe"
              value={newUser.full_name}
              onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
              className="h-10 bg-[hsl(var(--portal-bg-secondary))]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role" className="text-sm">Role</Label>
            <Select
              value={newUser.role}
              onValueChange={(value: OrgRole) => setNewUser({ ...newUser, role: value })}
            >
              <SelectTrigger className="h-10 bg-[hsl(var(--portal-bg-secondary))]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={addUser} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add to List
          </Button>
          
          <Collapsible open={showBulkInput} onOpenChange={setShowBulkInput}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-[hsl(var(--portal-text-muted))]">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
                {showBulkInput ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Bulk Input */}
        <Collapsible open={showBulkInput} onOpenChange={setShowBulkInput}>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="p-4 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]/50">
              <Label className="text-sm">Paste CSV (email, name, role per line)</Label>
              <Textarea
                placeholder="john@example.com, John Doe, admin&#10;jane@example.com, Jane Smith, viewer"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                rows={4}
                className="mt-2 bg-[hsl(var(--portal-bg-card))]"
              />
              <Button onClick={parseBulkInput} variant="secondary" size="sm" className="mt-3">
                Parse & Add
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      {/* Users List */}
      {users.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              Users to Invite ({users.length})
            </h4>
          </div>
          <div className="rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden">
            <div className="divide-y divide-[hsl(var(--portal-border))]">
              {users.map(user => (
                <div key={user.email} className="p-3 flex items-center justify-between bg-[hsl(var(--portal-bg-card))]">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[hsl(var(--portal-bg-tertiary))]">
                      <Mail className="h-3.5 w-3.5 text-[hsl(var(--portal-text-muted))]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">{user.full_name}</p>
                      <p className="text-xs text-[hsl(var(--portal-text-muted))]">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                      {user.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeUser(user.email)}
                    >
                      <Trash2 className="h-4 w-4 text-[hsl(var(--portal-error))]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <div className="text-center py-12 rounded-lg border border-dashed border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]/30">
          <Users className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--portal-text-muted))]/50" />
          <p className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">No users added yet</p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
            Add users to invite, or skip this step to add them later
          </p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-between pt-6 border-t border-[hsl(var(--portal-border))]">
        <Button variant="outline" onClick={onBack} className="h-10">
          Back
        </Button>
        <div className="flex gap-3">
          {users.length === 0 && (
            <Button 
              variant="ghost" 
              onClick={handleSubmit} 
              disabled={isLoading}
              className="h-10 text-[hsl(var(--portal-text-muted))]"
            >
              Skip for now
            </Button>
          )}
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className="min-w-[160px] h-10"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : users.length > 0 ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Invitations
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
