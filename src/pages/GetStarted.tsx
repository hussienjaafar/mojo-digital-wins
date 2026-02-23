import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet";
import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import LogoBar from "@/components/landing/LogoBar";
import StatsSection from "@/components/landing/StatsSection";
import HowItWorks from "@/components/landing/HowItWorks";
import SegmentPreview from "@/components/landing/SegmentPreview";
import ChannelShowcase from "@/components/landing/ChannelShowcase";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

const GetStarted = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleCTA = () => {
    // Preserve UTM parameters when navigating to the funnel
    const searchParams = new URLSearchParams(location.search);
    const queryString = searchParams.toString();
    navigate(`/experience${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <>
      <Helmet>
        <title>Get Started - Audience Intelligence for Every Channel | Mojo</title>
        <meta
          name="description"
          content="Get a free audience opportunity report for CTV, digital, direct mail, OOH, and SMS. Data-driven targeting for commercial and political organizations."
        />
      </Helmet>

      <div className="min-h-screen bg-[#0a0f1a]">
        <LandingNav onCTA={handleCTA} />
        <main>
          <HeroSection onCTA={handleCTA} />
          <LogoBar />
          <StatsSection />
          <HowItWorks />
          <SegmentPreview />
          <ChannelShowcase />
          <TestimonialsSection />
          <FinalCTA onCTA={handleCTA} />
        </main>
        <LandingFooter />
      </div>
    </>
  );
};

export default GetStarted;
