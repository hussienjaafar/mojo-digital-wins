import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DisableOrganizationDialogProps {
  organization: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DisableOrganizationDialog({
  organization,
  open,
  onOpenChange,
  onSuccess,
}: DisableOrganizationDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isConfirmed = confirmName.toLowerCase() === organization?.name.toLowerCase();

  const handleDisable = async () => {
    if (!organization || !isConfirmed) return;

    setIsLoading(true);

    try {
      // 1. Disable the organization
      const { error: orgError } = await supabase
        .from("client_organizations")
        .update({ is_active: false })
        .eq("id", organization.id);

      if (orgError) throw orgError;

      // 2. Disable all integrations for this org
      await supabase
        .from("client_api_credentials")
        .update({ is_active: false })
        .eq("organization_id", organization.id);

      // 3. Log audit action
      await supabase.rpc("log_admin_action", {
        _action_type: "disable_organization",
        _table_affected: "client_organizations",
        _record_id: organization.id,
        _old_value: { is_active: true },
        _new_value: { 
          is_active: false,
          disabled_reason: "Admin action",
          integrations_disabled: true,
        },
      });

      toast.success(`Organization "${organization.name}" has been disabled`);
      onSuccess();
      onOpenChange(false);
      setConfirmName("");
    } catch (error) {
      console.error("Failed to disable organization:", error);
      toast.error("Failed to disable organization");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Disable Organization
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This will <strong>immediately</strong> disable the organization and:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Block all client user logins</li>
              <li>Disable all scheduled sync jobs</li>
              <li>Deactivate all integrations</li>
              <li>Stop data pipelines</li>
            </ul>
            <p className="pt-2">
              This action can be reversed by re-enabling the organization.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="confirm-name">
            Type <strong>{organization?.name}</strong> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Organization name"
            className="mt-2"
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmName("")}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisable}
            disabled={!isConfirmed || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Disable Organization
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
