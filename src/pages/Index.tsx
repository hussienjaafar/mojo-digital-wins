import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientLogo } from "@/components/ClientLogos";
import StatCounter from "@/components/StatCounter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { TrendingUp, MessageSquare, Mail, Target, Users, BarChart3, Check, Shield } from "lucide-react";
import { ParticleButton } from "@/components/ParticleButton";
import heroImage from "@/assets/hero-movement.jpg";
import heroRally from "@/assets/hero-movement-rally.jpg";
import { AnimatedGeometricBackground } from "@/components/AnimatedGeometricBackground";
import { featuredCaseStudies } from "@/data/caseStudies";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const Index = () => {
  const heroBackgroundRef = useRef<HTMLDivElement>(null);
  const howWeWin = useScrollAnimation({ threshold: 0.2 });
  const caseStudiesSection = useScrollAnimation({ threshold: 0.2 });
  const servicesSection = useScrollAnimation({ threshold: 0.2 });
  const valuesSection = useScrollAnimation({ threshold: 0.2 });
  const metricsSection = useScrollAnimation({ threshold: 0.2 });
  const whyMolitico = useScrollAnimation({ threshold: 0.2 });
  const compoundingImpact = useScrollAnimation({ threshold: 0.2 });
  const clientLogos = useScrollAnimation({ threshold: 0.2 });
  const finalCTA = useScrollAnimation({ threshold: 0.2 });

  // Parallax effect for hero background
  useEffect(() => {
    const handleScroll = () => {
      if (heroBackgroundRef.current) {
        const scrolled = window.scrollY;
        const parallaxSpeed = 0.5; // Adjust this value to control parallax intensity (0.5 = half speed)
        heroBackgroundRef.current.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const metrics = [
    { value: 425, label: "Average ROI %", prefix: "", suffix: "%" },
    { value: 200, label: "Donors Acquired", prefix: "", suffix: "K+" },
    { value: 500, label: "Avg New Donors (First Month)", prefix: "", suffix: "+" },
    { value: 10, label: "Million Raised", prefix: "$", suffix: "M+" },
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
      <ScrollProgressIndicator />
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-28 md:pt-32 pb-16 md:pb-24 overflow-hidden">
        {/* Background Image with Parallax and Navy Overlay */}
        <div className="absolute inset-0">
          <div 
            ref={heroBackgroundRef}
            className="absolute inset-0 bg-cover bg-center will-change-transform"
            style={{
              backgroundImage: `url(${heroRally})`,
              top: '-20%',
              bottom: '-20%',
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
            {/* Headline - Slightly larger with tighter letter spacing */}
            <div className="mb-6">
              <h1 
                className="font-bebas text-[3rem] leading-[1.05] md:text-[4.5rem] lg:text-[5.5rem] font-black text-primary-foreground uppercase hero-headline-impact max-w-[10ch]"
                style={{ 
                  animation: 'slide-up-in 0.7s cubic-bezier(0.4, 0, 0.2, 1) 150ms both',
                  letterSpacing: '0.02em'
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
            
            {/* Subhead - Variant B (shorter) */}
            <p 
              className="text-lg md:text-xl text-primary-foreground/95 leading-relaxed mb-8 max-w-[620px] font-medium"
              style={{ 
                animation: 'fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 250ms both'
              }}
            >
              We convert grassroots energy into measurable growth with SMS, digital ads, and high-ROI email.
            </p>
            
            {/* CTAs - Enhanced with particle effects */}
            <div 
              className="flex flex-col sm:flex-row gap-4 mb-6"
              style={{ 
                animation: 'fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 280ms both'
              }}
            >
              <ParticleButton 
                href="https://calendly.com/molitico/30min"
                size="lg"
                particleColor="hsl(var(--secondary))"
                particleCount={20}
                className="font-bold"
              >
                Book Free Strategy Call
              </ParticleButton>
              <ParticleButton 
                to="/case-studies"
                size="lg"
                variant="outline"
                particleColor="hsl(var(--accent))"
                particleCount={18}
                className="font-semibold"
              >
                See Results
              </ParticleButton>
            </div>
            
            {/* Metrics Strip - Elevated Cards moved up to group with CTAs */}
            <div 
              className="flex flex-wrap gap-6 mb-12"
              style={{ 
                animation: 'fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) 340ms both'
              }}
            >
              <div className="flex items-center gap-3 bg-primary-foreground/12 backdrop-blur-md rounded-[10px] p-4 pr-6 shadow-[0_6px_20px_rgba(0,0,0,0.3)] border border-primary-foreground/25 hover:scale-[1.03] hover:shadow-[0_8px_30px_rgba(20,100,217,0.4)] transition-all duration-300 group kpi-card-pulse kpi-glow-ring">
                <div className="w-11 h-11 rounded-lg bg-secondary/35 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="w-5 h-5 text-secondary drop-shadow-glow" />
                </div>
                <div>
                  <div className="font-bebas text-2xl md:text-3xl text-primary-foreground leading-none">
                    <StatCounter end={425} suffix="%" duration={700} />
                  </div>
                  <div className="text-xs text-primary-foreground/80 font-medium uppercase tracking-wide">Average ROI</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-primary-foreground/12 backdrop-blur-md rounded-[10px] p-4 pr-6 shadow-[0_6px_20px_rgba(0,0,0,0.3)] border border-primary-foreground/25 hover:scale-[1.03] hover:shadow-[0_8px_30px_rgba(224,45,45,0.4)] transition-all duration-300 group kpi-card-pulse kpi-glow-ring">
                <div className="w-11 h-11 rounded-lg bg-destructive/35 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-5 h-5 text-destructive drop-shadow-glow" />
                </div>
                <div>
                  <div className="font-bebas text-2xl md:text-3xl text-primary-foreground leading-none">
                    $<StatCounter end={10} duration={700} />M+
                  </div>
                  <div className="text-xs text-primary-foreground/80 font-medium uppercase tracking-wide">Raised</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-primary-foreground/12 backdrop-blur-md rounded-[10px] p-4 pr-6 shadow-[0_6px_20px_rgba(0,0,0,0.3)] border border-primary-foreground/25 hover:scale-[1.03] hover:shadow-[0_8px_30px_rgba(244,196,48,0.4)] transition-all duration-300 group kpi-card-pulse kpi-glow-ring">
                <div className="w-11 h-11 rounded-lg bg-accent/35 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-5 h-5 text-accent-foreground drop-shadow-glow" />
                </div>
                <div>
                  <div className="font-bebas text-2xl md:text-3xl text-primary-foreground leading-none">
                    Proprietary
                  </div>
                  <div className="text-xs text-primary-foreground/80 font-medium uppercase tracking-wide">Donor Data</div>
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
                Trusted by progressive organizations in <span className="text-primary-foreground font-semibold">Michigan</span>, <span className="text-primary-foreground font-semibold">Illinois</span>, <span className="text-primary-foreground font-semibold">Pennsylvania</span>, and nationwide.
              </p>
              
              {/* Campaign Logo Carousel */}
              <div className="overflow-hidden relative mt-4">
                <div className="flex gap-4 animate-scroll-left">
                  {['Unity & Justice Fund', 'Abdul for U.S. Senate', 'Nasser for Michigan', 'Preston For PA', 'Rashid for Illinois', 'Arab-American Non-profit', 'A New Policy'].map((campaign, i) => (
                    <div 
                      key={i} 
                      className="flex-shrink-0 bg-primary-foreground/5 backdrop-blur-sm px-6 py-3 rounded-lg border border-primary-foreground/10 text-primary-foreground/60 text-sm font-semibold uppercase tracking-wide whitespace-nowrap"
                    >
                      {campaign}
                    </div>
                  ))}
                  {/* Duplicate for seamless loop */}
                  {['Unity & Justice Fund', 'Abdul for U.S. Senate', 'Nasser for Michigan', 'Preston For PA', 'Rashid for Illinois', 'Arab-American Non-profit', 'A New Policy'].map((campaign, i) => (
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
            
            {/* Scroll Arrow Prompt */}
            <div 
              className="flex justify-center mt-8 animate-bounce"
              style={{ 
                animation: 'bounce 2s ease-in-out infinite, fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) 500ms both'
              }}
              aria-hidden="true"
            >
              <svg 
                className="w-6 h-6 text-primary-foreground/60" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2.5} 
                  d="M19 14l-7 7m0 0l-7-7m7 7V3" 
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* How We Win for Progressives - Scroll Story Section */}
      <section className="py-24 md:py-32 bg-background relative">
        <div ref={howWeWin.ref} className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-16 md:mb-20">
            <h2 className="font-bebas text-4xl md:text-5xl lg:text-6xl text-foreground mb-4 uppercase tracking-wide">
              How We Drive Progressive Impact
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              A proven system that turns grassroots movements into victories for progressive causes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10 md:gap-12">
            {[
              {
                step: '1',
                icon: Target,
                title: 'Rapid Acquisition',
                description: 'Donor growth through precision targeting—reaching progressive supporters at scale with data-driven paid social.',
              },
              {
                step: '2',
                icon: MessageSquare,
                title: 'Compelling Fundraising',
                description: 'SMS + email built to convert—high-velocity campaigns that inspire action and drive measurable revenue.',
              },
              {
                step: '3',
                icon: BarChart3,
                title: 'Relentless Optimization',
                description: 'Data decisions that scale ROI—real-time testing, continuous improvement, and compounding performance gains.',
              },
            ].map((step, index) => (
              <Card
                key={index}
                className={`bg-gradient-to-br from-card to-muted border-2 border-secondary/20 hover:border-secondary/60 backdrop-blur-sm overflow-hidden group hover:shadow-[0_12px_40px_rgba(20,100,217,0.2)] transition-all duration-700 ${
                  howWeWin.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ 
                  transitionDelay: `${index * 150}ms`
                }}
              >
                <CardContent className="p-10 relative">
                  <div className="absolute top-4 right-4 font-bebas text-7xl text-secondary/8 group-hover:text-secondary/15 transition-colors duration-500">
                    {step.step}
                  </div>
                  <step.icon className="w-16 h-16 text-secondary mb-6 relative z-10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300" />
                  <h3 className="font-bebas text-3xl mb-4 text-foreground uppercase tracking-wide relative z-10">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground relative z-10 leading-relaxed text-base">
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
        <div ref={caseStudiesSection.ref} className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-bebas text-4xl md:text-5xl lg:text-6xl text-foreground mb-4 uppercase tracking-wide">
              Proven Results That Win
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Real organizations. Real metrics. Real victories.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {featuredCaseStudies.slice(0, 3).map((study, index) => (
              <Link key={study.id} to={`/case-studies/${study.id}`} className="block">
              <Card
                className={`bg-card border-2 border-border hover:border-secondary overflow-hidden group cursor-pointer transition-all duration-700 hover:shadow-2xl h-full ${
                  caseStudiesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <CardContent className="p-0">
                  {study.image && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img 
                        src={study.image} 
                        alt={`${study.title} campaign visual`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className={`bg-gradient-to-br from-secondary to-secondary/80 p-8 text-secondary-foreground relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
                    <div className="relative z-10">
                      <div className="font-bebas text-6xl md:text-7xl mb-2 leading-none group-hover:scale-110 transition-transform duration-300 origin-left">
                        {study.stat.replace(' ROI', '')}
                      </div>
                      <div className="text-sm uppercase tracking-wider opacity-90">ROI</div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-bebas text-2xl mb-2 text-foreground uppercase tracking-wide">
                      {study.title}
                    </h3>
                    <p className="text-muted-foreground mb-4 line-clamp-2">{study.description}</p>
                    <div className="flex items-center gap-2 text-secondary font-semibold opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300" aria-hidden="true">
                      View Case Study
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button variant="brutal" size="xl" asChild className="text-lg">
              <Link to="/case-studies">View All Case Studies</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Metrics Section - Enhanced Visual Emphasis */}
      <section ref={metricsSection.ref} className="py-16 md:py-28 bg-gradient-to-br from-muted via-background to-muted relative overflow-hidden">
        {/* Animated Background Glow Effects */}
        <div className="absolute inset-0 energy-glow" />
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-destructive/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className={`text-center mb-12 md:mb-16 transition-all duration-700 ${
            metricsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <div className="inline-block mb-4 px-6 py-2 bg-secondary/10 border border-secondary/30 rounded-full">
              <span className="text-sm font-bold text-secondary uppercase tracking-wider">Proven Track Record</span>
            </div>
            <h2 className="text-headline text-foreground mb-4 tracking-wide">
              Real Numbers.<br/>Real Impact.
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              These aren't projections—they're results from actual progressive campaigns
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-6xl mx-auto">
            {metrics.map((metric, index) => (
              <div 
                key={index} 
                className={`group relative text-center bg-gradient-to-br from-card via-card to-muted border-2 border-secondary/20 p-8 md:p-10 rounded-2xl hover:border-secondary hover:scale-105 transition-all duration-700 shadow-lg hover:shadow-2xl ${
                  metricsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ 
                  transitionDelay: `${index * 150}ms`,
                  boxShadow: '0 10px 40px rgba(20, 100, 217, 0.1)'
                }}
              >
                {/* Glow Effect on Hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary/5 to-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Animated Border Gradient */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-secondary via-destructive to-accent opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500" />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Metric Number with Pulsing Animation */}
                  <div className="font-bebas text-5xl sm:text-6xl md:text-7xl lg:text-8xl mb-3 leading-none bg-gradient-to-br from-secondary via-secondary to-destructive bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(20,100,217,0.3)] group-hover:drop-shadow-[0_0_30px_rgba(20,100,217,0.6)] transition-all duration-500 animate-pulse-subtle">
                    <StatCounter end={metric.value} prefix={metric.prefix} suffix={metric.suffix} duration={2500} />
                  </div>
                  
                  {/* Label */}
                  <div className="text-xs sm:text-sm md:text-base text-muted-foreground font-bold uppercase tracking-wider group-hover:text-foreground transition-colors duration-300">
                    {metric.label}
                  </div>
                  
                  {/* Icon Accent */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br from-secondary to-destructive rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Bottom Emphasis Text */}
          <div className={`text-center mt-12 transition-all duration-700 ${
            metricsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`} style={{ transitionDelay: '600ms' }}>
            <p className="text-sm md:text-base text-muted-foreground font-medium">
              <span className="text-secondary font-bold">200,000+ donors</span> acquired • 
              <span className="text-destructive font-bold"> $10M+ raised</span> • 
              <span className="text-accent-foreground font-bold"> 425% average ROI</span>
            </p>
          </div>
        </div>
      </section>

      {/* Why Molitico */}
      <section ref={whyMolitico.ref} className="py-16 md:py-24 diagonal-both bg-gradient-to-br from-primary via-secondary to-primary text-primary-foreground relative overflow-hidden">
        {/* Animated Geometric Background */}
        <AnimatedGeometricBackground />
        
        <div className="absolute inset-0 texture-overlay z-[1]" />
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className={`max-w-3xl mx-auto text-center mb-12 md:mb-16 px-4 transition-all duration-700 ${
            whyMolitico.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <h2 className="text-headline mb-4 md:mb-6 tracking-wide">
              Progressive Values.<br/>Proven Performance.
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/90 font-medium">
              We combine the energy of political organizing with elite performance marketing expertise—data
              that wins elections.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6 md:gap-8">
              <div 
                className={`flex items-start space-x-4 bg-primary-foreground/10 p-6 rounded-lg border-l-4 border-accent hover-lift transition-all duration-700 ${
                  whyMolitico.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
                style={{ transitionDelay: '100ms' }}
              >
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

              <div 
                className={`flex items-start space-x-4 bg-primary-foreground/10 p-6 rounded-lg border-l-4 border-destructive hover-lift transition-all duration-700 ${
                  whyMolitico.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
                }`}
                style={{ transitionDelay: '200ms' }}
              >
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

              <div 
                className={`flex items-start space-x-4 bg-primary-foreground/10 p-6 rounded-lg border-l-4 border-secondary hover-lift transition-all duration-700 ${
                  whyMolitico.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
                style={{ transitionDelay: '300ms' }}
              >
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

              <div 
                className={`bg-accent/20 border-2 border-accent rounded-lg p-6 hover-glow transition-all duration-700 ${
                  whyMolitico.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
                }`}
                style={{ transitionDelay: '400ms' }}
              >
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
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 md:py-24 bg-background relative">
        <div ref={servicesSection.ref} className="container mx-auto px-4 sm:px-6">
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
                className={`bg-gradient-to-br from-card to-muted border-2 border-secondary/20 hover:border-secondary/60 backdrop-blur-sm brutal-shadow overflow-hidden group transition-all duration-700 ${
                  servicesSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
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
        <div ref={valuesSection.ref} className="container mx-auto px-4 sm:px-6">
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
                  className={`flex items-center space-x-3 bg-card border-l-4 border-secondary p-6 rounded-lg hover-lift transition-all duration-700 ${
                    valuesSection.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                  }`}
                  style={{ transitionDelay: `${index * 80}ms` }}
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
      <section ref={compoundingImpact.ref} className="py-16 md:py-24 bg-gradient-to-br from-primary via-secondary to-primary text-primary-foreground relative overflow-hidden diagonal-both">
        {/* Animated Circles */}
        <div className="animated-circles z-0">
          <div className="circle-shape circle-1" />
          <div className="circle-shape circle-3" />
        </div>
        
        <div className="absolute inset-0 texture-overlay" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className={`text-center mb-12 md:mb-16 px-4 transition-all duration-700 ${
              compoundingImpact.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}>
              <h2 className="text-headline mb-4 tracking-wide">
                The Compounding<br/>Impact Model
              </h2>
              <p className="text-lg md:text-xl text-primary-foreground/90 font-medium">
                A self-sustaining fundraising engine that grows alongside grassroots support
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
              {[
                { step: "01", value: "$5K", label: "Initial Investment" },
                { step: "02", value: "200-300%", label: "ROI in 30 Days" },
                { step: "03", value: "20%", label: "Reinvestment Rate" },
                { step: "04", value: "$500-1K", label: "Daily Scale" },
              ].map((item, index) => (
                <div
                  key={index}
                  className={`text-center bg-primary-foreground/10 border-2 border-accent/30 rounded-lg p-8 hover-lift backdrop-blur-sm transition-all duration-700 ${
                    compoundingImpact.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  <div className="text-sm font-bold text-accent mb-4 uppercase tracking-wider">STEP {item.step}</div>
                  <div className="font-bebas text-5xl text-primary-foreground mb-2 leading-none">{item.value}</div>
                  <div className="text-sm text-primary-foreground/80 font-medium uppercase tracking-wide">{item.label}</div>
                </div>
              ))}
            </div>

            <div className={`text-center transition-all duration-700 ${
              compoundingImpact.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`} style={{ transitionDelay: '600ms' }}>
              <Button variant="brutal" size="xl" asChild className="text-lg">
                <Link to="/services">Learn Our Process</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Client Logos Section */}
      <section ref={clientLogos.ref} className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className={`text-center space-y-4 transition-all duration-700 ${
              clientLogos.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}>
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Trusted By Progressive Leaders
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                Partnering with campaigns and organizations fighting for real change
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                "Abdul for U.S. Senate",
                "Unity & Justice Fund",
                "Nasser for Michigan",
                "Preston For PA",
                "Rashid for Illinois",
                "Arab-American Non-profit",
                "A New Policy"
              ].map((client, index) => (
                <Card
                  key={index}
                  className={`group hover:shadow-lg transition-all duration-700 hover:scale-[1.03] border border-border/50 bg-card/50 backdrop-blur-sm cursor-pointer ${
                    clientLogos.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  } ${index === 6 ? 'md:col-start-2' : ''}`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-8 flex items-center justify-center min-h-[140px]">
                    <ClientLogo name={client} className="text-foreground group-hover:text-primary transition-colors duration-300" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* Final CTA */}
      <section ref={finalCTA.ref} className="py-28 bg-gradient-to-br from-primary via-destructive to-secondary text-primary-foreground relative overflow-hidden diagonal-top">
        <div className="absolute inset-0 texture-overlay" />
        <div className="absolute inset-0 energy-glow" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className={`font-bebas text-6xl md:text-8xl mb-8 uppercase tracking-wide leading-none transition-all duration-700 ${
            finalCTA.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}>
            Let's Win More.<br/>Together.
          </h2>
          <p className={`text-xl md:text-2xl text-primary-foreground/95 mb-12 max-w-2xl mx-auto font-medium transition-all duration-700 ${
            finalCTA.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`} style={{ transitionDelay: '200ms' }}>
            Book a strategy call to discover how we can grow your campaign and maximize your impact.
          </p>
          <div className={`transition-all duration-700 ${
            finalCTA.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`} style={{ transitionDelay: '400ms' }}>
            <ParticleButton
              href="https://calendly.com/molitico/30min"
              size="xl"
              particleColor="hsl(var(--destructive))"
              particleCount={25}
              className="text-lg font-bold bg-background text-foreground hover:bg-background/90 border-4 border-background shadow-[8px_8px_0px_hsl(var(--destructive))] hover:shadow-[4px_4px_0px_hsl(var(--destructive))] hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              Book Strategy Call Now
            </ParticleButton>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
