import { Link } from "react-router-dom";
import abdulLogo from "@/assets/abdul-senate-logo.svg";
import unityJusticeLogo from "@/assets/unity-justice-fund-logo.webp";
import nasserMichiganLogo from "@/assets/nasser-michigan-logo.webp";
import prestonPaLogo from "@/assets/preston-pa-logo.png";
import rashidIllinoisLogo from "@/assets/rashid-illinois-logo.webp";
import cairActionLogo from "@/assets/cair-action-logo.png";
import mpacLogo from "@/assets/mpac-logo.webp";
import truthProjectLogo from "@/assets/truth-project-logo.png";
import aNewPolicyLogo from "@/assets/a-new-policy-logo.png";

interface ClientLogoProps {
  name: string;
  className?: string;
  linkable?: boolean;
}

const logoMap: Record<string, string> = {
  "Abdul for U.S. Senate": abdulLogo,
  "Unity & Justice Fund": unityJusticeLogo,
  "Nasser for Michigan": nasserMichiganLogo,
  "Preston For PA": prestonPaLogo,
  "Rashid for Illinois": rashidIllinoisLogo,
  "CAIR Action": cairActionLogo,
  "MPAC": mpacLogo,
  "The Truth Project": truthProjectLogo,
  "A New Policy": aNewPolicyLogo,
};

// Map client names to case study IDs
const clientToCaseStudy: Record<string, string> = {
  "Abdul for U.S. Senate": "abdul-senate",
  "Unity & Justice Fund": "unity-justice-fund",
  "Nasser for Michigan": "nasser-michigan",
  "Preston For PA": "preston-pa",
  "Rashid for Illinois": "rashid-illinois",
  "Arab-American Non-profit": "arab-american-nonprofit",
  "A New Policy": "new-policy",
};

export const ClientLogo = ({ name, className = "", linkable = true }: ClientLogoProps) => {
  const logoSrc = logoMap[name];
  const caseStudyId = clientToCaseStudy[name];
  const isPrestonLogo = name === "Preston For PA";

  const logoImage = logoSrc ? (
    <img 
      src={logoSrc} 
      alt={`${name} logo`}
      className={`w-full h-auto max-h-24 object-contain ${className}`}
      style={isPrestonLogo ? { 
        filter: 'brightness(0) saturate(100%) invert(38%) sepia(65%) saturate(1167%) hue-rotate(186deg) brightness(95%) contrast(94%)'
      } : undefined}
    />
  ) : (
    // Fallback to text-based logo if no image available
    <div className={`font-bebas text-center ${className}`}>
      <div className="text-2xl md:text-3xl uppercase tracking-wide leading-tight">
        {name}
      </div>
    </div>
  );

  // If linkable and has a case study, wrap in Link
  if (linkable && caseStudyId) {
    return (
      <Link 
        to={`/case-studies/${caseStudyId}`}
        className="block w-full h-full group-hover:scale-105 transition-transform duration-300"
      >
        {logoImage}
      </Link>
    );
  }

  return logoImage;
};
