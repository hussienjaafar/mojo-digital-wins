import { Helmet } from "react-helmet";
import { Card, CardContent } from "@/components/ui/card";
import { ParticleButton } from "@/components/ParticleButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { 
  Megaphone, 
  MessageSquare, 
  Mail, 
  Monitor,
  PieChart,
  BarChart3, 
  Palette, 
  Target,
  Zap,
  HelpCircle
} from "lucide-react";
import billboardMamdani from "@/assets/billboard-mamdani-bus.webp";
import billboardTimesSquareWide from "@/assets/billboard-times-square-wide.jpg";
import billboardTimesSquareMedium from "@/assets/billboard-times-square-medium.jpg";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedPatternHero from "@/components/AnimatedPatternHero";
import AnimatedServiceGraphic from "@/components/AnimatedServiceGraphic";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";
import { useState, type ReactNode } from "react";

// Local VisuallyHidden component
const VisuallyHidden = ({ children }: { children: ReactNode }) => (
  <span className="sr-only">{children}</span>
);

const Services = () => {
  const [selectedBillboard, setSelectedBillboard] = useState<{ src: string; alt: string; caption: string } | null>(null);
  
  const service1 = useScrollAnimation({ threshold: 0.2 });
  const service2 = useScrollAnimation({ threshold: 0.2 });
  const service3 = useScrollAnimation({ threshold: 0.2 });
  const service4 = useScrollAnimation({ threshold: 0.2 });
  const service5 = useScrollAnimation({ threshold: 0.2 });
  const graphic1 = useScrollAnimation({ threshold: 0.2 });
  const graphic2 = useScrollAnimation({ threshold: 0.2 });
  const graphic3 = useScrollAnimation({ threshold: 0.2 });
  const graphic4 = useScrollAnimation({ threshold: 0.2 });
  const graphic5 = useScrollAnimation({ threshold: 0.2 });
  const billboardGallery = useScrollAnimation({ threshold: 0.2 });
  const additionalServices = useScrollAnimation({ threshold: 0.2 });
  const processSection = useScrollAnimation({ threshold: 0.2 });
  const faqSection = useScrollAnimation({ threshold: 0.2 });

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
        "name": "Services",
        "item": "https://molitico.com/services"
      }
    ]
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": "Political Campaign Digital Services",
    "provider": {
      "@type": "Organization",
      "name": "Molitico",
      "url": "https://molitico.com"
    },
    "areaServed": "United States",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Campaign Services",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Digital Advertising",
            "description": "Precision-targeted Facebook, Instagram, and Google ads for political campaigns"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "SMS & Peer-to-Peer Texting",
            "description": "Text messaging campaigns that drive donations, volunteer signups, and voter turnout"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Email Fundraising",
            "description": "High-ROI email programs for political campaigns and nonprofits"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Billboard & Out-of-Home Advertising",
            "description": "Strategic billboard placements for progressive campaigns nationwide"
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Voter Polling & Research",
            "description": "Specialized polling of Arab American and Muslim American communities"
          }
        }
      ]
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What ROI can I expect from political SMS fundraising?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our SMS campaigns typically deliver 300-500% ROI. We've helped campaigns raise millions through strategic text messaging with average donations of $35-50 per contributor."
        }
      },
      {
        "@type": "Question",
        "name": "How quickly can you launch a digital ad campaign?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We can launch Meta and Google ad campaigns within 48-72 hours. Our rapid deployment process includes creative development, audience targeting, and compliance review."
        }
      },
      {
        "@type": "Question",
        "name": "Do you work with PACs and 501(c)(4) organizations?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, we have extensive experience with PACs, Super PACs, 501(c)(3), and 501(c)(4) organizations. We understand the unique compliance requirements for each entity type."
        }
      },
      {
        "@type": "Question",
        "name": "What makes Molitico different from other political consultants?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We combine deep political organizing experience with cutting-edge digital marketing expertise. Our team includes former campaign staffers who understand progressive values and deliver measurable results."
        }
      }
    ]
  };

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Political Campaign Services: SMS, Email, Digital Ads | Molitico</title>
        <meta name="description" content="Full-service digital fundraising for progressive campaigns. SMS fundraising, Meta/Google advertising, email marketing, and voter polling services." />
        <link rel="canonical" href="https://molitico.com/services" />
        <meta property="og:title" content="Political Campaign Services | Molitico" />
        <meta property="og:description" content="Full-service digital fundraising for progressive campaigns. SMS, digital ads, email marketing, and polling." />
        <meta property="og:url" content="https://molitico.com/services" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(serviceSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
      <ScrollProgressIndicator />
      <Navigation />
      <AnimatedPatternHero
        title="Digital Campaign Services for Progressive Organizations"
        description="From digital ads and billboard placements to voter polling and SMS outreach, we offer the full stack of services for campaigns, PACs, and nonprofits—all optimized for achieving your goals."
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
                    <Megaphone className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-primary-foreground drop-shadow-sm" />
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
                    <MessageSquare className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-primary-foreground drop-shadow-sm" />
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
                    <Mail className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-primary-foreground drop-shadow-sm" />
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

            {/* Service 4 - Billboard Advertising */}
            <div 
              ref={service4.ref}
              className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
                service4.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <div 
                ref={graphic4.ref}
                className={`transition-all duration-1000 delay-300 ${
                  graphic4.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <AnimatedServiceGraphic variant="growth" />
              </div>
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-6 sm:p-7 md:p-8 space-y-6">
                  <div className="w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 bg-gradient-to-br from-primary to-destructive rounded-full flex items-center justify-center shadow-md">
                    <Monitor className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-primary-foreground drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
                    Billboard & Out-of-Home Advertising
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Make a statement where it matters most. From Times Square to local markets, we place billboards across the country for progressive campaigns and nonprofits.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "National placement network from Times Square to local markets",
                      "Strategic location targeting for maximum voter exposure",
                      "Digital and traditional billboard options",
                      "Campaign messaging that drives awareness and action"
                    ].map((item, index) => (
                      <li 
                        key={index} 
                        className={`flex items-start gap-3 transition-all duration-700 ${
                          service4.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
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

            {/* Service 5 - Polling */}
            <div 
              ref={service5.ref}
              className={`grid md:grid-cols-2 gap-12 items-center transition-all duration-1000 ${
                service5.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 order-2 md:order-1 border border-border/50 bg-card backdrop-blur-sm">
                <CardContent className="p-6 sm:p-7 md:p-8 space-y-6">
                  <div className="w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 bg-gradient-to-br from-accent to-primary rounded-full flex items-center justify-center shadow-md">
                    <PieChart className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-primary-foreground drop-shadow-sm" />
                  </div>
                  <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', letterSpacing: '0.02em' }}>
                    Voter Polling & Research
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Deep expertise in Arab American and Muslim American voter polling. We've conducted research nationwide for campaigns and major organizations like CAIR.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Specialized polling of Arab American and Muslim American communities",
                      "Local, state, and national election research",
                      "Partnership with major organizations like CAIR",
                      "Data-driven insights for campaign strategy"
                    ].map((item, index) => (
                      <li 
                        key={index} 
                        className={`flex items-start gap-3 transition-all duration-700 ${
                          service5.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
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
                ref={graphic5.ref}
                className={`order-1 md:order-2 transition-all duration-1000 delay-300 ${
                  graphic5.isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
              >
                <AnimatedServiceGraphic variant="team" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Billboard Gallery Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Our Billboard Placements in Action
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
                From Times Square to nationwide campaigns, we place billboards where they make the biggest impact—including recent placements supporting Zohran Mamdani's mayoral campaign.
              </p>
            </div>
            
            <div 
              ref={billboardGallery.ref}
              className={`grid md:grid-cols-3 gap-6 transition-all duration-1000 ${
                billboardGallery.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              {[
                { src: billboardTimesSquareWide, alt: "Times Square billboard placement", caption: "Times Square" },
                { src: billboardTimesSquareMedium, alt: "Times Square digital billboard", caption: "Times Square Digital" },
                { src: billboardMamdani, alt: "Zohran Mamdani campaign billboard on bus", caption: "Mamdani Campaign" }
              ].map((billboard, index) => (
                <div 
                  key={index}
                  className={`group cursor-pointer transition-all duration-700 ${
                    billboardGallery.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                  onClick={() => setSelectedBillboard(billboard)}
                >
                  <div className="overflow-hidden rounded-lg shadow-lg group-hover:shadow-2xl transition-all duration-700 bg-muted/50 h-96 flex items-center justify-center group-hover:scale-[1.02]">
                    <img 
                      src={billboard.src} 
                      alt={billboard.alt}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                  <p className="text-center mt-3 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {billboard.caption}
                  </p>
                </div>
              ))}
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
                    <service.icon className="h-7 w-7 sm:h-7.5 sm:w-7.5 md:h-8 md:w-8 text-primary-foreground drop-shadow-sm" />
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

      {/* FAQ Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h2 className="font-bebas text-primary leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                Frequently Asked Questions
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Common questions about our political campaign services
              </p>
            </div>

            <div 
              ref={faqSection.ref}
              className={`space-y-6 transition-all duration-1000 ${
                faqSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
            >
              {[
                {
                  question: "What ROI can I expect from political SMS fundraising?",
                  answer: "Our SMS campaigns typically deliver 300-500% ROI. We've helped campaigns raise millions through strategic text messaging with average donations of $35-50 per contributor."
                },
                {
                  question: "How quickly can you launch a digital ad campaign?",
                  answer: "We can launch Meta and Google ad campaigns within 48-72 hours. Our rapid deployment process includes creative development, audience targeting, and compliance review."
                },
                {
                  question: "Do you work with PACs and 501(c)(4) organizations?",
                  answer: "Yes, we have extensive experience with PACs, Super PACs, 501(c)(3), and 501(c)(4) organizations. We understand the unique compliance requirements for each entity type."
                },
                {
                  question: "What makes Molitico different from other political consultants?",
                  answer: "We combine deep political organizing experience with cutting-edge digital marketing expertise. Our team includes former campaign staffers who understand progressive values and deliver measurable results."
                }
              ].map((faq, index) => (
                <Card 
                  key={index}
                  className={`border border-border/50 bg-card backdrop-blur-sm transition-all duration-700 ${
                    faqSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <HelpCircle className="h-6 w-6 text-secondary flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-foreground">{faq.question}</h3>
                        <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-32 bg-gradient-to-br from-secondary via-primary to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8 text-primary-foreground">
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
              className="text-lg font-bold bg-card text-card-foreground hover:bg-card/90"
            >
              Book Your Free Strategy Call
            </ParticleButton>
          </div>
        </div>
      </section>
      <Footer />
      
      {/* Billboard Lightbox Dialog */}
      <Dialog open={!!selectedBillboard} onOpenChange={() => setSelectedBillboard(null)}>
        <DialogContent className="max-w-7xl w-[95vw] h-[90vh] p-0 bg-background/95 backdrop-blur-md">
          <VisuallyHidden>
            <DialogTitle>Billboard Preview</DialogTitle>
          </VisuallyHidden>
          {selectedBillboard && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img 
                src={selectedBillboard.src} 
                alt={selectedBillboard.alt}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;
