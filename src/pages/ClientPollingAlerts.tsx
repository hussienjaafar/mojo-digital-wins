import { ClientShell } from "@/components/client/ClientShell";
import { V3PageContainer } from "@/components/v3";
import PollingAlertSettings from "@/components/client/PollingAlertSettings";
import { Bell } from "lucide-react";

export default function ClientPollingAlerts() {
  return (
    <ClientShell pageTitle="Polling Alerts" showDateControls={false}>
      <V3PageContainer
        title="Polling Alert Settings"
        description="Configure notifications for significant polling changes"
        icon={Bell}
      >
        <PollingAlertSettings />
      </V3PageContainer>
    </ClientShell>
  );
}
