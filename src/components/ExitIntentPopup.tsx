import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ParticleButton } from "./ParticleButton";
import { X } from "lucide-react";

export const ExitIntentPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Check if popup was already shown in this session
    const popupShown = sessionStorage.getItem("exitIntentShown");
    if (popupShown === "true") {
      setHasShown(true);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    
    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger if mouse leaves from the top of the viewport
      // and hasn't been shown yet
      if (e.clientY <= 0 && !hasShown && !isOpen) {
        // Small delay to avoid accidental triggers
        timeoutId = setTimeout(() => {
          setIsOpen(true);
          setHasShown(true);
          sessionStorage.setItem("exitIntentShown", "true");
        }, 100);
      }
    };

    const handleMouseEnter = () => {
      // Clear timeout if mouse comes back
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [hasShown, isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-2 border-secondary">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-secondary via-primary to-destructive p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="font-bebas text-4xl md:text-5xl leading-tight mb-3">
                Wait! Before You Go...
              </DialogTitle>
              <DialogDescription className="text-white/90 text-lg leading-relaxed">
                You're just one conversation away from transforming your campaign's fundraising.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-foreground">
              Book a Free 30-Minute Strategy Call
            </h3>
            <ul className="space-y-3 text-foreground/80">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                </div>
                <span>Discover how to achieve 300%+ ROI on your fundraising</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                </div>
                <span>Get a custom strategy tailored to your organization</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                </div>
                <span>Learn proven tactics from winning progressive campaigns</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4 pt-4">
            <ParticleButton
              href="https://calendly.com/mo-molitico/30min"
              size="lg"
              particleColor="hsl(var(--secondary))"
              particleCount={25}
              className="w-full text-lg font-bold"
            >
              Yes! Book My Free Strategy Call
            </ParticleButton>
            
            <button
              onClick={handleClose}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              No thanks, I'll continue browsing
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              🔒 No credit card required • 100% free consultation
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
