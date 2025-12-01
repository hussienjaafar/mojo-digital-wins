import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";

// Settings page for MARKETING SITE - NOT a portal page
// Keep original styling, do not apply portal theme
export default function Settings() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      <main className="container mx-auto px-4 py-8 mt-16">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your notification preferences</p>
          </div>
        </div>

        <div className="max-w-2xl">
          <NotificationSettings />
        </div>
      </main>
      <Footer />
    </div>
  );
}
