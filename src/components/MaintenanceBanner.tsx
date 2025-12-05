import { AlertTriangle, X } from 'lucide-react';
import { useMaintenanceMode } from '@/contexts/MaintenanceContext';
import { Button } from '@/components/ui/button';

export const MaintenanceBanner = () => {
  const { isMaintenanceMode, setMaintenanceMode, maintenanceMessage } = useMaintenanceMode();

  if (!isMaintenanceMode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-amber-950 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-medium">{maintenanceMessage}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMaintenanceMode(false)}
        className="text-amber-950 hover:bg-amber-600/50 hover:text-amber-950"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
};
