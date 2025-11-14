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
      width="180"
      height="80"
      className={`w-auto h-auto max-h-12 sm:max-h-16 md:max-h-20 max-w-[120px] sm:max-w-[150px] md:max-w-[180px] object-contain mx-auto ${
        isPrestonLogo
          ? "[filter:brightness(0)_saturate(100%)_invert(38%)_sepia(65%)_saturate(1167%)_hue-rotate(186deg)_brightness(95%)_contrast(94%)] dark:[filter:invert(1)]"
          : "dark:brightness-0 dark:invert"
      } ${className}`}
    />
  ) : (
    // Fallback to text-based logo if no image available
    <div className={`font-bebas text-center ${className}`}>
      <div className="text-xl sm:text-2xl md:text-3xl uppercase tracking-wide leading-tight text-foreground">
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
