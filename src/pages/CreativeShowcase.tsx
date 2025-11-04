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
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold">The Creative Advantage</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6">Creative That Converts</h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8">
              Every message, every ad, every email is crafted to inspire action. See the creative work behind our
              winning campaigns.
            </p>
            <Button variant="cta" size="xl" asChild>
              <Link to="/contact">Let's Create Together</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Creative Philosophy */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">
                Creative That Drives Results
              </h2>
              <p className="text-xl text-muted-foreground">
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
                  className="text-center animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="bg-secondary/10 text-secondary w-16 h-16 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <item.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Creative Gallery */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">Featured Creative Work</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Explore real campaigns, real creative, and real results. Filter by channel to see what works.
            </p>
          </div>

          <CreativeGallery />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6 animate-fade-in">
            Ready for Creative That Wins?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto animate-fade-in">
            Let's craft messaging that moves your audience and drives real results for your campaign.
          </p>
          <Button variant="cta" size="xl" asChild className="animate-pulse-subtle">
            <Link to="/contact">Start Your Campaign</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CreativeShowcase;
