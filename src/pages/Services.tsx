import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompoundingImpactModel } from "@/components/CompoundingImpactModel";
import { EthicsBadge } from "@/components/EthicsBadge";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Target,
  Mail,
  Users,
  BarChart3,
  Zap,
  TrendingUp,
  Share2,
  TestTube,
  Database,
  Shield,
  Heart,
  CheckCircle2,
} from "lucide-react";
import smsImage from "@/assets/sms-mockup.jpg";
import dataImage from "@/assets/data-dashboard.jpg";
import { cn } from "@/lib/utils";

const Services = () => {
  const mainServices = [
    {
      icon: MessageSquare,
      tag: "CORE SERVICE",
      title: "SMS Fundraising",
      description:
        "Text messaging is the most direct path to supporter action. Our SMS strategy converts grassroots passion into instant donations through authentic, urgent messaging.",
      features: [
        "High-converting fundraising messages tested across dozens of campaigns",
        "Peer-to-peer SMS campaigns for maximum authenticity",
        "Real-time A/B testing on messaging, timing, and audiences",
        "FEC-compliant opt-in management and compliance protocols",
        "Automated donor follow-up sequences that nurture relationships",
      ],
      results: [
        { stat: "5-7%", label: "Conversion Rate" },
        { stat: "3-5x", label: "ROI in 48hrs" },
      ],
      image: smsImage,
    },
    {
      icon: Target,
      tag: "CORE SERVICE",
      title: "Digital Advertising",
      description:
        "Every dollar is tracked. Every creative is tested. Every campaign is optimized for maximum ROI across Meta, Google, and programmatic networks.",
      features: [
        "Meta (Facebook/Instagram) ads optimized for persuasion",
        "Google Search and Display campaigns targeting high-intent voters",
        "Programmatic display and video for scalable reach",
        "Advanced audience targeting using lookalikes and custom segments",
        "Continuous creative testing and iteration based on performance",
      ],
      results: [
        { stat: "250-400%", label: "Average ROI" },
        { stat: "Below Benchmark", label: "Cost Per Acquisition" },
      ],
      image: dataImage,
    },
    {
      icon: Mail,
      tag: "CORE SERVICE",
      title: "Email Fundraising",
      description:
        "Email remains one of the highest-ROI channels when done right. We craft compelling narratives, optimize send times, and build automated sequences that convert.",
      features: [
        "List growth strategies that expand your donor base",
        "Storytelling-driven copy that connects emotionally",
        "A/B testing on subject lines, messaging, and CTAs",
        "Automated drip campaigns that nurture new supporters",
        "Re-engagement sequences that win back lapsed donors",
      ],
      results: [
        { stat: "300-500%", label: "Average ROI" },
        { stat: "Month-over-Month", label: "Consistent Growth" },
      ],
      image: smsImage,
    },
  ];

  const supportingServices = [
    {
      icon: Users,
      title: "Audience Targeting",
      description: "Precision targeting to reach persuadable voters and ideal donors.",
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Real-time dashboards and actionable insights to optimize campaigns.",
    },
    {
      icon: TestTube,
      title: "Creative Testing",
      description: "Continuous A/B testing on messaging, design, and calls-to-action.",
    },
    {
      icon: Database,
      title: "Data Management",
      description: "Clean, organized donor data integrated with your CRM and tools.",
    },
    {
      icon: TrendingUp,
      title: "Growth Strategy",
      description: "Long-term funnel optimization to expand your donor base sustainably.",
    },
    {
      icon: Share2,
      title: "Multi-Channel Coordination",
      description: "Seamless integration across SMS, email, ads, and social media.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[50vh] md:min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent overflow-hidden diagonal-bottom">
        <div className="texture-overlay"></div>
        
        <div className="container relative z-10 mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-display text-white mb-4 md:mb-6 leading-tight animate-fade-in">
            Performance That Moves{" "}
            <span className="text-accent energy-glow">Progressive Campaigns</span>
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 mb-6 md:mb-8 max-w-3xl mx-auto font-light animate-fade-in px-4">
            Data-driven digital strategies that turn grassroots energy into measurable wins
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
            <Link to="/contact">
              <Button size="lg" variant="brutal">
                Start Your Campaign
              </Button>
            </Link>
            <Link to="/case-studies">
              <Button size="lg" variant="movement">
                See Our Impact
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Services */}
      {mainServices.map((service, index) => (
        <section
          key={service.title}
          className={cn(
            "py-12 md:py-20 relative",
            index % 2 === 0 ? "bg-background diagonal-top" : "bg-muted/30 diagonal-both"
          )}
        >
          <div className="container mx-auto px-4 sm:px-6">
            <div
              className={cn(
                "grid md:grid-cols-2 gap-12 items-center",
                index % 2 === 1 && "md:grid-flow-dense"
              )}
            >
              {/* Text Content */}
              <div className={cn(index % 2 === 1 && "md:col-start-2")}>
                <div className="flex items-center gap-3 mb-4 animate-fade-in">
                  <div className="bg-primary/10 text-primary p-3 rounded-lg energy-glow">
                    <service.icon className="w-8 h-8" />
                  </div>
                  <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                    {service.tag}
                  </span>
                </div>
                
                <h2 className="text-headline text-foreground mb-4 animate-fade-in">
                  {service.title}
                </h2>
                
                <p className="text-xl text-muted-foreground mb-8 leading-relaxed animate-fade-in">
                  {service.description}
                </p>

                {/* Features */}
                <div className="space-y-4 mb-8 animate-fade-in">
                  {service.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <p className="text-muted-foreground">{feature}</p>
                    </div>
                  ))}
                </div>

                {/* Results */}
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-6 brutal-shadow energy-glow animate-fade-in">
                  <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-3">
                    Typical Results
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {service.results.map((result, idx) => (
                      <div key={idx}>
                        <div className="text-2xl font-bold text-foreground">{result.stat}</div>
                        <div className="text-sm text-muted-foreground">{result.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Image */}
              <div className={cn("relative animate-fade-in", index % 2 === 1 && "md:col-start-1 md:row-start-1")}>
                <img
                  src={service.image}
                  alt={service.title}
                  className="rounded-lg brutal-shadow w-full hover-lift"
                />
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* The Compounding Impact Model */}
      <CompoundingImpactModel />

      {/* Supporting Services */}
      <section className="py-12 md:py-20 bg-background diagonal-top relative">
        <div className="texture-overlay"></div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
            <h2 className="text-headline text-foreground mb-4">
              Everything You Need to Win
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive digital services that work together seamlessly
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {supportingServices.map((service, index) => (
              <Card key={index} className="hover-lift brutal-shadow hover:energy-glow transition-all duration-300" style={{ animationDelay: `${index * 100}ms` }}>
                <CardHeader>
                  <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit mb-4 energy-glow">
                    <service.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl font-bold">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Ethical Promise */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-accent/10 via-background to-primary/5 diagonal-both relative">
        <div className="texture-overlay"></div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
            <h2 className="text-display text-foreground mb-4">
              Our Ethical Promise
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Performance without compromise. Values first, always.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in">
              <CardHeader>
                <Shield className="w-12 h-12 text-accent mb-4 energy-glow" />
                <CardTitle className="text-xl font-bold">Transparent Practices</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Full visibility into where dollars go, how lists are built, and what tactics drive results. No black boxes.
                </p>
              </CardContent>
            </Card>

            <Card className="brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in" style={{ animationDelay: "100ms" }}>
              <CardHeader>
                <Heart className="w-12 h-12 text-accent mb-4 energy-glow" />
                <CardTitle className="text-xl font-bold">Donor Respect</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We treat every supporter like they're funding their own future—because they are. No manipulation, just authentic appeals.
                </p>
              </CardContent>
            </Card>

            <Card className="brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in" style={{ animationDelay: "200ms" }}>
              <CardHeader>
                <CheckCircle2 className="w-12 h-12 text-accent mb-4 energy-glow" />
                <CardTitle className="text-xl font-bold">FEC Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Every campaign follows the rules. We build compliance into our process, not as an afterthought.
                </p>
              </CardContent>
            </Card>

            <Card className="brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in" style={{ animationDelay: "300ms" }}>
              <CardHeader>
                <Target className="w-12 h-12 text-accent mb-4 energy-glow" />
                <CardTitle className="text-xl font-bold">Real Impact Focus</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We measure success by wins achieved, not just dollars raised. Performance tied to progressive outcomes.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: "400ms" }}>
            <EthicsBadge variant="detailed" />
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-12 md:py-20 bg-background diagonal-top relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
            <h2 className="text-headline text-foreground mb-4">
              How We Work With You
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A proven process from strategy to scale
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { number: "01", title: "Discovery", desc: "Deep dive into your campaign goals, audience, and constraints" },
              { number: "02", title: "Strategy", desc: "Custom roadmap with channel mix, creative direction, and KPIs" },
              { number: "03", title: "Launch", desc: "Rapid deployment with real-time optimization from day one" },
              { number: "04", title: "Scale", desc: "Continuous improvement and expansion of what's working" },
            ].map((step, index) => (
              <div key={index} className="text-center animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="text-6xl font-black text-primary/20 mb-4 hover:text-primary/40 transition-colors duration-300 brutal-shadow">{step.number}</div>
                <h3 className="text-2xl font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-primary via-secondary to-accent text-white diagonal-both relative overflow-hidden">
        <div className="texture-overlay"></div>
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <h2 className="text-display mb-4 md:mb-6 animate-fade-in energy-glow px-4">
            Ready to Transform Your Campaign?
          </h2>
          <p className="text-lg md:text-xl mb-6 md:mb-8 max-w-2xl mx-auto opacity-90 animate-fade-in px-4">
            Let's build a winning digital strategy together
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
            <Link to="/contact">
              <Button size="lg" variant="brutal">
                Get Started
              </Button>
            </Link>
            <Link to="/case-studies">
              <Button size="lg" variant="movement">
                View Case Studies
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Services;
