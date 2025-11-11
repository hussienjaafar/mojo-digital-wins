import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Facebook, Twitter, Linkedin, Instagram } from "lucide-react";

const Footer = () => {
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Newsletter submission logic would go here
  };

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-black mb-4">
              MOLITICO<span className="text-accent">.</span>
            </h3>
            <p className="text-primary-foreground/80 mb-6">
              Turning grassroots energy into unstoppable progressive wins.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-primary-foreground/80 hover:text-accent transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={20} />
              </a>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-primary-foreground/80 hover:text-accent transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={20} />
              </a>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-primary-foreground/80 hover:text-accent transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-primary-foreground/80 hover:text-accent transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/about"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  to="/services"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  to="/case-studies"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Case Studies
                </Link>
              </li>
              <li>
                <Link
                  to="/creative-showcase"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Creative Showcase
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-bold mb-4">Services</h4>
            <ul className="space-y-2 text-primary-foreground/80">
              <li>SMS Fundraising</li>
              <li>Digital Advertising</li>
              <li>Email Campaigns</li>
              <li>Donor Acquisition</li>
              <li>Performance Analytics</li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/privacy-policy"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms-of-service"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  to="/cookie-policy"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/disclaimer"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Disclaimer
                </Link>
              </li>
              <li>
                <Link
                  to="/accessibility"
                  className="text-primary-foreground/80 hover:text-accent transition-colors"
                >
                  Accessibility
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
              <p className="text-primary-foreground/80 mb-4 text-sm">
                Join our newsletter for progressive strategy insights.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                <Input
                  type="email"
                  placeholder="Your email"
                  className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                  required
                />
                <Button variant="cta" size="default" className="w-full" type="submit">
                  Subscribe
                </Button>
              </form>
            </div>
          </div>

          <div className="text-center text-primary-foreground/60 text-sm">
            <p className="mb-2 text-primary-foreground/80">
              <span className="font-semibold">Ethical Fundraising Commitment:</span> Performance with principles. We
              prioritize long-term donor relationships and never compromise values for ROI.
            </p>
            <p>© {new Date().getFullYear()} Molitico. All rights reserved.</p>
            <p className="mt-2">
              Paid for by Molitico. Not authorized by any candidate or candidate's committee.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
