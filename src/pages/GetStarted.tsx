import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import LogoBar from "@/components/landing/LogoBar";
import ProblemSection from "@/components/landing/ProblemSection";
import StatsSection from "@/components/landing/StatsSection";
import HowItWorks from "@/components/landing/HowItWorks";
import ReportPreview from "@/components/landing/ReportPreview";
import SegmentPreview from "@/components/landing/SegmentPreview";
import ChannelShowcase from "@/components/landing/ChannelShowcase";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";

const GetStarted = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleCTA = () => {
    const searchParams = new URLSearchParams(location.search);
    const queryString = searchParams.toString();
    navigate(`/experience${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <>
      <Helmet>
        <title>Stop Wasting Ad Spend | Free Audience Report | Molitico</title>
        <meta
          name="description"
          content="Get a free audience opportunity report showing exactly who to target across CTV, digital, direct mail, OOH, and SMS. Trusted by 50+ campaigns."
        />
      </Helmet>

      <div className="min-h-screen bg-[#0a0f1a]">
        <LandingNav onCTA={handleCTA} />
        <main>
          <HeroSection onCTA={handleCTA} />
          <LogoBar />
          <ProblemSection />
          <StatsSection />
          <HowItWorks onCTA={handleCTA} />
          <ReportPreview />
          <SegmentPreview />
          <ChannelShowcase onCTA={handleCTA} />
          <TestimonialsSection />
          <FinalCTA onCTA={handleCTA} />
        </main>
        <LandingFooter />
        <StickyMobileCTA onCTA={handleCTA} />
      </div>
    </>
  );
};

export default GetStarted;
