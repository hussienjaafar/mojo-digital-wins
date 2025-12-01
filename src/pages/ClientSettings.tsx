import { ClientLayout } from "@/components/client/ClientLayout";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardDescription, PortalCardContent } from "@/components/portal/PortalCard";
import { Settings as SettingsIcon, Bell, User, Shield, Palette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClientSettings() {
  return (
    <ClientLayout>
      <div className="portal-scrollbar max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--portal-accent-blue) / 0.1)' }}>
              <SettingsIcon className="h-6 w-6" style={{ color: 'hsl(var(--portal-accent-blue))' }} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold portal-text-primary">Settings</h1>
          </div>
          <p className="portal-text-secondary text-sm sm:text-base">
            Manage your account preferences and portal settings
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="portal-bg-secondary border border-border/30 mb-6">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Notification Preferences</PortalCardTitle>
                <PortalCardDescription>
                  Configure how and when you receive notifications
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <NotificationSettings />
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="profile">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Profile Settings</PortalCardTitle>
                <PortalCardDescription>
                  Manage your personal information and preferences
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <p className="portal-text-secondary text-sm">
                  Profile settings coming soon...
                </p>
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="security">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Security Settings</PortalCardTitle>
                <PortalCardDescription>
                  Manage your password and security preferences
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <p className="portal-text-secondary text-sm">
                  Security settings coming soon...
                </p>
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="appearance">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Appearance Settings</PortalCardTitle>
                <PortalCardDescription>
                  Customize the look and feel of your portal
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <p className="portal-text-secondary text-sm">
                  Appearance settings coming soon...
                </p>
              </PortalCardContent>
            </PortalCard>
          </TabsContent>
        </Tabs>
      </div>
    </ClientLayout>
  );
}
