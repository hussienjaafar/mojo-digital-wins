import { motion } from "framer-motion";
import abdulLogo from "@/assets/abdul-senate-logo.svg";
import unityJusticeLogo from "@/assets/unity-justice-fund-logo.webp";
import nasserMichiganLogo from "@/assets/nasser-michigan-logo.webp";
import prestonPaLogo from "@/assets/preston-pa-logo.png";
import rashidIllinoisLogo from "@/assets/rashid-illinois-logo.webp";
import cairActionLogo from "@/assets/cair-action-logo.png";
import mpacLogo from "@/assets/mpac-logo.webp";
import truthProjectLogo from "@/assets/truth-project-logo.png";
import aNewPolicyLogo from "@/assets/a-new-policy-logo.png";

const logos = [
  { name: "Abdul for U.S. Senate", src: abdulLogo },
  { name: "Unity & Justice Fund", src: unityJusticeLogo },
  { name: "Nasser for Michigan", src: nasserMichiganLogo },
  { name: "Preston For PA", src: prestonPaLogo },
  { name: "Rashid for Illinois", src: rashidIllinoisLogo },
  { name: "CAIR Action", src: cairActionLogo },
  { name: "MPAC", src: mpacLogo },
  { name: "The Truth Project", src: truthProjectLogo },
  { name: "A New Policy", src: aNewPolicyLogo },
];

const LogoBar = () => {
  return (
    <section className="py-12 border-y border-[#1e2a45]/50 bg-[#0a0f1a]/80">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-[#64748b] mb-8 font-medium">
        Trusted by organizations across commercial & political
      </p>
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-16 items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {[...logos, ...logos].map((logo, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-4 flex items-center justify-center h-12"
            >
              <img
                src={logo.src}
                alt={`${logo.name} logo`}
                className="h-10 w-auto max-w-[140px] object-contain brightness-0 invert opacity-70"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default LogoBar;
