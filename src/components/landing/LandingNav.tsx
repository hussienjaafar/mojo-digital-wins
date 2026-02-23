import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface LandingNavProps {
  onCTA: () => void;
}

const LandingNav = ({ onCTA }: LandingNavProps) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-[#1e2a45]/50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <a href="/" className="text-[#e2e8f0] font-bold text-xl tracking-tight">
          Mojo
        </a>
        <Button
          size="sm"
          onClick={onCTA}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm group"
        >
          Get Free Report
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </nav>
  );
};

export default LandingNav;
