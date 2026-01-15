import { AlertCircle, X } from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedUserName, impersonatedOrgName, clearImpersonation } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const handleExit = () => {
    clearImpersonation();
    navigate('/admin');
  };

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-amber-900 dark:text-amber-100">
          {impersonatedUserName === "System Admin" ? (
            <>
              <strong>Admin View:</strong> Viewing {impersonatedOrgName} as System Admin
            </>
          ) : (
            <>
              <strong>Admin View:</strong> Viewing as {impersonatedUserName} ({impersonatedOrgName})
            </>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExit}
          className="ml-4 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <X className="h-3 w-3 mr-1" />
          Exit
        </Button>
      </AlertDescription>
    </Alert>
  );
};
