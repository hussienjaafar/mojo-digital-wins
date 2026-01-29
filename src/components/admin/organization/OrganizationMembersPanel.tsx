import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { V3Button } from '@/components/v3/V3Button';
import { V3Badge } from '@/components/v3/V3Badge';
import { SeatUsageDisplay } from '@/components/client/SeatUsageDisplay';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PortalFormInput } from '@/components/admin/forms/PortalFormInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  ShieldCheck,
  Clock,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OrganizationMembersPanelProps {
  organizationId: string;
  organizationName: string;
}

interface MemberData {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  org_role: string;
  mfa_enabled: boolean;
  last_session: string | null;
  user_status: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
];

export function OrganizationMembersPanel({ organizationId, organizationName }: OrganizationMembersPanelProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<MemberData | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch members using RPC
      const { data: membersData, error: membersError } = await (supabase.rpc as any)(
        'get_user_management_data',
        {
          p_search: searchQuery || null,
          p_org_id: organizationId,
          p_roles: null,
          p_status: null,
          p_limit: 100,
          p_offset: 0,
        }
      );

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Fetch pending invitations
      const { data: invitesData, error: invitesError } = await supabase
        .from('user_invitations')
        .select('id, email, role, expires_at, created_at')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setPendingInvites(invitesData || []);
    } catch (error: any) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organization members',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, searchQuery, toast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingRoleId(userId);
    try {
      const { error } = await supabase
        .from('organization_memberships')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      setMembers(prev =>
        prev.map(m => (m.user_id === userId ? { ...m, org_role: newRole } : m))
      );

      toast({
        title: 'Role Updated',
        description: 'Member role has been updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    
    setRemovingMemberId(memberToRemove.user_id);
    try {
      const { error } = await supabase
        .from('organization_memberships')
        .delete()
        .eq('user_id', memberToRemove.user_id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.user_id !== memberToRemove.user_id));
      setMemberToRemove(null);

      toast({
        title: 'Member Removed',
        description: 'The member has been removed from this organization',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInviteId(inviteId);
    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', inviteId);

      if (error) throw error;

      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));

      toast({
        title: 'Invitation Revoked',
        description: 'The invitation has been cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke invitation',
        variant: 'destructive',
      });
    } finally {
      setRevokingInviteId(null);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const filteredMembers = members.filter(m =>
    m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Seat Usage Display */}
      <SeatUsageDisplay organizationId={organizationId} />

      {/* Members Section */}
      <div className="portal-card p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Users className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
                Organization Members
              </h3>
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <V3Button onClick={() => setInviteDialogOpen(true)} leftIcon={<UserPlus className="w-4 h-4" />}>
            Invite Member
          </V3Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--portal-text-muted))]" />
          <PortalFormInput
            placeholder="Search members..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Members List */}
        <div className="divide-y divide-[hsl(var(--portal-border))]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--portal-text-muted))]" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--portal-text-muted))]">
              {searchQuery ? 'No members match your search' : 'No members found'}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredMembers.map((member, index) => (
                <motion.div
                  key={member.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] text-xs">
                        {getInitials(member.full_name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate text-[hsl(var(--portal-text-primary))]">
                          {member.full_name || member.email.split('@')[0]}
                        </span>
                        {member.mfa_enabled ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--portal-success))]" aria-label="MFA Enabled" />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-[hsl(var(--portal-text-muted))]" aria-label="MFA Disabled" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Last Session */}
                    {member.last_session && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-[hsl(var(--portal-text-muted))]">
                        <Clock className="w-3 h-3" />
                        <span>{formatDistanceToNow(new Date(member.last_session), { addSuffix: true })}</span>
                      </div>
                    )}

                    {/* Role Selector */}
                    <Select
                      value={member.org_role}
                      onValueChange={v => handleRoleChange(member.user_id, v)}
                      disabled={updatingRoleId === member.user_id}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
                        {updatingRoleId === member.user_id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
                        {ROLE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <V3Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </V3Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
                        <DropdownMenuItem
                          className="text-[hsl(var(--portal-error))] focus:text-[hsl(var(--portal-error))]"
                          onClick={() => setMemberToRemove(member)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove from Organization
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <div className="portal-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-warning)/0.1)]">
              <Mail className="w-5 h-5 text-[hsl(var(--portal-warning))]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
                Pending Invitations
              </h3>
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                {pendingInvites.length} invitation{pendingInvites.length !== 1 ? 's' : ''} waiting for response
              </p>
            </div>
            <V3Badge variant="warning" size="sm">
              {pendingInvites.length} pending
            </V3Badge>
          </div>

          <div className="space-y-2">
            {pendingInvites.map(invite => {
              const expiresIn = new Date(invite.expires_at);
              const isExpiringSoon = expiresIn.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

              return (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] border border-[hsl(var(--portal-border))]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--portal-warning)/0.1)] flex items-center justify-center">
                      <Mail className="w-4 h-4 text-[hsl(var(--portal-warning))]" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                        {invite.email}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
                        <V3Badge variant="muted" size="sm">{invite.role}</V3Badge>
                        <span>
                          Expires {formatDistanceToNow(expiresIn, { addSuffix: true })}
                        </span>
                        {isExpiringSoon && (
                          <V3Badge variant="warning" size="sm">Expiring soon</V3Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <V3Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevokeInvite(invite.id)}
                    disabled={revokingInviteId === invite.id}
                    className="text-[hsl(var(--portal-error))]"
                  >
                    {revokingInviteId === invite.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </V3Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        type="organization_member"
        organizationId={organizationId}
        organizationName={organizationName}
        onSuccess={() => {
          loadMembers();
        }}
      />

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[hsl(var(--portal-text-primary))]">Remove Member</AlertDialogTitle>
            <AlertDialogDescription className="text-[hsl(var(--portal-text-muted))]">
              Are you sure you want to remove{' '}
              <strong className="text-[hsl(var(--portal-text-primary))]">{memberToRemove?.full_name || memberToRemove?.email}</strong> from this
              organization? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.9)] text-white"
            >
              {removingMemberId ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
