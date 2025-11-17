import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info('Installation is not available on this device/browser');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('App installed successfully!');
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation />
      <main className="container mx-auto px-4 py-8 mt-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-4 text-center">Install Molitico</h1>
          <p className="text-center text-muted-foreground mb-8">
            Get the best experience with our installable web app
          </p>

          {isInstalled ? (
            <Card className="mb-8 border-primary">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Already Installed!</h3>
                  <p className="text-muted-foreground">
                    Molitico is already installed on your device. You can find it on your home screen.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {isInstallable && (
                <Card className="mb-8 border-primary">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Button
                        size="lg"
                        onClick={handleInstallClick}
                        className="mb-4"
                      >
                        <Download className="mr-2 h-5 w-5" />
                        Install App
                      </Button>
                      <p className="text-sm text-muted-foreground">
                        Click above to install Molitico on your device
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5" />
                      Desktop Installation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Click the install button above (Chrome/Edge)</li>
                      <li>Or click the install icon in the address bar</li>
                      <li>Follow the prompts to install</li>
                      <li>Find Molitico in your apps menu</li>
                    </ol>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Mobile Installation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm">
                      <div>
                        <p className="font-semibold mb-1">iPhone/iPad:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Tap the Share button</li>
                          <li>Select "Add to Home Screen"</li>
                          <li>Tap "Add" to confirm</li>
                        </ol>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">Android:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Tap the menu (3 dots)</li>
                          <li>Select "Install app" or "Add to Home screen"</li>
                          <li>Tap "Install" to confirm</li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Why Install?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Works offline - access news and bills without internet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Faster loading with cached content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Push notifications for breaking news and bill updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Full-screen app experience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  <span>Easy access from your home screen</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
