import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyMobileCTAProps {
  onCTA: () => void;
}

const StickyMobileCTA = ({ onCTA }: StickyMobileCTAProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#0a0f1a]/95 backdrop-blur-xl border-t border-[#1e2a45]/50 md:hidden">
      <Button
        onClick={onCTA}
        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25 text-sm py-3 h-auto rounded-lg group"
      >
        Get My Free Report
        <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </div>
  );
};

export default StickyMobileCTA;
