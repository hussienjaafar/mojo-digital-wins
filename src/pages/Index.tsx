import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import StatCounter from "@/components/StatCounter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { TrendingUp, MessageSquare, Mail, Target, Users, BarChart3, Check, Shield } from "lucide-react";
import heroImage from "@/assets/hero-movement.jpg";
import heroRally from "@/assets/hero-movement-rally.jpg";
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
      <section className="relative pt-28 md:pt-32 pb-16 md:pb-24 overflow-hidden">
        {/* Background Image with Parallax and Navy Overlay */}
        <div className="absolute inset-0">
          <div 
            className="hero-parallax-bg absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${heroRally})`,
            }}
          />
          <div className="absolute inset-0 bg-primary/75" />
        </div>
        
        {/* Gritty grain texture overlay */}
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
        
        <div className="max-w-[1280px] mx-auto px-6 relative z-10">
          <div className="max-w-[720px]">
            {/* Headline */}
            <div className="mb-6">
              <h1 
                className="font-bebas text-[2.75rem] leading-[1.05] md:text-[4rem] lg:text-[5rem] font-black text-primary-foreground tracking-wide uppercase hero-headline-impact max-w-[10ch]"
                style={{ 
                  animation: 'slide-up-in 0.7s cubic-bezier(0.4, 0, 0.2, 1) 150ms both',
                  letterSpacing: '0.04em'
                }}
              >
                Outperforming<br/>the Establishment.
              </h1>
              {/* Red activist underline with swipe animation */}
              <div 
                className="h-[3px] w-[180px] bg-destructive mt-4 rounded-full animate-swipe-right"
                style={{ 
                  animationDelay: '0.6s'
                }}
              />
            </div>
            
            {/* Subhead */}
            <p 
              className="text-lg md:text-xl text-primary-foreground/95 leading-relaxed mb-8 max-w-[620px] font-medium"
              style={{ 
                animation: 'fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 250ms both'
              }}
            >
              We turn grassroots energy into measurable wins with SMS, digital ads, and email built for ROI.
            </p>
            
            {/* CTAs */}
            <div 
              className="flex flex-col sm:flex-row gap-4 mb-8"
              style={{ 
                animation: 'fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 280ms both'
              }}
            >
              <Button 
                size="lg" 
                asChild
                className="hero-cta-premium bg-secondary hover:bg-secondary/90 hover:scale-[1.03] text-secondary-foreground font-semibold rounded-lg px-8 h-12 text-base transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Link to="/contact">Grow Your Donor Base</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild
                className="border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary hover:scale-[1.03] font-semibold rounded-lg px-8 h-12 text-base transition-all duration-200"
              >
                <Link to="/case-studies">See Results</Link>
              </Button>
            </div>
            
            {/* Metrics Strip - Elevated Cards with Premium Spacing */}
            <div 
              className="flex flex-wrap gap-6 mb-8"
              style={{ 
                animation: 'fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 340ms both'
              }}
            >
              <div className="flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 pr-6 shadow-lg border border-primary-foreground/20 hover:scale-105 hover:shadow-xl transition-all duration-200 group kpi-card-pulse">
                <div className="w-11 h-11 rounded-lg bg-secondary/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <TrendingUp className="w-5 h-5 text-secondary drop-shadow-glow" />
                </div>
                <div>
                  <div className="font-bebas text-2xl md:text-3xl text-primary-foreground leading-none">
                    <StatCounter end={947} suffix="%" duration={700} />
                  </div>
                  <div className="text-xs text-primary-foreground/80 font-medium uppercase tracking-wide">ROI</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 pr-6 shadow-lg border border-primary-foreground/20 hover:scale-105 hover:shadow-xl transition-all duration-200 group kpi-card-pulse">
                <div className="w-11 h-11 rounded-lg bg-destructive/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Users className="w-5 h-5 text-destructive drop-shadow-glow" />
                </div>
                <div>
                  <div className="font-bebas text-2xl md:text-3xl text-primary-foreground leading-none">
                    +<StatCounter end={5909} duration={700} />
                  </div>
                  <div className="text-xs text-primary-foreground/80 font-medium uppercase tracking-wide">Donors</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-4 pr-6 shadow-lg border border-primary-foreground/20 hover:scale-105 hover:shadow-xl transition-all duration-200 group kpi-card-pulse">
                <div className="w-11 h-11 rounded-lg bg-accent/30 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <Target className="w-5 h-5 text-accent-foreground drop-shadow-glow" />
                </div>
                <div>
                  <div className="font-bebas text-2xl md:text-3xl text-primary-foreground leading-none">
                    <StatCounter end={2} duration={700} /> Weeks
                  </div>
                  <div className="text-xs text-primary-foreground/80 font-medium uppercase tracking-wide">Turnaround</div>
                </div>
              </div>
            </div>

            {/* Credibility Strip */}
            <div 
              className="border-t border-primary-foreground/20 pt-6 pb-4"
              style={{ 
                animation: 'fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) 420ms both'
              }}
            >
              <p className="text-sm text-primary-foreground/75 font-medium tracking-wide mb-6">
                Trusted by campaigns in <span className="text-primary-foreground font-semibold">Michigan</span>, <span className="text-primary-foreground font-semibold">Illinois</span>, <span className="text-primary-foreground font-semibold">Pennsylvania</span>, and nationwide.
              </p>
              
              {/* Campaign Logo Carousel */}
              <div className="overflow-hidden relative mt-4">
                <div className="flex gap-4 animate-scroll-left">
                  {['Unity & Justice Fund', 'Rashid for Illinois', 'Nasser for Michigan', 'Progressive Victory', 'Movement Forward', 'People Power PAC'].map((campaign, i) => (
                    <div 
                      key={i} 
                      className="flex-shrink-0 bg-primary-foreground/5 backdrop-blur-sm px-6 py-3 rounded-lg border border-primary-foreground/10 text-primary-foreground/60 text-sm font-semibold uppercase tracking-wide whitespace-nowrap"
                    >
                      {campaign}
                    </div>
                  ))}
                  {/* Duplicate for seamless loop */}
                  {['Unity & Justice Fund', 'Rashid for Illinois', 'Nasser for Michigan', 'Progressive Victory', 'Movement Forward', 'People Power PAC'].map((campaign, i) => (
                    <div 
                      key={`dup-${i}`} 
                      className="flex-shrink-0 bg-primary-foreground/5 backdrop-blur-sm px-6 py-3 rounded-lg border border-primary-foreground/10 text-primary-foreground/60 text-sm font-semibold uppercase tracking-wide whitespace-nowrap"
                    >
                      {campaign}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How We Win Elections - Scroll Story Section */}
      <section className="py-20 md:py-28 bg-background relative">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-bebas text-4xl md:text-5xl lg:text-6xl text-foreground mb-4 uppercase tracking-wide">
              How We Win Elections in 3 Key Steps
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              A proven system that turns grassroots movements into electoral victories
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {[
              {
                step: '1',
                icon: Target,
                title: 'Rapid Acquisition',
                description: 'Paid social that scales donor lists fast—reaching the right supporters at the right moment with laser-focused targeting.',
              },
              {
                step: '2',
                icon: MessageSquare,
                title: 'Compelling Fundraising',
                description: 'Conversion-optimized SMS & email campaigns that inspire action and drive revenue without burning out your base.',
              },
              {
                step: '3',
                icon: BarChart3,
                title: 'Relentless Optimization',
                description: 'Real-time data decisions that continuously grow ROI—every dollar tracked, every test measured, every win amplified.',
              },
            ].map((step, index) => (
              <Card
                key={index}
                className="bg-gradient-to-br from-card to-muted border-2 border-secondary/20 hover:border-secondary/60 backdrop-blur-sm hover-lift overflow-hidden group scroll-reveal"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-8 relative">
                  <div className="absolute top-4 right-4 font-bebas text-6xl text-secondary/10 group-hover:text-secondary/20 transition-colors">
                    {step.step}
                  </div>
                  <step.icon className="w-14 h-14 text-secondary mb-6 relative z-10 group-hover:scale-110 transition-transform duration-300" />
                  <h3 className="font-bebas text-3xl mb-4 text-foreground uppercase tracking-wide relative z-10">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground relative z-10 leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Work Preview - Featured Case Studies */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-muted via-background to-muted relative">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-bebas text-4xl md:text-5xl lg:text-6xl text-foreground mb-4 uppercase tracking-wide">
              Proven Results That Win
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Real campaigns. Real metrics. Real victories.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { roi: '947%', campaign: 'Unity & Justice Fund', stat: '+490 new donors', color: 'secondary' },
              { roi: '415%', campaign: 'Rashid for Illinois', stat: '+875 new donors in 2 weeks', color: 'destructive' },
              { roi: '325%', campaign: 'Nasser for Michigan', stat: '$129.56 avg donation', color: 'accent' },
            ].map((item, index) => (
              <Card
                key={index}
                className="bg-card border-2 border-border hover:border-secondary overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-2xl work-preview-card"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br from-${item.color} to-${item.color}/80 p-8 text-${item.color}-foreground relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
                    <div className="relative z-10">
                      <div className="font-bebas text-6xl md:text-7xl mb-2 leading-none group-hover:scale-110 transition-transform duration-300 origin-left">
                        {item.roi}
                      </div>
                      <div className="text-sm uppercase tracking-wider opacity-90">ROI</div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-bebas text-2xl mb-2 text-foreground uppercase tracking-wide">
                      {item.campaign}
                    </h3>
                    <p className="text-muted-foreground mb-4">{item.stat}</p>
                    <div className="flex items-center gap-2 text-secondary font-semibold opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                      View Case Study
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button variant="brutal" size="xl" asChild className="text-lg">
              <Link to="/case-studies">View All Case Studies</Link>
            </Button>
          </div>
        </div>
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
