import { Card, CardContent } from "@/components/ui/card";
import { ParticleButton } from "@/components/ParticleButton";
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
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedPatternHero from "@/components/AnimatedPatternHero";
import AnimatedServiceGraphic from "@/components/AnimatedServiceGraphic";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";

const Services = () => {
  const service1 = useScrollAnimation({ threshold: 0.2 });
  const service2 = useScrollAnimation({ threshold: 0.2 });
  const service3 = useScrollAnimation({ threshold: 0.2 });
  const graphic1 = useScrollAnimation({ threshold: 0.2 });
  const graphic2 = useScrollAnimation({ threshold: 0.2 });
  const graphic3 = useScrollAnimation({ threshold: 0.2 });
  const additionalServices = useScrollAnimation({ threshold: 0.2 });
  const processSection = useScrollAnimation({ threshold: 0.2 });

  return (
    <div className="min-h-screen">
      <ScrollProgressIndicator />
      <Navigation />
      <AnimatedPatternHero
        title="Services That Drive Progressive Wins"
        description="From digital ads to SMS outreach, we offer the full stack of services for campaigns, PACs, and nonprofits—all optimized for achieving your goals."
      />

      {/* Core Services */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-20">
            {/* Service 1 */}
            <div 
              ref={service1.ref}
              className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
                service1.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 order-2 md:order-1 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-6 sm:p-7 md:p-8 space-y-6">
                  <div className="w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center shadow-md">
                    <Megaphone className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
                    Digital Advertising
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Precision-targeted Facebook, Instagram, and Google ads that reach the right people at the right time. We handle everything from creative development to audience targeting to continuous optimization.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Target audience integration & voter file matching",
                      "A/B testing every element for maximum performance",
                      "Daily optimization based on real-time data",
                      "Transparent reporting on spend and results"
                    ].map((item, index) => (
                      <li 
                        key={index} 
                        className={`flex items-start gap-3 transition-all duration-700 ${
                          service1.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                        }`}
                        style={{ transitionDelay: `${400 + index * 100}ms` }}
                      >
                        <Zap className="h-5 w-5 text-accent mt-1 flex-shrink-0 drop-shadow-sm" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <div 
                ref={graphic1.ref}
                className={`order-1 md:order-2 transition-all duration-1000 delay-300 ${
                  graphic1.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <AnimatedServiceGraphic variant="megaphone" />
              </div>
            </div>

            {/* Service 2 */}
            <div 
              ref={service2.ref}
              className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
                service2.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <div 
                ref={graphic2.ref}
                className={`transition-all duration-1000 delay-300 ${
                  graphic2.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <AnimatedServiceGraphic variant="messageBubbles" />
              </div>
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-6 sm:p-7 md:p-8 space-y-6">
                  <div className="w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 bg-gradient-to-br from-destructive to-secondary rounded-full flex items-center justify-center shadow-md">
                    <MessageSquare className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
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
                      <li 
                        key={index} 
                        className={`flex items-start gap-3 transition-all duration-700 ${
                          service2.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                        }`}
                        style={{ transitionDelay: `${400 + index * 100}ms` }}
                      >
                        <Zap className="h-5 w-5 text-accent mt-1 flex-shrink-0 drop-shadow-sm" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Service 3 */}
            <div 
              ref={service3.ref}
              className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
                service3.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 order-2 md:order-1 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-6 sm:p-7 md:p-8 space-y-6">
                  <div className="w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 bg-gradient-to-br from-accent to-secondary rounded-full flex items-center justify-center shadow-md">
                    <Mail className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-white drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
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
                      <li 
                        key={index} 
                        className={`flex items-start gap-3 transition-all duration-700 ${
                          service3.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                        }`}
                        style={{ transitionDelay: `${400 + index * 100}ms` }}
                      >
                        <Zap className="h-5 w-5 text-accent mt-1 flex-shrink-0 drop-shadow-sm" />
                        <span className="text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <div 
                ref={graphic3.ref}
                className={`order-1 md:order-2 transition-all duration-1000 delay-300 ${
                  graphic3.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <AnimatedServiceGraphic variant="envelope" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-bebas text-primary text-center mb-16 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
            Plus Everything Else You Need
          </h2>
          
          <div 
            ref={additionalServices.ref}
            className={`grid md:grid-cols-3 gap-8 max-w-6xl mx-auto transition-all duration-1000 ${
              additionalServices.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            {[
              { icon: Palette, title: "Creative Production", description: "Eye-catching graphics, videos, and ad creative that stops the scroll and drives action." },
              { icon: BarChart3, title: "Analytics & Reporting", description: "Clear, actionable insights on what's working, what's not, and where to invest next." },
              { icon: Target, title: "Strategic Consulting", description: "Not sure where to start? We'll audit your program and build a winning strategy." }
            ].map((service, index) => (
              <Card 
                key={index} 
                className={`shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-700 border border-border/50 bg-card backdrop-blur-sm ${
                  additionalServices.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-6 sm:p-7 md:p-8 text-center space-y-4">
                  <div className="w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center shadow-md">
                    <service.icon className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-white drop-shadow-sm" />
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
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-background">
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

            <div 
              ref={processSection.ref}
              className={`grid md:grid-cols-3 gap-8 transition-all duration-1000 ${
                processSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              {[
                { step: "01", title: "Discovery & Strategy", description: "We learn your organization inside and out, then build a data-driven plan to win." },
                { step: "02", title: "Launch & Test", description: "Quick deployment of campaigns with rigorous A/B testing from day one." },
                { step: "03", title: "Optimize & Scale", description: "Continuous improvement based on real-time data. We double down on what works." }
              ].map((process, index) => (
                <div 
                  key={index} 
                  className={`space-y-4 transition-all duration-700 ${
                    processSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${index * 200}ms` }}
                >
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
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-gradient-to-br from-secondary via-primary to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8 text-white">
            <h2 className="font-bebas leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
              Ready to Build Your Winning Strategy?
            </h2>
            <p className="text-lg md:text-xl leading-relaxed">
              Let's talk about your goals and how we can help you achieve them.
            </p>
            <ParticleButton
              href="https://calendly.com/molitico/30min"
              size="xl"
              particleColor="hsl(var(--accent))"
              particleCount={25}
              className="text-lg font-bold bg-white text-primary hover:bg-white/90"
            >
              Book Your Free Strategy Call
            </ParticleButton>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Services;
