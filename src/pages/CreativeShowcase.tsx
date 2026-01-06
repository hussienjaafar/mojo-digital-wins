import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { CreativeGallery } from "@/components/CreativeGallery";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedPatternHero from "@/components/AnimatedPatternHero";

const CreativeShowcase = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Political Campaign Creative & Video | Molitico</title>
        <meta name="description" content="High-impact political campaign creative that drives donations, sign-ups, and wins. See our portfolio of progressive campaign videos and ads." />
        <link rel="canonical" href="https://molitico.com/creative" />
        <meta property="og:title" content="Political Campaign Creative & Video | Molitico" />
        <meta property="og:description" content="High-impact political campaign creative that drives donations, sign-ups, and wins." />
        <meta property="og:url" content="https://molitico.com/creative" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Navigation />
      <AnimatedPatternHero
        title="Creative That Converts"
        description="Beautiful creative is great. Creative that drives donations, sign-ups, and wins is what we deliver."
      >
        <Link to="/contact">
          <Button size="lg" className="shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300">
            Let's Create Something Winning
          </Button>
        </Link>
      </AnimatedPatternHero>

      {/* Video Gallery */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Our Work
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Creative that moves people to act and drives real results.
              </p>
            </div>

            <CreativeGallery />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-accent via-destructive to-secondary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8 text-primary-foreground">
            <h2 className="font-bebas leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
              Ready for Creative That Wins?
            </h2>
            <p className="text-lg md:text-xl leading-relaxed">
              Let's build a campaign that stands out, raises more, and delivers results.
            </p>
            <Link to="/contact">
              <Button size="lg" className="text-lg px-8 shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Start Your Campaign
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CreativeShowcase;
