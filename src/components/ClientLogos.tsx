import abdulLogo from "@/assets/abdul-senate.png";
import unityJusticeLogo from "@/assets/unity-justice-fund-logo.webp";
import nasserMichiganLogo from "@/assets/nasser-michigan-logo.webp";
import prestonPaLogo from "@/assets/preston-pa-logo.png";
import rashidIllinoisLogo from "@/assets/rashid-illinois-logo.webp";
import arabAmericanLogo from "@/assets/arab-american-nonprofit-logo.webp";
import aNewPolicyLogo from "@/assets/a-new-policy-logo.png";

interface ClientLogoProps {
  name: string;
  className?: string;
}

const logoMap: Record<string, string> = {
  "Abdul for U.S. Senate": abdulLogo,
  "Unity & Justice Fund": unityJusticeLogo,
  "Nasser for Michigan": nasserMichiganLogo,
  "Preston For PA": prestonPaLogo,
  "Rashid for Illinois": rashidIllinoisLogo,
  "Arab-American Non-profit": arabAmericanLogo,
  "A New Policy": aNewPolicyLogo,
};

export const ClientLogo = ({ name, className = "" }: ClientLogoProps) => {
  const logoSrc = logoMap[name];
  const isPrestonLogo = name === "Preston For PA";

  if (logoSrc) {
    return (
      <img 
        src={logoSrc} 
        alt={`${name} logo`}
        className={`w-full h-auto max-h-24 object-contain ${className}`}
        style={isPrestonLogo ? { 
          filter: 'brightness(0) saturate(100%) invert(27%) sepia(91%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)'
        } : undefined}
      />
    );
  }

  // Fallback to text-based logo if no image available
  return (
    <div className={`font-bebas text-center ${className}`}>
      <div className="text-2xl md:text-3xl uppercase tracking-wide leading-tight">
        {name}
      </div>
    </div>
  );
};
