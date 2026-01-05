import { ClientLayout } from "@/components/client/ClientLayout";
import PollingAlertSettings from "@/components/client/PollingAlertSettings";

export default function ClientPollingAlerts() {
  return (
    <ClientLayout showDateControls={false}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Polling Alert Settings</h1>
          <p className="text-sm text-muted-foreground">Configure notifications for polling changes</p>
        </div>
        <PollingAlertSettings />
      </div>
    </ClientLayout>
  );
}
