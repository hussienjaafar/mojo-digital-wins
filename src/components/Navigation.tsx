import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { supabase } from "@/integrations/supabase/client";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "About", path: "/about" },
    { name: "Services", path: "/services" },
    { name: "Work", path: "/case-studies" },
    { name: "Contact", path: "/contact" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-primary shadow-sm" : ""
      }`}
    >
      <div className={`max-w-[1280px] mx-auto px-6 ${
        !isScrolled ? "backdrop-blur-lg bg-primary/45 rounded-b-xl mt-0 shadow-md" : ""
      }`}>
        <div className="flex items-center justify-between h-16 sm:h-18 md:h-20">
          {/* Logo - 20% larger */}
          <Link to="/" className="flex items-center gap-2">
            <div className={`transition-colors ${
              isScrolled ? "text-primary-foreground" : "text-primary-foreground drop-shadow-[0_2px_12px_rgba(10,30,62,0.9)]"
            }`}>
              <div className="font-bebas text-[1.8rem] sm:text-[2rem] md:text-[2.4rem] leading-none tracking-wide">
                MOLITICO
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-[16px] md:text-[17px] font-bold tracking-tight transition-all relative group ${
                  isActive(link.path)
                    ? isScrolled ? "text-primary-foreground" : "text-primary-foreground drop-shadow-[0_2px_8px_rgba(10,30,62,0.9)]"
                    : isScrolled ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-primary-foreground hover:text-primary-foreground drop-shadow-[0_2px_8px_rgba(10,30,62,0.9)]"
                }`}
                style={{ textShadow: !isScrolled ? '0 0 2px rgba(10,30,62,0.5), 0 1px 3px rgba(10,30,62,0.8)' : 'none' }}
              >
                {link.name}
                <span className={`absolute bottom-0 left-0 w-full h-[2px] bg-secondary transition-transform duration-200 ${
                  isActive(link.path) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`} />
              </Link>
            ))}
          </div>

          {/* CTA Button with Theme Toggle */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Button 
              variant="default" 
              size="default" 
              asChild
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold rounded-lg px-6 shadow-[0_4px_16px_rgba(20,100,217,0.4)] hover:shadow-[0_6px_24px_rgba(20,100,217,0.6)] hover:scale-[1.03] transition-all duration-300"
            >
              <Link to="/contact">Work With Us</Link>
            </Button>
            {user && <NotificationCenter />}
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-primary-foreground/10 ${
              isScrolled ? "text-primary-foreground" : "text-primary-foreground"
            }`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Full-Screen Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-primary animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div className="flex flex-col h-full">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-primary-foreground/20">
              <div className="font-bebas text-2xl text-primary-foreground">MOLITICO</div>
              <button
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-primary-foreground hover:bg-primary-foreground/10 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>

            {/* Mobile Menu Links - Optimized spacing and layout */}
            <nav className="flex flex-col pt-4 pb-2 px-6 space-y-3" aria-label="Mobile navigation">
              {navLinks.map((link, index) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    min-h-[56px] flex items-center px-4 rounded-xl font-bold text-lg tracking-tight
                    transition-all duration-200
                    ${isActive(link.path)
                      ? "bg-secondary text-secondary-foreground shadow-lg"
                      : "text-primary-foreground hover:bg-primary-foreground/10"
                    }
                  `}
                  style={{ 
                    animation: `slide-in-right 0.3s ease-out ${index * 0.05}s both` 
                  }}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            {/* Mobile Menu Footer with CTA and Theme Toggle */}
            <div className="px-6 pt-3 pb-6 border-t border-primary-foreground/20 space-y-4">
              <Button 
                variant="default" 
                size="lg"
                asChild
                className="w-full min-h-[52px] bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-base shadow-lg"
              >
                <Link to="/contact" onClick={() => setIsMobileMenuOpen(false)}>
                  Work With Us
                </Link>
              </Button>
              
              {/* Theme Toggle - Enhanced visibility and touch target */}
              <div className="flex justify-center pt-3">
                <div className="flex items-center gap-3 px-5 py-3 rounded-lg bg-primary-foreground/15">
                  <span className="text-base font-semibold text-primary-foreground">Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;
