import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Shield, ArrowRight } from "lucide-react";

const Footer = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .insert([
          {
            email: email,
            name: 'Newsletter Subscriber',
            message: 'Newsletter subscription',
            campaign: null,
            organization_type: null
          }
        ]);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You've been subscribed to our newsletter.",
      });
      setEmail("");
    } catch (error) {
      logger.error('Newsletter submission failed', error);
      toast({
        title: "Error",
        description: "Failed to subscribe. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-14 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 md:gap-12">
          {/* Brand */}
          <div>
            <h3 className="text-xl sm:text-2xl font-black mb-4">
              MOLITICO<span className="text-accent">.</span>
            </h3>
            <p className="text-primary-foreground/90 mb-6">
              Turning grassroots energy into unstoppable progressive wins.
            </p>
            {/* Social links removed - update with real URLs when available */}
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/about"
                  className="text-primary-foreground/90 hover:text-accent transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="text-primary-foreground/90 hover:text-accent transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  to="/services"
                  className="text-primary-foreground/90 hover:text-accent transition-colors"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  to="/case-studies"
                  className="text-primary-foreground/90 hover:text-accent transition-colors"
                >
                  Case Studies
                </Link>
              </li>
              <li>
                <Link
                  to="/creative-showcase"
                  className="text-primary-foreground/90 hover:text-accent transition-colors"
                >
                  Creative Showcase
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-primary-foreground/90 hover:text-accent transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold mb-4">Services</h4>
            <ul className="space-y-2 text-primary-foreground/90">
              <li>SMS Fundraising</li>
              <li>Digital Advertising</li>
              <li>Email Campaigns</li>
              <li>Donor Acquisition</li>
              <li>Performance Analytics</li>
            </ul>
          </div>

          {/* Recent Content */}
          <div>
            <h4 className="font-bold mb-4">Featured Content</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/blog/sms-fundraising-political-campaigns-guide"
                  className="text-primary-foreground/90 hover:text-accent transition-colors text-sm flex items-center gap-1 group"
                >
                  SMS Fundraising Guide
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link
                  to="/blog/digital-advertising-progressive-campaigns-meta-google"
                  className="text-primary-foreground/90 hover:text-accent transition-colors text-sm flex items-center gap-1 group"
                >
                  Digital Ads Strategy
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link
                  to="/case-studies/unity-justice-fund"
                  className="text-primary-foreground/90 hover:text-accent transition-colors text-sm flex items-center gap-1 group"
                >
                  Unity Justice Fund Case Study
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link
                  to="/case-studies/nasser-michigan"
                  className="text-primary-foreground/90 hover:text-accent transition-colors text-sm flex items-center gap-1 group"
                >
                  Nasser for Michigan Case Study
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li className="pt-2">
                <Link
                  to="/privacy-policy"
                  className="text-primary-foreground/60 hover:text-accent transition-colors text-xs"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-12 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Newsletter */}
            <div>
              <h4 className="font-bold mb-4">Stay Updated</h4>
              <p className="text-primary-foreground/90 mb-4 text-sm">
                Join our newsletter for progressive strategy insights.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                <Input
                  type="email"
                  placeholder="Your email"
                  className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
                <Button variant="default" size="default" className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Subscribing..." : "Subscribe"}
                </Button>
              </form>
            </div>
          </div>

          <div className="text-center text-primary-foreground/60 text-sm">
            <p className="mb-2 text-primary-foreground/90">
              <span className="font-semibold">Ethical Fundraising Commitment:</span> Performance with principles. We
              prioritize long-term donor relationships and never compromise values for ROI.
            </p>
            <p>© {new Date().getFullYear()} Molitico. All rights reserved.</p>
            <p className="mt-2">
              Paid for by Molitico. Not authorized by any candidate or candidate's committee.
            </p>

            {/* Admin Login Button */}
            <div className="mt-6 pt-4 border-t border-primary-foreground/10">
              <Link to="/admin">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground/40 hover:text-primary-foreground/70 hover:bg-primary-foreground/5 gap-2"
                >
                  <Shield className="w-3 h-3" />
                  <span className="text-xs">Staff Login</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
