import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompoundingImpactModel } from "@/components/CompoundingImpactModel";
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
  Lock,
} from "lucide-react";
import smsImage from "@/assets/sms-mockup.jpg";

const Services = () => {
  const mainServices = [
    {
      icon: MessageSquare,
      title: "SMS Fundraising",
      tagline: "Converting grassroots passion into instant action",
      description:
        "Text messaging is the most direct, immediate way to reach supporters. Our SMS strategy combines urgency, authenticity, and precision targeting to maximize donations and engagement.",
      features: [
        "High-converting fundraising messages",
        "Peer-to-peer SMS campaigns",
        "Real-time A/B testing",
        "Compliance and opt-in management",
        "Automated donor follow-up sequences",
      ],
      results: "Average 5-7% conversion rate, 3-5x ROI within 48 hours",
    },
    {
      icon: Target,
      title: "Digital Advertising",
      tagline: "Optimized for persuasion + acquisition",
      description:
        "We run high-performance digital ads across Meta, Google, and programmatic networks. Every dollar is tracked, every creative is tested, and every campaign is optimized for maximum ROI.",
      features: [
        "Meta (Facebook/Instagram) ads",
        "Google Search and Display campaigns",
        "Programmatic display and video",
        "Advanced audience targeting and lookalikes",
        "Creative testing and iteration",
      ],
      results: "Average 250-400% ROI, cost-per-acquisition below industry benchmarks",
    },
    {
      icon: Mail,
      title: "Email Fundraising",
      tagline: "Narrative-driven, high-ROI donor growth",
      description:
        "Email remains one of the highest-ROI channels for political fundraising. Our team crafts compelling stories, optimizes send times, and builds automated sequences that convert.",
      features: [
        "List growth and segmentation",
        "Compelling copy and storytelling",
        "A/B testing on subject lines and CTAs",
        "Automated drip campaigns",
        "Re-engagement and winback sequences",
      ],
      results: "Average 300-500% ROI, consistent month-over-month growth",
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
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-black mb-6">Our Services</h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8">
              Three core offerings designed to maximize your campaign's impact, ROI, and electoral power.
            </p>
            <Button variant="cta" size="xl" asChild>
              <Link to="/contact">Book a Strategy Call</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Main Services */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="space-y-20">
            {mainServices.map((service, index) => (
              <div
                key={index}
                className={`grid md:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`animate-fade-in ${index % 2 === 1 ? "md:order-2" : ""}`}
                  style={{ animationDelay: "0.2s" }}
                >
                  <div className="bg-secondary text-secondary-foreground inline-flex p-4 rounded-lg mb-6">
                    <service.icon className="w-10 h-10" />
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-foreground mb-4">{service.title}</h2>
                  <p className="text-xl text-secondary font-semibold mb-6">{service.tagline}</p>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{service.description}</p>

                  <div className="space-y-4 mb-8">
                    <h3 className="font-bold text-lg text-foreground">What We Deliver:</h3>
                    <ul className="space-y-2">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-start">
                          <Zap className="w-5 h-5 text-secondary mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-muted p-6 rounded-lg">
                    <h4 className="font-bold text-foreground mb-2">Typical Results:</h4>
                    <p className="text-muted-foreground">{service.results}</p>
                  </div>
                </div>

                <div
                  className={`animate-slide-in-right ${index % 2 === 1 ? "md:order-1" : ""}`}
                  style={{ animationDelay: "0.4s" }}
                >
                  {index === 0 ? (
                    <img src={smsImage} alt={service.title} className="rounded-lg shadow-2xl" />
                  ) : (
                    <div className="bg-muted rounded-lg h-96 flex items-center justify-center">
                      <service.icon className="w-32 h-32 text-muted-foreground/20" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Compounding Impact Model */}
      <CompoundingImpactModel />

      {/* Supporting Services */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Full-Spectrum Strategy</h2>
            <p className="text-xl text-primary-foreground/90">
              Beyond the core services, we provide end-to-end campaign infrastructure to maximize your success.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {supportingServices.map((service, index) => (
              <Card
                key={index}
                className="bg-primary-foreground/10 border-primary-foreground/20 backdrop-blur-sm animate-scale-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardContent className="p-8">
                  <service.icon className="w-10 h-10 text-accent mb-4" />
                  <h3 className="text-xl font-bold text-primary-foreground mb-3">{service.title}</h3>
                  <p className="text-primary-foreground/80">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Ethical Promise */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">
                Our Ethical Promise
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Performance with principles. We never compromise values for ROI. Donor trust is sacred—we build
                relationships that last beyond Election Day.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: Shield,
                  title: "Transparent Practices",
                  description: "No hidden fees, no misleading tactics. Complete transparency in pricing and strategy.",
                },
                {
                  icon: Heart,
                  title: "Donor Respect",
                  description: "We honor unsubscribe requests immediately and segment messages to prevent donor fatigue.",
                },
                {
                  icon: CheckCircle2,
                  title: "FEC Compliance",
                  description: "Guaranteed compliance with all FEC regulations and fundraising best practices.",
                },
                {
                  icon: Lock,
                  title: "Privacy First",
                  description: "Donor data is protected and never shared without explicit consent.",
                },
                {
                  icon: TrendingUp,
                  title: "Sustainable Growth",
                  description: "Building long-term donor relationships, not burning out supporters for quick gains.",
                },
                {
                  icon: Users,
                  title: "Values Alignment",
                  description: "We only grow campaigns we believe in. If values don't align, we'll be honest about it.",
                },
              ].map((item, index) => (
                <Card
                  key={index}
                  className="hover-lift animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-accent/10 text-accent p-3 rounded-lg flex-shrink-0">
                        <item.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                        <p className="text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">Our Process</h2>
              <p className="text-xl text-muted-foreground">
                A proven methodology that consistently delivers results
              </p>
            </div>

            <div className="space-y-8">
              {[
                {
                  step: "01",
                  title: "Discovery & Strategy",
                  description:
                    "We start by understanding your campaign goals, audience, and unique value proposition. We audit your current digital presence and identify opportunities.",
                },
                {
                  step: "02",
                  title: "Funnel Design & Creative",
                  description:
                    "Our team designs a multi-channel funnel strategy and creates high-converting creative assets—copy, video, graphics—optimized for each platform.",
                },
                {
                  step: "03",
                  title: "Launch & Test",
                  description:
                    "We launch campaigns with multiple variants, A/B testing messaging, audiences, and creative to identify what performs best.",
                },
                {
                  step: "04",
                  title: "Optimize & Scale",
                  description:
                    "Using real-time data, we continuously optimize campaigns, reallocating budget to top performers and iterating on creative.",
                },
                {
                  step: "05",
                  title: "Report & Refine",
                  description:
                    "You receive transparent reporting on all key metrics—ROI, donor acquisition, engagement—with strategic recommendations for ongoing improvement.",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex gap-6 items-start animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="text-5xl font-black text-secondary flex-shrink-0">{item.step}</div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-lg text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-secondary to-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6 animate-fade-in">
            Ready to Maximize Your Campaign's Impact?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto animate-fade-in">
            Let's build a winning strategy together. Book a strategy call to explore how we can help your
            campaign grow.
          </p>
          <Button variant="cta" size="xl" asChild className="animate-pulse-subtle">
            <Link to="/contact">Get Started</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Services;
