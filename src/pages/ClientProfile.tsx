import { ClientLayout } from "@/components/client/ClientLayout";
import OrganizationProfile from "@/components/client/OrganizationProfile";

export default function ClientProfile() {
  return (
    <ClientLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Organization Profile</h1>
          <p className="text-sm text-muted-foreground">Configure your organization's profile and AI recommendations</p>
        </div>
        <OrganizationProfile />
      </div>
    </ClientLayout>
  );
}
