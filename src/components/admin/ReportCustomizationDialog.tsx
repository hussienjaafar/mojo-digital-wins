import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReportCustomization from "@/components/client/ReportCustomization";

interface Props {
  scheduleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const ReportCustomizationDialog = ({ scheduleId, open, onOpenChange, onSave }: Props) => {
  const handleSave = () => {
    onSave?.();
    onOpenChange(false);
  };

  if (!scheduleId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Report</DialogTitle>
          <DialogDescription>
            Configure what metrics, charts, and styling appear in your automated reports
          </DialogDescription>
        </DialogHeader>
        <ReportCustomization scheduleId={scheduleId} onSave={handleSave} />
      </DialogContent>
    </Dialog>
  );
};

export default ReportCustomizationDialog;
