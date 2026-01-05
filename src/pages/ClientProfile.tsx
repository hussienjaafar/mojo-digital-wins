import { ClientLayout } from "@/components/client/ClientLayout";
import { OrganizationDetails } from "@/components/client/OrganizationDetails";
import { TeamManagement } from "@/components/client/TeamManagement";
import OrganizationProfile from "@/components/client/OrganizationProfile";
import { ProfileSetupWizard } from "@/components/client/ProfileSetupWizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardDescription, PortalCardContent } from "@/components/portal/PortalCard";
import { Building2, Users, Sparkles, Settings2 } from "lucide-react";

export default function ClientProfile() {
  return (
    <ClientLayout showDateControls={false}>
      <div className="portal-scrollbar max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--portal-accent-blue) / 0.1)' }}>
              <Building2 className="h-6 w-6" style={{ color: 'hsl(var(--portal-accent-blue))' }} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold portal-text-primary">Organization Profile</h1>
          </div>
          <p className="portal-text-secondary text-sm sm:text-base">
            Manage your organization settings, team members, and personalization preferences
          </p>
        </div>

        {/* Profile Tabs */}
        <Tabs defaultValue="organization" className="w-full">
          <TabsList className="portal-bg-secondary border border-border/30 mb-6">
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Organization</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Team</span>
            </TabsTrigger>
            <TabsTrigger value="personalization" className="gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Personalization</span>
            </TabsTrigger>
            <TabsTrigger value="ai-profile" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">AI Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Organization Details</PortalCardTitle>
                <PortalCardDescription>
                  Update your organization's name, logo, and contact information
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <OrganizationDetails />
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="team">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Team Management</PortalCardTitle>
                <PortalCardDescription>
                  Manage team members and their roles within your organization
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <TeamManagement />
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="personalization">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Personalization Settings</PortalCardTitle>
                <PortalCardDescription>
                  Configure your topic interests, geographic focus, and alert preferences to receive more relevant opportunities
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <ProfileSetupWizard />
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="ai-profile">
            <OrganizationProfile />
          </TabsContent>
        </Tabs>
      </div>
    </ClientLayout>
  );
}
