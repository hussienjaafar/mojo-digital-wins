import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserInvite, WizardStep } from '../types';
import { Users, Plus, Trash2, Upload, Mail, Loader2 } from 'lucide-react';

interface Step3UsersProps {
  organizationId: string;
  stepData: Record<string, unknown>;
  onComplete: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

export function Step3Users({ organizationId, stepData, onComplete, onBack }: Step3UsersProps) {
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
              role: (['admin', 'manager', 'viewer'].includes(role) ? role : 'viewer') as 'admin' | 'manager' | 'viewer'
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
      // Allow skipping - just move to next step
      await onComplete(3, { users: [], created_users: [], skipped: true });
      return;
    }

    setIsLoading(true);
    const createdUsers: string[] = [];
    const errors: string[] = [];

    try {
      for (const user of users) {
        const { error } = await supabase.functions.invoke('create-client-user', {
          body: {
            email: user.email,
            full_name: user.full_name,
            organization_id: organizationId,
            role: user.role
          }
        });

        if (error) {
          errors.push(`${user.email}: ${error.message}`);
        } else {
          createdUsers.push(user.email);
          
          // Log audit action for each user
          await supabase.rpc('log_admin_action', {
            _action_type: 'create_user',
            _table_affected: 'client_users',
            _record_id: null,
            _old_value: null,
            _new_value: { email: user.email, role: user.role, organization_id: organizationId }
          });
        }
      }

      if (errors.length > 0) {
        toast({
          title: 'Some users failed to create',
          description: errors.slice(0, 3).join('\n'),
          variant: 'destructive'
        });
      }

      if (createdUsers.length > 0) {
        toast({
          title: 'Users created',
          description: `Successfully created ${createdUsers.length} user(s).`
        });
      }

      await onComplete(3, { users, created_users: createdUsers, errors });
    } catch (error) {
      console.error('Error creating users:', error);
      toast({
        title: 'Error',
        description: 'Failed to create users. Please try again.',
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
      default: return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Create Initial Users
        </CardTitle>
        <CardDescription>
          Add team members who will have access to this organization's dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Single User */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={newUser.full_name}
                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: 'admin' | 'manager' | 'viewer') => 
                  setNewUser({ ...newUser, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={addUser} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Bulk Input Toggle */}
        <div className="border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBulkInput(!showBulkInput)}
          >
            <Upload className="h-4 w-4 mr-2" />
            {showBulkInput ? 'Hide' : 'Show'} Bulk Import
          </Button>
          
          {showBulkInput && (
            <div className="mt-4 space-y-2">
              <Label>Paste CSV (email, name, role per line)</Label>
              <Textarea
                placeholder="john@example.com, John Doe, admin&#10;jane@example.com, Jane Smith, viewer"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                rows={4}
              />
              <Button onClick={parseBulkInput} variant="outline" size="sm">
                Parse & Add
              </Button>
            </div>
          )}
        </div>

        {/* Users List */}
        {users.length > 0 && (
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/50">
              <span className="text-sm font-medium">
                Users to Create ({users.length})
              </span>
            </div>
            <div className="divide-y">
              {users.map(user => (
                <div key={user.email} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUser(user.email)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {users.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No users added yet</p>
            <p className="text-sm">Add at least one user to continue</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <div className="flex gap-2">
            {users.length === 0 && (
              <Button variant="ghost" onClick={handleSubmit} disabled={isLoading}>
                Skip for now
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {users.length > 0 ? 'Creating Users...' : 'Continuing...'}
                </>
              ) : users.length > 0 ? (
                'Create Users & Continue'
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
