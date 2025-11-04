import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

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
    { name: "Creative", path: "/creative-showcase" },
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
        !isScrolled ? "backdrop-blur-md bg-primary/10 rounded-b-xl mt-0" : ""
      }`}>
        <div className="flex items-center justify-between h-[72px] md:h-[80px]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className={`transition-colors ${
              isScrolled ? "text-primary-foreground" : "text-primary-foreground drop-shadow-[0_2px_8px_rgba(10,30,62,0.8)]"
            }`}>
              <div className="font-bebas text-[1.75rem] md:text-[2rem] leading-none tracking-wide">
                MOJO<span className="text-secondary"> DIGITAL</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-[16px] md:text-[17px] font-bold tracking-tight transition-colors relative group ${
                  isActive(link.path)
                    ? isScrolled ? "text-primary-foreground" : "text-primary-foreground drop-shadow-[0_2px_4px_rgba(10,30,62,0.6)]"
                    : isScrolled ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-primary-foreground/90 hover:text-primary-foreground drop-shadow-[0_2px_4px_rgba(10,30,62,0.6)]"
                }`}
              >
                {link.name}
                <span className={`absolute bottom-0 left-0 w-full h-[2px] bg-secondary transition-transform duration-200 ${
                  isActive(link.path) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`} />
              </Link>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:block">
            <Button 
              variant="default" 
              size="default" 
              asChild
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-medium rounded-lg px-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
            >
              <Link to="/contact">Work With Us</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
              isScrolled ? "text-primary-foreground" : "text-foreground"
            }`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden py-4 space-y-2 animate-fade-in-down border-t ${
            isScrolled ? "border-primary-foreground/10" : "border-foreground/10"
          }`}>
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-3 px-4 rounded-lg font-semibold text-[15px] transition-colors ${
                  isActive(link.path)
                    ? isScrolled 
                      ? "text-primary-foreground bg-secondary/20" 
                      : "text-foreground bg-secondary/20"
                    : isScrolled
                      ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/5"
                      : "text-foreground/80 hover:text-foreground hover:bg-foreground/5"
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
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
