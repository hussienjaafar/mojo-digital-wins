import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import StatCounter from "@/components/StatCounter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { TrendingUp, MessageSquare, Mail, Target, Users, BarChart3, Check, Shield } from "lucide-react";
import heroImage from "@/assets/hero-movement.jpg";
import dataDashboard from "@/assets/data-dashboard.jpg";

const Index = () => {
  const metrics = [
    { value: 947, label: "Average ROI %", prefix: "", suffix: "%" },
    { value: 12000, label: "Donors Acquired", prefix: "", suffix: "+" },
    { value: 89, label: "Campaign Win Rate", prefix: "", suffix: "%" },
    { value: 3.2, label: "Million Raised", prefix: "$", suffix: "M" },
  ];

  const services = [
    {
      icon: MessageSquare,
      title: "SMS Fundraising",
      description: "Convert grassroots passion into instant action with high-ROI text campaigns.",
    },
    {
      icon: Target,
      title: "Digital Advertising",
      description: "Meta, Google, and programmatic ads optimized for persuasion and acquisition.",
    },
    {
      icon: Mail,
      title: "Email Campaigns",
      description: "Narrative-driven email strategy that grows your donor base at scale.",
    },
  ];

  const caseStudies = [
    {
      name: "Unity & Justice Fund",
      roi: 947,
      avgDonation: 144.60,
      newDonors: 490,
    },
    {
      name: "Rashid for Illinois",
      roi: 415,
      avgDonation: 0,
      newDonors: 875,
    },
    {
      name: "Nasser for Michigan",
      roi: 325,
      avgDonation: 129.56,
      newDonors: 0,
    },
  ];

  const values = [
    "Racial Justice",
    "Climate Action",
    "Economic Justice",
    "Immigrant Rights",
    "Reproductive Rights",
    "LGBTQ+ Equality",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(10, 30, 62, 0.95) 0%, rgba(20, 100, 217, 0.85) 100%), url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-black text-primary-foreground mb-6 leading-tight">
              Outperforming the Establishment.
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 font-medium">
              Mojo Digital turns grassroots energy into unstoppable campaign wins.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl" asChild>
                <Link to="/contact">Join the Movement</Link>
              </Button>
              <Button variant="secondary" size="xl" asChild>
                <Link to="/case-studies">See Our Results</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((metric, index) => (
              <div key={index} className="text-center animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="text-4xl md:text-5xl font-black text-secondary mb-2">
                  <StatCounter end={metric.value} prefix={metric.prefix} suffix={metric.suffix} />
                </div>
                <div className="text-sm md:text-base text-muted-foreground font-medium">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Mojo Digital */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">
              Progressive Values. Proven Performance.
            </h2>
            <p className="text-xl text-muted-foreground">
              We combine the energy of political organizing with elite performance marketing expertise—data
              that wins elections.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-start space-x-4">
                <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Elite Performance</h3>
                  <p className="text-muted-foreground">
                    Average ROI exceeding 300%—we consistently outperform traditional political consultants.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Grassroots Power</h3>
                  <p className="text-muted-foreground">
                    Building people-powered movements that expand donor bases and create lasting change.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                  <BarChart3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Data-Driven Strategy</h3>
                  <p className="text-muted-foreground">
                    Every campaign decision backed by rigorous testing, analytics, and continuous optimization.
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-border">
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-accent/20 text-accent-foreground p-3 rounded-lg flex-shrink-0">
                      <Shield size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-foreground">Ethical Fundraising</h3>
                      <p className="text-muted-foreground">
                        Donor trust is sacred. We build relationships that last beyond Election Day, never using
                        deceptive tactics or burning out supporters for short-term gains.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="animate-slide-in-right">
              <img
                src={dataDashboard}
                alt="Campaign performance dashboard"
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Our Services</h2>
            <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
              Three core offerings designed to maximize your campaign's impact and ROI.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Card
                key={index}
                className="bg-primary-foreground/10 border-primary-foreground/20 backdrop-blur-sm animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-8">
                  <service.icon className="w-12 h-12 text-accent mb-4" />
                  <h3 className="text-2xl font-bold mb-4 text-primary-foreground">{service.title}</h3>
                  <p className="text-primary-foreground/80">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button variant="cta" size="xl" asChild>
              <Link to="/services">Explore All Services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Progressive Values */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">
                Fighting for a More Just Future
              </h2>
              <p className="text-xl text-muted-foreground">
                We only work with campaigns and causes aligned with our progressive values.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 bg-muted p-4 rounded-lg animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Check className="text-secondary w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Case Studies */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">Real Campaigns. Real Results.</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our track record speaks for itself—consistent performance that wins elections.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {caseStudies.map((study, index) => (
              <Card key={index} className="animate-scale-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold mb-6 text-foreground">{study.name}</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="text-4xl font-black text-secondary">{study.roi}%</div>
                      <div className="text-sm text-muted-foreground">Return on Investment</div>
                    </div>
                    {study.avgDonation > 0 && (
                      <div>
                        <div className="text-2xl font-bold text-foreground">${study.avgDonation}</div>
                        <div className="text-sm text-muted-foreground">Average Donation</div>
                      </div>
                    )}
                    {study.newDonors > 0 && (
                      <div>
                        <div className="text-2xl font-bold text-foreground">+{study.newDonors}</div>
                        <div className="text-sm text-muted-foreground">New Donors</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button variant="secondary" size="xl" asChild>
              <Link to="/case-studies">View All Case Studies</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6 animate-fade-in">Let's Win More. Together.</h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto animate-fade-in">
            Book a strategy call to discover how we can grow your campaign and maximize your impact.
          </p>
          <Button variant="cta" size="xl" asChild className="animate-pulse-subtle">
            <Link to="/contact">Book Strategy Call</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
