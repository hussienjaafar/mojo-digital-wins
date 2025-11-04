import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { CreativeGallery } from "@/components/CreativeGallery";
import heroImage from "@/assets/hero-movement.jpg";

const CreativeShowcase = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-28 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="absolute inset-0 bg-primary/75" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-[680px] space-y-6">
            <h1 className="font-bebas text-primary-foreground leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', letterSpacing: '0.02em' }}>
              Creative That Converts
            </h1>
            <p className="text-primary-foreground/90 leading-relaxed" style={{ fontSize: 'clamp(1.125rem, 2vw, 1.25rem)' }}>
              Beautiful creative is great. Creative that drives donations, sign-ups, and wins is what we deliver.
            </p>
            <Link to="/contact">
              <Button size="lg" className="shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300">
                Let's Create Something Winning
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Our Creative Philosophy
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Every ad, email, and piece of content is built with one goal: results.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Target, title: "Message-Market Fit", description: "We don't guess. We test messaging with your audience until we find what resonates and drives action." },
                { icon: TrendingUp, title: "Continuous Testing", description: "Every creative piece is A/B tested. We optimize relentlessly to improve performance week over week." },
                { icon: Zap, title: "Urgency & Emotion", description: "Great political creative taps into urgency and emotion. We create work that moves people to act—now." }
              ].map((principle, index) => (
                <Card key={index} className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center shadow-md">
                      <principle.icon className="h-8 w-8 text-white drop-shadow-sm" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">{principle.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{principle.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Creative Gallery */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Featured Creative Work
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                From digital ads to email headers to SMS creative—here's a look at work that helped campaigns break through and win.
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
          <div className="max-w-3xl mx-auto text-center space-y-8 text-white">
            <h2 className="font-bebas leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
              Ready for Creative That Wins?
            </h2>
            <p className="text-lg md:text-xl leading-relaxed">
              Let's build a campaign that stands out, raises more, and delivers results.
            </p>
            <Link to="/contact">
              <Button size="lg" variant="secondary" className="text-lg px-8 shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300">
                Start Your Campaign
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CreativeShowcase;
