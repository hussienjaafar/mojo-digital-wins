const LandingFooter = () => {
  return (
    <footer className="py-8 px-4 border-t border-[#1e2a45]/50 bg-[#0a0f1a]">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[#64748b] text-xs">
        <span>© {new Date().getFullYear()} Molitico. All rights reserved.</span>
        <div className="flex gap-6">
          <a href="/privacy-policy" className="hover:text-[#94a3b8] transition-colors">Privacy Policy</a>
          <a href="/contact" className="hover:text-[#94a3b8] transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
