import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const BackToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      {isVisible && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 h-11 w-11 md:h-12 md:w-12 rounded-full shadow-lg hover:shadow-xl animate-fade-in hover:scale-110 transition-all duration-300"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      )}
    </>
  );
};

export default BackToTop;
