import { motion } from "framer-motion";

const logos = [
  "National Campaigns", "State PACs", "Issue Advocacy", "CPG Brands",
  "Retail Groups", "Healthcare Orgs", "Nonprofits", "Media Agencies",
];

const LogoBar = () => {
  return (
    <section className="py-12 border-y border-[#1e2a45]/50 bg-[#0a0f1a]/80">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-[#64748b] mb-8 font-medium">
        Trusted by organizations across commercial & political
      </p>
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-12 items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {[...logos, ...logos].map((name, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-6 py-3 rounded-lg border border-[#1e2a45] bg-[#141b2d]/50 text-[#64748b] text-sm font-medium whitespace-nowrap"
            >
              {name}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default LogoBar;
