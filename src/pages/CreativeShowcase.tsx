import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CreativeGallery } from "@/components/CreativeGallery";
import { Link } from "react-router-dom";
import { Sparkles, Target, TrendingUp, Zap } from "lucide-react";

const CreativeShowcase = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="pt-32 pb-24 bg-gradient-to-br from-primary via-secondary to-destructive text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 texture-overlay" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-6 py-3 rounded-full mb-8 border-2 border-accent/40">
              <Sparkles className="w-6 h-6" />
              <span className="font-bold uppercase tracking-wider">The Creative Advantage</span>
            </div>
            <h1 className="font-bebas text-7xl md:text-9xl mb-8 leading-none uppercase tracking-wider">
              Creative That<br/>Converts
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/95 mb-10 font-medium max-w-3xl mx-auto">
              Every message, every ad, every email is crafted to inspire action. See the creative work behind our
              winning campaigns.
            </p>
            <Button variant="brutal" size="xl" asChild className="text-lg">
              <Link to="/contact">Let's Create Together</Link>
            </Button>
          </div>
        </div>
        
        {/* Diagonal bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-background" style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 0, 0 100%)' }} />
      </section>

      {/* Creative Philosophy */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16 animate-fade-in">
              <h2 className="font-bebas text-6xl md:text-7xl text-foreground mb-6 uppercase tracking-wide">
                Creative That<br/>Drives Results
              </h2>
              <p className="text-xl text-muted-foreground font-medium">
                Our creative isn't just beautiful—it's optimized for performance. Every element is tested,
                refined, and designed to maximize ROI.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Target,
                  title: "Message-Market Fit",
                  description:
                    "We craft messages that resonate with your specific audience, speaking their language and addressing their values.",
                },
                {
                  icon: TrendingUp,
                  title: "Continuous Testing",
                  description:
                    "Every creative is A/B tested across subject lines, copy, visuals, and CTAs to identify top performers.",
                },
                {
                  icon: Zap,
                  title: "Urgency & Emotion",
                  description:
                    "We balance emotional storytelling with clear calls-to-action that inspire immediate donor response.",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="text-center animate-bounce-in bg-gradient-to-br from-card to-muted border-2 border-secondary/20 p-8 rounded-lg brutal-shadow hover-lift"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <div className="bg-secondary/20 text-secondary w-20 h-20 rounded-lg flex items-center justify-center mb-6 mx-auto border-2 border-secondary/40">
                    <item.icon className="w-10 h-10" />
                  </div>
                  <h3 className="font-bebas text-2xl text-foreground mb-4 uppercase tracking-wide">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Creative Gallery */}
      <section className="py-24 bg-gradient-to-br from-muted via-background to-muted diagonal-both relative">
        <div className="absolute inset-0 texture-overlay" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="font-bebas text-6xl md:text-7xl text-foreground mb-6 uppercase tracking-wide">
              Featured Creative Work
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium">
              Explore real campaigns, real creative, and real results. Filter by channel to see what works.
            </p>
          </div>

          <CreativeGallery />
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 bg-gradient-to-br from-primary via-destructive to-secondary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 texture-overlay" />
        <div className="absolute inset-0 energy-glow" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="font-bebas text-6xl md:text-8xl mb-8 animate-fade-in uppercase tracking-wide leading-none">
            Ready for Creative<br/>That Wins?
          </h2>
          <p className="text-xl md:text-2xl text-primary-foreground/95 mb-12 max-w-2xl mx-auto animate-fade-in font-medium">
            Let's craft messaging that moves your audience and drives real results for your campaign.
          </p>
          <Button variant="brutal" size="xl" asChild className="animate-glow-pulse text-lg">
            <Link to="/contact">Start Your Campaign</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CreativeShowcase;
