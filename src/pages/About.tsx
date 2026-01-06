import { Helmet } from "react-helmet";
import { Card, CardContent } from "@/components/ui/card";
import { ParticleButton } from "@/components/ParticleButton";
import { ClientLogo } from "@/components/ClientLogos";
import { Target, Users, TrendingUp, Award, Lightbulb, Zap, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedPatternHero from "@/components/AnimatedPatternHero";
import AnimatedServiceGraphic from "@/components/AnimatedServiceGraphic";
import StatCounter from "@/components/StatCounter";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";

const About = () => {
  const storySection = useScrollAnimation({ threshold: 0.2 });
  const statsSection = useScrollAnimation({ threshold: 0.2 });
  const whySection = useScrollAnimation({ threshold: 0.2 });
  const graphic1 = useScrollAnimation({ threshold: 0.2 });
  const graphic2 = useScrollAnimation({ threshold: 0.2 });

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Molitico",
    "url": "https://molitico.com",
    "logo": "https://molitico.com/logo.png",
    "description": "Full-service political consulting and digital campaign agency specializing in progressive campaigns, PACs, and nonprofits since 2016.",
    "foundingDate": "2016",
    "areaServed": "United States",
    "knowsAbout": [
      "Political Campaign Digital Strategy",
      "SMS Fundraising",
      "Digital Advertising",
      "Email Marketing",
      "Voter Polling",
      "Progressive Politics"
    ],
    "sameAs": []
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://molitico.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "About",
        "item": "https://molitico.com/about"
      }
    ]
  };

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>About Molitico | Progressive Political Campaign Agency</title>
        <meta name="description" content="We're organizers, strategists, and believers in progressive change. Since 2016, we've helped campaigns raise $10M+ with 425% average ROI." />
        <link rel="canonical" href="https://molitico.com/about" />
        <meta property="og:title" content="About Molitico | Progressive Political Campaign Agency" />
        <meta property="og:description" content="We're organizers, strategists, and believers in progressive change who happen to be really good at digital marketing." />
        <meta property="og:url" content="https://molitico.com/about" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify(organizationSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>
      <ScrollProgressIndicator />
      <Navigation />
      <AnimatedPatternHero
        title="Built for the Movement"
        description="We're not just another digital agency. We're organizers, strategists, and believers in progressive change who happen to be really good at digital marketing."
      />

      {/* Our Story */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div 
              ref={storySection.ref}
              className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
                storySection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <div className="space-y-6">
                <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>Our Story</h2>
                <div className="space-y-4 text-lg text-foreground/90 leading-relaxed">
                  <p>Molitico was born in the fires of 2016, working with campaigns and movements where we saw firsthand how grassroots energy could be amplified through smart digital strategy.</p>
                  <p>Since then, we've worked with dozens of progressive campaigns and causes, helping them raise millions in small-dollar donations and mobilize thousands of supporters.</p>
                  <p>We understand that every dollar matters, every volunteer is precious, and every message needs to break through the noise to inspire action.</p>
                </div>
              </div>
              <div 
                ref={graphic1.ref}
                className={`transition-all duration-1000 delay-300 ${
                  graphic1.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <AnimatedServiceGraphic variant="team" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-gradient-to-br from-primary via-secondary to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-12">
            <div className="space-y-4">
              <h2 className="font-bebas text-primary-foreground leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Our Impact By The Numbers
              </h2>
              <p className="text-lg md:text-xl text-primary-foreground leading-relaxed">
                Since 2016, we've helped progressive campaigns and causes achieve remarkable results
              </p>
            </div>

            <div 
              ref={statsSection.ref}
              className={`grid md:grid-cols-3 gap-8 transition-all duration-1000 ${
                statsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              {[
                { icon: TrendingUp, label: "Average ROI", value: 425, suffix: "%" },
                { icon: DollarSign, label: "Raised", value: 10, prefix: "$", suffix: "M+" },
                { icon: Users, label: "Donors Acquired", value: 200, suffix: "K+" }
              ].map((stat, index) => (
                <div
                  key={index}
                  className={`space-y-4 transition-all duration-700 ${
                    statsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 mx-auto bg-primary-foreground/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                    <stat.icon className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 text-primary-foreground drop-shadow-lg" />
                  </div>
                  <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary-foreground font-bebas tracking-wider">
                    <StatCounter 
                      end={stat.value} 
                      prefix={stat.prefix} 
                      suffix={stat.suffix}
                      duration={2500}
                    />
                  </div>
                  <p className="text-lg text-primary-foreground font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Clients Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Trusted By Progressive Leaders
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                From Senate campaigns to grassroots nonprofits, we partner with organizations fighting for real change
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 max-w-5xl mx-auto">
              {[
                "Abdul for U.S. Senate",
                "Unity & Justice Fund",
                "Nasser for Michigan",
                "Preston For PA",
                "Rashid for Illinois",
                "CAIR Action",
                "MPAC",
                "The Truth Project",
                "A New Policy"
              ].map((client, index) => (
                <Card
                  key={index}
                  className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.03] border border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-4 sm:p-5 md:p-6 flex items-center justify-center min-h-[100px] sm:min-h-[120px] md:min-h-[140px]">
                    <ClientLogo name={client} className="text-foreground group-hover:text-primary transition-colors duration-300" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center pt-8">
              <p className="text-muted-foreground text-lg">
                And many more progressive campaigns across the country
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-bebas text-primary text-center mb-16 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>What Drives Us</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { icon: Target, title: "Results First", description: "We measure success in funds raised, supporters mobilized, and battles won—not vanity metrics." },
              { icon: Users, title: "Movement Minded", description: "We understand progressive politics because we live it. Your values are our values." },
              { icon: TrendingUp, title: "Data Obsessed", description: "Every decision is backed by data. We test, optimize, and iterate to maximize your impact." }
            ].map((value, index) => (
                <Card key={index} className="bg-card backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50">
                <CardContent className="p-6 sm:p-7 md:p-8 text-center space-y-4">
                  <div className="w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center shadow-md">
                    <value.icon className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-primary-foreground drop-shadow-sm" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{value.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="font-bebas text-primary text-center mb-16 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>Why Choose Us</h2>
          <div className="max-w-6xl mx-auto">
            <div 
              ref={whySection.ref}
              className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
                whySection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <div 
                ref={graphic2.ref}
                className={`transition-all duration-1000 delay-300 ${
                  graphic2.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <AnimatedServiceGraphic variant="growth" />
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-bold text-foreground">We're more than just marketers.</h3>
                <div className="space-y-4 text-lg text-foreground/90 leading-relaxed">
                  <p>We're a team of former campaign staffers, organizers, and technologists who are passionate about progressive change.</p>
                  <p>We bring a unique blend of political savvy and digital expertise to every project.</p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-3 text-foreground">
                    <Zap className="h-5 w-5 text-secondary" />
                    <span>Proven track record of success</span>
                  </li>
                  <li className="flex items-center space-x-3 text-foreground">
                    <Lightbulb className="h-5 w-5 text-secondary" />
                    <span>Deep understanding of progressive politics</span>
                  </li>
                  <li className="flex items-center space-x-3 text-foreground">
                    <Award className="h-5 w-5 text-secondary" />
                    <span>Data-driven approach to maximize impact</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-gradient-to-br from-primary via-secondary to-destructive relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8 text-primary-foreground">
            <h2 className="font-bebas leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>Ready to Make Impact Together?</h2>
            <p className="text-lg md:text-xl leading-relaxed">Let's build a movement that breaks through, raises more, and wins.</p>
            <ParticleButton
              href="https://calendly.com/molitico/30min"
              size="xl"
              particleColor="hsl(var(--destructive))"
              particleCount={25}
              className="text-lg font-bold bg-card text-card-foreground hover:bg-card/90"
            >
              Schedule Your Free Call
            </ParticleButton>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default About;
