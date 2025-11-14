import { useState } from "react";
import { Helmet } from "react-helmet";
import { Card, CardContent } from "@/components/ui/card";
import { ParticleButton } from "@/components/ParticleButton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedPatternHero from "@/components/AnimatedPatternHero";
import { caseStudies } from "@/data/caseStudies";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";

const CaseStudies = () => {
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Senate", "Congressional", "Local", "PACs", "501C(3)", "501C(4)"];

  const filteredCaseStudies = activeFilter === "All" 
    ? caseStudies 
    : caseStudies.filter(study => study.category === activeFilter);

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
        "name": "Case Studies",
        "item": "https://molitico.com/case-studies"
      }
    ]
  };

  return (
    <div className="min-h-screen">
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>
      <ScrollProgressIndicator />
      <Navigation />
      <AnimatedPatternHero
        title="Progressive Wins"
        description="Real results from real organizations. See how we've helped progressive campaigns, PACs, and causes break through, raise millions, and win."
      />

      {/* Filter Bar */}
      <section className="py-8 bg-background border-b border-border sticky top-[72px] md:top-[80px] z-40 backdrop-blur-lg">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {filters.map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? "default" : "outline"}
                onClick={() => setActiveFilter(filter)}
                className="transition-all duration-300"
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies Grid */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {filteredCaseStudies.map((study) => (
              <Link key={study.id} to={`/case-studies/${study.id}`} className="block">
                <Card className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm overflow-hidden h-full">
                {study.image && (
                  <div className="aspect-video w-full overflow-hidden">
                    <img 
                      src={study.image} 
                      alt={`${study.title} campaign visual`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-accent">{study.category}</div>
                    <h3 className="font-bebas text-foreground leading-tight" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '0.02em' }}>
                      {study.title}
                    </h3>
                    <div className="text-3xl font-bold text-secondary">{study.stat}</div>
                  </div>
                  
                  <p className="text-foreground/80 leading-relaxed">{study.description}</p>
                  
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                    {study.metrics.map((metric, idx) => (
                      <div key={idx} className="text-center space-y-1">
                        <metric.icon className="h-5 w-5 mx-auto text-accent drop-shadow-sm" />
                        <div className="text-sm font-bold text-foreground">{metric.value}</div>
                        <div className="text-xs text-muted-foreground">{metric.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-destructive via-secondary to-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8 text-primary-foreground">
            <h2 className="font-bebas leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
              Ready to Be Our Next Success Story?
            </h2>
            <p className="text-lg md:text-xl leading-relaxed">Let's build a winning strategy together.</p>
            <ParticleButton
              href="https://calendly.com/molitico/30min"
              size="xl"
              particleColor="hsl(var(--accent))"
              particleCount={25}
              className="text-lg font-bold bg-card text-card-foreground hover:bg-card/90"
            >
              Book Your Strategy Call
            </ParticleButton>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CaseStudies;
