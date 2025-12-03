import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ParticleButton } from "./ParticleButton";
import { X, Clock, Users } from "lucide-react";

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
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden border-2 border-secondary">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-secondary via-primary to-destructive p-8 text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary-foreground)/0.1),transparent_50%)]" />
          <div className="relative z-10">
            <DialogHeader>
              <DialogTitle className="font-bebas text-4xl md:text-5xl leading-tight mb-3">
                Quick Question...
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/90 text-lg leading-relaxed">
                Would 30 minutes on the phone help you figure out your fundraising strategy?
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Social Proof - Recent Activity */}
          <div className="flex items-center justify-between gap-4 p-4 bg-secondary/5 rounded-lg border border-secondary/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-secondary" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-foreground">12 campaigns booked this week</p>
                <p className="text-muted-foreground">Most popular time: Tuesday afternoons</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground">
              Here's what we'll cover:
            </h3>
            <ul className="space-y-3 text-foreground/80">
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                <span>We'll look at what's working (or not working) in your current fundraising</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                <span>Talk through whether SMS, email, or digital ads make sense for your organization</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                <span>You'll leave with at least one concrete idea you can implement right away</span>
              </li>
            </ul>
          </div>


          <div className="space-y-4 pt-2">
            <ParticleButton
              href="https://calendly.com/molitico/30min"
              size="lg"
              particleColor="hsl(var(--secondary))"
              particleCount={25}
              className="w-full text-lg font-bold"
            >
              Sure, Let's Talk
            </ParticleButton>
            
            <button
              onClick={handleClose}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Not right now
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              No pressure. No pitch deck. Just a conversation.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
