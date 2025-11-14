import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

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
                    : isScrolled ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary-foreground hover:text-primary-foreground drop-shadow-[0_2px_8px_rgba(10,30,62,0.9)]"
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
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
              isScrolled ? "text-primary-foreground" : "text-primary-foreground"
            }`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav 
            className={`md:hidden py-4 space-y-2 animate-fade-in-down border-t ${
              isScrolled ? "border-primary-foreground/10" : "border-foreground/10"
            }`}
            aria-label="Mobile navigation"
          >
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-3.5 px-4 rounded-lg font-semibold text-[15px] transition-colors min-h-[48px] flex items-center ${
                  isActive(link.path)
                    ? isScrolled 
                      ? "text-primary-foreground bg-secondary/20" 
                      : "text-primary-foreground bg-secondary/20"
                    : isScrolled
                      ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/5"
                      : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/5"
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="pt-2">
              <Button 
                variant="default" 
                size="default" 
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-medium"
                asChild
              >
                <Link to="/contact" onClick={() => setIsMobileMenuOpen(false)}>
                  Work With Us
                </Link>
              </Button>
            </div>
          </nav>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
