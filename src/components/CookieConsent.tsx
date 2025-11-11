import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie } from "lucide-react";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  advertising: boolean;
  functional: boolean;
}

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true, cannot be disabled
    analytics: false,
    advertising: false,
    functional: false,
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consentGiven = localStorage.getItem("cookieConsent");
    if (!consentGiven) {
      // Show banner after a short delay for better UX
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      // Load saved preferences
      try {
        const savedPreferences = JSON.parse(consentGiven);
        setPreferences(savedPreferences);
      } catch (error) {
        console.error("Error parsing cookie preferences:", error);
      }
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem("cookieConsent", JSON.stringify(prefs));
    setPreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);

    // Apply or remove tracking scripts based on preferences
    applyPreferences(prefs);
  };

  const applyPreferences = (prefs: CookiePreferences) => {
    // Analytics
    if (prefs.analytics) {
      // Enable Google Analytics or other analytics tools
      console.log("Analytics cookies enabled");
      // Example: window.gtag('consent', 'update', { analytics_storage: 'granted' });
    } else {
      console.log("Analytics cookies disabled");
      // Example: window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }

    // Advertising
    if (prefs.advertising) {
      // Enable Facebook Pixel and other advertising cookies
      console.log("Advertising cookies enabled");
      // Example: window.gtag('consent', 'update', { ad_storage: 'granted' });
    } else {
      console.log("Advertising cookies disabled");
      // Example: window.gtag('consent', 'update', { ad_storage: 'denied' });
    }

    // Functional
    if (prefs.functional) {
      console.log("Functional cookies enabled");
    } else {
      console.log("Functional cookies disabled");
    }
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      analytics: true,
      advertising: true,
      functional: true,
    };
    savePreferences(allAccepted);
  };

  const handleRejectAll = () => {
    const onlyEssential: CookiePreferences = {
      essential: true,
      analytics: false,
      advertising: false,
      functional: false,
    };
    savePreferences(onlyEssential);
  };

  const handleCustomize = () => {
    setShowSettings(true);
  };

  const handleSaveCustom = () => {
    savePreferences(preferences);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <>
      {/* Cookie Consent Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-1">We Value Your Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your browsing experience, serve personalized political ads, and analyze our traffic. 
                  By clicking "Accept All", you consent to our use of cookies.{" "}
                  <Link to="/cookie-policy" className="text-primary hover:underline">
                    Learn more
                  </Link>
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                onClick={handleRejectAll}
                className="flex-1 md:flex-initial"
              >
                Reject All
              </Button>
              <Button
                variant="secondary"
                onClick={handleCustomize}
                className="flex-1 md:flex-initial"
              >
                Customize
              </Button>
              <Button
                variant="default"
                onClick={handleAcceptAll}
                className="flex-1 md:flex-initial"
              >
                Accept All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle className="text-2xl">Cookie Preferences</DialogTitle>
            <DialogDescription>
              Manage your cookie settings. Essential cookies are required for the website to function and cannot be disabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Essential Cookies */}
            <div className="flex items-start justify-between gap-4 p-4 border border-border rounded-lg bg-muted/50">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="essential" className="text-base font-semibold">
                    Essential Cookies
                  </Label>
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                    Always Active
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  These cookies are necessary for the website to function and cannot be disabled. 
                  They enable basic features like page navigation, secure areas, and form submissions.
                </p>
              </div>
              <Switch
                id="essential"
                checked={true}
                disabled
                className="mt-1"
              />
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-start justify-between gap-4 p-4 border border-border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="analytics" className="text-base font-semibold mb-2 block">
                  Analytics Cookies
                </Label>
                <p className="text-sm text-muted-foreground">
                  These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. 
                  Includes Google Analytics.
                </p>
              </div>
              <Switch
                id="analytics"
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, analytics: checked })
                }
                className="mt-1"
              />
            </div>

            {/* Advertising Cookies */}
            <div className="flex items-start justify-between gap-4 p-4 border border-border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="advertising" className="text-base font-semibold mb-2 block">
                  Advertising Cookies
                </Label>
                <p className="text-sm text-muted-foreground">
                  These cookies are used to deliver relevant political advertisements and track campaign performance. 
                  Includes Facebook Pixel, Google Ads, and other advertising platforms.
                </p>
              </div>
              <Switch
                id="advertising"
                checked={preferences.advertising}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, advertising: checked })
                }
                className="mt-1"
              />
            </div>

            {/* Functional Cookies */}
            <div className="flex items-start justify-between gap-4 p-4 border border-border rounded-lg">
              <div className="flex-1">
                <Label htmlFor="functional" className="text-base font-semibold mb-2 block">
                  Functional Cookies
                </Label>
                <p className="text-sm text-muted-foreground">
                  These cookies enable enhanced functionality and personalization, such as remembering your preferences, 
                  language settings, and form auto-fill.
                </p>
              </div>
              <Switch
                id="functional"
                checked={preferences.functional}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, functional: checked })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleRejectAll}
              className="sm:w-auto"
            >
              Reject All
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-initial"
              >
                Accept All
              </Button>
              <Button
                onClick={handleSaveCustom}
                className="flex-1 sm:flex-initial"
              >
                Save Preferences
              </Button>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              to="/cookie-policy"
              className="text-sm text-primary hover:underline"
              onClick={() => setShowSettings(false)}
            >
              Read our Cookie Policy
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsent;
