import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Megaphone, 
  MessageSquare, 
  Mail, 
  BarChart3, 
  Palette, 
  Target,
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/data-dashboard.jpg";

const Services = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-28 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="absolute inset-0 bg-primary/75" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-[680px] space-y-6">
            <h1 className="font-bebas text-primary-foreground leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', letterSpacing: '0.02em' }}>
              Services That Win Elections
            </h1>
            <p className="text-primary-foreground/90 leading-relaxed" style={{ fontSize: 'clamp(1.125rem, 2vw, 1.25rem)' }}>
              From digital ads to SMS outreach, we offer the full stack of campaign services—all optimized for one thing: winning.
            </p>
          </div>
        </div>
      </section>

      {/* Core Services */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-20">
            {/* Service 1 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 order-2 md:order-1 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-8 space-y-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center shadow-md">
                    <Megaphone className="h-8 w-8 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
                    Digital Advertising
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Precision-targeted Facebook, Instagram, and Google ads that reach the right voters at the right time. We handle everything from creative development to audience targeting to continuous optimization.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Voter file integration & custom audiences",
                      "A/B testing every element for maximum performance",
                      "Daily optimization based on real-time data",
                      "Transparent reporting on spend and results"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Zap className="h-5 w-5 text-accent mt-1 flex-shrink-0 drop-shadow-sm" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <div className="order-1 md:order-2">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 shadow-lg" />
              </div>
            </div>

            {/* Service 2 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="aspect-square rounded-xl bg-gradient-to-br from-destructive/20 to-secondary/20 shadow-lg" />
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-8 space-y-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-destructive to-secondary rounded-full flex items-center justify-center shadow-md">
                    <MessageSquare className="h-8 w-8 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
                    SMS & Peer-to-Peer Texting
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Text messaging is the most direct line to your supporters. We craft compelling SMS campaigns that drive donations, volunteer signups, and voter turnout.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Compliance-first approach to protect your campaign",
                      "Personalized messaging that feels authentic",
                      "Real-time response handling and list management",
                      "Integration with your CRM and voter file"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Zap className="h-5 w-5 text-accent mt-1 flex-shrink-0 drop-shadow-sm" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Service 3 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 order-2 md:order-1 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-8 space-y-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent to-secondary rounded-full flex items-center justify-center shadow-md">
                    <Mail className="h-8 w-8 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
                    Email Fundraising
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Email remains one of the highest-ROI channels for campaigns. We write, design, and optimize email programs that raise serious money.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "High-converting subject lines and copy",
                      "Multi-variate testing on every send",
                      "List segmentation for maximum relevance",
                      "Automated welcome series and recurring donor programs"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Zap className="h-5 w-5 text-accent mt-1 flex-shrink-0 drop-shadow-sm" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <div className="order-1 md:order-2">
                <div className="aspect-square rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 shadow-lg" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-bebas text-primary text-center mb-16 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
            Plus Everything Else You Need
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { icon: Palette, title: "Creative Production", description: "Eye-catching graphics, videos, and ad creative that stops the scroll and drives action." },
              { icon: BarChart3, title: "Analytics & Reporting", description: "Clear, actionable insights on what's working, what's not, and where to invest next." },
              { icon: Target, title: "Strategic Consulting", description: "Not sure where to start? We'll audit your program and build a winning strategy." }
            ].map((service, index) => (
              <Card key={index} className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-md">
                    <service.icon className="h-8 w-8 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{service.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                How We Work
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                A proven process that delivers results, fast
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "01", title: "Discovery & Strategy", description: "We learn your campaign inside and out, then build a data-driven plan to win." },
                { step: "02", title: "Launch & Test", description: "Quick deployment of campaigns with rigorous A/B testing from day one." },
                { step: "03", title: "Optimize & Scale", description: "Continuous improvement based on real-time data. We double down on what works." }
              ].map((process, index) => (
                <div key={index} className="space-y-4">
                  <div className="text-6xl font-bold text-accent/20">{process.step}</div>
                  <h3 className="text-2xl font-bold text-foreground">{process.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{process.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-secondary via-primary to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8 text-white">
            <h2 className="font-bebas leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
              Ready to Build Your Winning Campaign?
            </h2>
            <p className="text-lg md:text-xl leading-relaxed">
              Let's talk about your goals and how we can help you achieve them.
            </p>
            <Link to="/contact">
              <Button size="lg" variant="secondary" className="text-lg px-8 shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300">
                Get Started Today
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Services;
