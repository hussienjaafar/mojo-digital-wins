import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { V3Button } from "@/components/v3/V3Button";
import { UserMinus, Shield, Loader2 } from "lucide-react";

interface BulkUserActionsProps {
  selectedUserIds: string[];
  organizationId: string;
  onActionComplete: () => void;
  onClearSelection: () => void;
}

export function BulkUserActions({
  selectedUserIds,
  organizationId,
  onActionComplete,
  onClearSelection,
}: BulkUserActionsProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState("viewer");

  const handleBulkRoleUpdate = async () => {
    if (selectedUserIds.length === 0) return;
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc("bulk_update_user_roles", {
        p_user_ids: selectedUserIds,
        p_new_role: selectedRole,
        p_organization_id: organizationId,
        p_actor_id: user?.id,
        p_actor_name: user?.email,
      });

      if (error) throw error;

      const result = data as { success: boolean; updated_count: number };
      
      if (result.success) {
        toast({
          title: "Roles Updated",
          description: `Updated ${result.updated_count} user(s) to ${selectedRole} role`,
        });
        onActionComplete();
        onClearSelection();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update roles",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setShowRoleDialog(false);
    }
  };

  const handleBulkRemove = async () => {
    if (selectedUserIds.length === 0) return;
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc("bulk_remove_users", {
        p_user_ids: selectedUserIds,
        p_organization_id: organizationId,
        p_actor_id: user?.id,
        p_actor_name: user?.email,
      });

      if (error) throw error;

      const result = data as { success: boolean; deleted_count: number };
      
      if (result.success) {
        toast({
          title: "Users Removed",
          description: `Removed ${result.deleted_count} user(s) from organization`,
        });
        onActionComplete();
        onClearSelection();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove users",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setShowRemoveDialog(false);
    }
  };

  if (selectedUserIds.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <Badge variant="secondary" className="font-medium">
          {selectedUserIds.length} selected
        </Badge>
        
        <div className="flex items-center gap-2 ml-auto">
          <V3Button
            variant="outline"
            size="sm"
            onClick={() => setShowRoleDialog(true)}
            leftIcon={<Shield className="h-4 w-4" />}
          >
            Change Role
          </V3Button>
          
          <V3Button
            variant="outline"
            size="sm"
            onClick={() => setShowRemoveDialog(true)}
            leftIcon={<UserMinus className="h-4 w-4" />}
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
          >
            Remove
          </V3Button>
          
          <V3Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
          >
            Clear
          </V3Button>
        </div>
      </div>

      {/* Bulk Role Change Dialog */}
      <AlertDialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Role for {selectedUserIds.length} User(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Select the new role to assign to all selected users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                <SelectItem value="editor">Editor (basic editing)</SelectItem>
                <SelectItem value="manager">Manager (full editing)</SelectItem>
                <SelectItem value="admin">Admin (full access)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkRoleUpdate} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                `Update ${selectedUserIds.length} User(s)`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Remove Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedUserIds.length} User(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected users from the organization. They will lose access to the client portal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkRemove} 
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                `Remove ${selectedUserIds.length} User(s)`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
