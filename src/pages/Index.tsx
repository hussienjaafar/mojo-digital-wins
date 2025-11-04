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
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 min-h-[60vh] md:min-h-[70vh] overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 z-0 animated-gradient-bg" />
        
        {/* Animated Circles */}
        <div className="animated-circles z-0">
          <div className="circle-shape circle-1" />
          <div className="circle-shape circle-2" />
          <div className="circle-shape circle-3" />
        </div>
        
        {/* Darker overlay for readability */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/60 via-transparent to-secondary/40" />
        
        {/* Texture Overlay */}
        <div className="absolute inset-0 z-0 texture-overlay" />
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-display text-primary-foreground mb-6 md:mb-8 leading-none tracking-wider">
              <span className="pop-word" style={{ animationDelay: '0.2s' }}>Outperforming</span>
              <br/>
              <span className="pop-word" style={{ animationDelay: '0.5s' }}>the</span>{' '}
              <span className="pop-word" style={{ animationDelay: '0.8s' }}>Establishment.</span>
            </h1>
            <p className="text-lg md:text-2xl lg:text-3xl text-primary-foreground/95 mb-8 md:mb-10 font-medium max-w-3xl mx-auto px-4 animate-fade-in-up" style={{ animationDelay: '1.1s' }}>
              Mojo Digital turns grassroots energy into <span className="text-accent font-bold">unstoppable campaign wins</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center px-4 animate-fade-in-up" style={{ animationDelay: '1.4s' }}>
              <Button variant="brutal" size="xl" asChild className="text-lg">
                <Link to="/contact">Join the Movement</Link>
              </Button>
              <Button variant="movement" size="xl" asChild className="text-lg">
                <Link to="/case-studies">See Our Results</Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Diagonal bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-muted" style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 0, 0 100%)' }} />
      </section>

      {/* Metrics Section */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-muted via-background to-muted relative">
        <div className="absolute inset-0 energy-glow" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-8 md:mb-12 animate-fade-in">
            <h2 className="text-headline text-foreground mb-4 tracking-wide">
              Real Numbers.<br/>Real Impact.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {metrics.map((metric, index) => (
              <div 
                key={index} 
                className="text-center animate-bounce-in bg-card border-2 border-secondary/20 p-6 md:p-8 rounded-lg hover-lift hover-glow" 
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="font-bebas text-4xl sm:text-5xl md:text-7xl text-secondary mb-2 leading-none">
                  <StatCounter end={metric.value} prefix={metric.prefix} suffix={metric.suffix} />
                </div>
                <div className="text-xs sm:text-sm md:text-base text-muted-foreground font-bold uppercase tracking-wider">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Mojo Digital */}
      <section className="py-16 md:py-24 diagonal-both bg-gradient-to-br from-primary via-secondary to-primary text-primary-foreground relative overflow-hidden">
        {/* Animated Circles */}
        <div className="animated-circles z-0">
          <div className="circle-shape circle-4" />
          <div className="circle-shape circle-5" />
        </div>
        
        <div className="absolute inset-0 texture-overlay" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16 animate-fade-in px-4">
            <h2 className="text-headline mb-4 md:mb-6 tracking-wide">
              Progressive Values.<br/>Proven Performance.
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/90 font-medium">
              We combine the energy of political organizing with elite performance marketing expertise—data
              that wins elections.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-start space-x-4 bg-primary-foreground/10 p-6 rounded-lg border-l-4 border-accent hover-lift">
                <div className="bg-accent text-accent-foreground p-3 rounded-lg flex-shrink-0">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 uppercase font-bebas tracking-wide">Elite Performance</h3>
                  <p className="text-primary-foreground/80">
                    Average ROI exceeding 300%—we consistently outperform traditional political consultants.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 bg-primary-foreground/10 p-6 rounded-lg border-l-4 border-destructive hover-lift">
                <div className="bg-destructive text-destructive-foreground p-3 rounded-lg flex-shrink-0">
                  <Users size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 uppercase font-bebas tracking-wide">Grassroots Power</h3>
                  <p className="text-primary-foreground/80">
                    Building people-powered movements that expand donor bases and create lasting change.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 bg-primary-foreground/10 p-6 rounded-lg border-l-4 border-secondary hover-lift">
                <div className="bg-secondary text-secondary-foreground p-3 rounded-lg flex-shrink-0">
                  <BarChart3 size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 uppercase font-bebas tracking-wide">Data-Driven Strategy</h3>
                  <p className="text-primary-foreground/80">
                    Every campaign decision backed by rigorous testing, analytics, and continuous optimization.
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-primary-foreground/20">
                <div className="bg-accent/20 border-2 border-accent rounded-lg p-6 hover-glow">
                  <div className="flex items-start gap-4">
                    <div className="bg-accent text-accent-foreground p-3 rounded-lg flex-shrink-0">
                      <Shield size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2 uppercase font-bebas tracking-wide">Ethical Fundraising</h3>
                      <p className="text-primary-foreground/90">
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
                className="rounded-lg shadow-2xl border-4 border-primary-foreground/20 hover-scale"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 md:py-24 bg-background relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16 animate-fade-in">
            <h2 className="text-headline text-foreground mb-4 md:mb-6 tracking-wide">Our Arsenal</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium px-4">
              Three core offerings designed to maximize your campaign's impact and ROI.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Card
                key={index}
                className="bg-gradient-to-br from-card to-muted border-2 border-secondary/20 hover:border-secondary/60 backdrop-blur-sm animate-slide-up brutal-shadow overflow-hidden group"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <CardContent className="p-8 relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                  <service.icon className="w-16 h-16 text-secondary mb-6 relative z-10" />
                  <h3 className="font-bebas text-3xl mb-4 text-foreground uppercase tracking-wide relative z-10">{service.title}</h3>
                  <p className="text-muted-foreground relative z-10">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-16">
            <Button variant="brutal" size="xl" asChild className="text-lg">
              <Link to="/services">Explore All Services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Progressive Values */}
      <section className="py-16 md:py-24 diagonal-top bg-gradient-to-br from-destructive/10 via-background to-secondary/10 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
              <h2 className="text-headline text-foreground mb-4 md:mb-6 tracking-wide">
                Fighting for a<br/>More Just Future
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground font-medium">
                We only work with campaigns and causes aligned with our progressive values.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 bg-card border-l-4 border-secondary p-6 rounded-lg animate-bounce-in hover-lift"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div className="bg-secondary/20 p-2 rounded-full">
                    <Check className="text-secondary w-5 h-5 flex-shrink-0" />
                  </div>
                  <span className="font-bold text-foreground uppercase tracking-wide">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Compounding Impact Model - Condensed */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary via-secondary to-primary text-primary-foreground relative overflow-hidden diagonal-both">
        {/* Animated Circles */}
        <div className="animated-circles z-0">
          <div className="circle-shape circle-1" />
          <div className="circle-shape circle-3" />
        </div>
        
        <div className="absolute inset-0 texture-overlay" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
              <h2 className="text-headline mb-4 tracking-wide">
                The Compounding<br/>Impact Model<sup className="text-2xl md:text-3xl text-accent">™</sup>
              </h2>
              <p className="text-lg md:text-xl text-primary-foreground/90 font-medium">
                A self-sustaining fundraising engine that grows alongside grassroots support
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
              {[
                { step: "01", value: "$5K", label: "Initial Investment", icon: "💰" },
                { step: "02", value: "200-300%", label: "ROI in 30 Days", icon: "📈" },
                { step: "03", value: "20%", label: "Reinvestment Rate", icon: "🔄" },
                { step: "04", value: "$500-1K", label: "Daily Scale", icon: "🚀" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="text-center bg-primary-foreground/10 border-2 border-accent/30 rounded-lg p-8 hover-lift animate-bounce-in backdrop-blur-sm"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <div className="text-sm font-bold text-accent mb-3 uppercase tracking-wider">STEP {item.step}</div>
                  <div className="font-bebas text-4xl text-primary-foreground mb-2 leading-none">{item.value}</div>
                  <div className="text-sm text-primary-foreground/80 font-medium uppercase">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Button variant="brutal" size="xl" asChild className="text-lg">
                <Link to="/services">Learn Our Process</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Case Studies */}
      <section className="py-16 md:py-24 bg-background relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
            <h2 className="text-headline text-foreground mb-4 md:mb-6 tracking-wide">
              Real Campaigns.<br/>Real Results.
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
              Our track record speaks for itself—consistent performance that wins elections.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {caseStudies.map((study, index) => (
              <Card 
                key={index} 
                className="bg-gradient-to-br from-card to-muted border-2 border-secondary/20 hover:border-secondary brutal-shadow animate-slide-up group overflow-hidden" 
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <CardContent className="p-8 relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
                  <h3 className="font-bebas text-3xl mb-6 text-foreground uppercase tracking-wide relative z-10">{study.name}</h3>
                  <div className="space-y-4 relative z-10">
                    <div className="bg-secondary/10 p-4 rounded-lg border-l-4 border-secondary">
                      <div className="font-bebas text-5xl text-secondary leading-none">{study.roi}%</div>
                      <div className="text-sm text-muted-foreground font-bold uppercase tracking-wide mt-1">Return on Investment</div>
                    </div>
                    {study.avgDonation > 0 && (
                      <div className="bg-accent/10 p-4 rounded-lg">
                        <div className="font-bebas text-3xl text-foreground leading-none">${study.avgDonation}</div>
                        <div className="text-sm text-muted-foreground font-bold uppercase tracking-wide mt-1">Average Donation</div>
                      </div>
                    )}
                    {study.newDonors > 0 && (
                      <div className="bg-destructive/10 p-4 rounded-lg">
                        <div className="font-bebas text-3xl text-foreground leading-none">+{study.newDonors}</div>
                        <div className="text-sm text-muted-foreground font-bold uppercase tracking-wide mt-1">New Donors</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button variant="movement" size="xl" asChild className="text-lg">
              <Link to="/case-studies">View All Case Studies</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 bg-gradient-to-br from-primary via-destructive to-secondary text-primary-foreground relative overflow-hidden diagonal-top">
        <div className="absolute inset-0 texture-overlay" />
        <div className="absolute inset-0 energy-glow" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="font-bebas text-6xl md:text-8xl mb-8 animate-fade-in uppercase tracking-wide leading-none">
            Let's Win More.<br/>Together.
          </h2>
          <p className="text-xl md:text-2xl text-primary-foreground/95 mb-12 max-w-2xl mx-auto animate-fade-in font-medium">
            Book a strategy call to discover how we can grow your campaign and maximize your impact.
          </p>
          <Button variant="brutal" size="xl" asChild className="animate-glow-pulse text-lg">
            <Link to="/contact">Book Strategy Call</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
