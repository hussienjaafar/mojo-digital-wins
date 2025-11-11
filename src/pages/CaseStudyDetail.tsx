import { useParams, Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { caseStudies } from "@/data/caseStudies";
import { ArrowLeft, Clock, CheckCircle2, Quote } from "lucide-react";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";

const CaseStudyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const caseStudy = caseStudies.find(study => study.id === id);

  // Get related case studies from the same category
  const relatedCaseStudies = caseStudy 
    ? caseStudies.filter(
        study => study.category === caseStudy.category && study.id !== caseStudy.id
      ).slice(0, 3) // Show up to 3 related case studies
    : [];

  if (!caseStudy) {
    return <Navigate to="/case-studies" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgressIndicator />
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-28 md:pt-32 pb-16 md:pb-20 overflow-hidden">
        {caseStudy.image ? (
          <>
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${caseStudy.image})` }} />
            <div className="absolute inset-0 bg-primary/75" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary" />
        )}
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <Link to="/case-studies">
              <Button variant="outline" className="mb-6 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Case Studies
              </Button>
            </Link>
            
            <div className="inline-block bg-accent/20 text-accent px-4 py-2 rounded-lg text-sm font-semibold uppercase tracking-wider mb-4 border border-accent/30">
              {caseStudy.category}
            </div>
            
            <h1 className="font-bebas text-primary-foreground leading-[0.95] mb-6" style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', letterSpacing: '0.02em' }}>
              {caseStudy.title}
            </h1>

            {/* Prominent ROI Display */}
            <div className="bg-primary-foreground/10 border-2 border-primary-foreground/30 rounded-xl p-8 mb-8 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-sm font-semibold text-primary-foreground/80 uppercase tracking-wider mb-3">Campaign Results</div>
                <div className="font-bebas text-primary-foreground leading-none mb-2" style={{ fontSize: 'clamp(3rem, 10vw, 6rem)' }}>
                  {caseStudy.stat}
                </div>
                {caseStudy.timeline && (
                  <div className="flex items-center justify-center gap-2 text-primary-foreground/80">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">{caseStudy.timeline}</span>
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-xl md:text-2xl text-primary-foreground/90 leading-relaxed">
              {caseStudy.description}
            </p>
          </div>
        </div>
      </section>

      {/* Key Metrics */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-bebas text-3xl md:text-4xl text-foreground mb-2 text-center uppercase tracking-wide">
              By the Numbers
            </h2>
            <p className="text-muted-foreground text-center mb-10 text-lg">
              Measurable impact that drives real results
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {caseStudy.metrics.map((metric, idx) => (
                <Card key={idx} className="bg-gradient-to-br from-card to-card/50 border-2 border-secondary/20 hover:border-secondary transition-all duration-300 hover:shadow-xl">
                  <CardContent className="p-6 text-center space-y-3">
                    <metric.icon className="h-10 w-10 mx-auto text-secondary" />
                    <div className="font-bebas text-5xl text-foreground leading-none">{metric.value}</div>
                    <div className="text-sm text-muted-foreground font-semibold uppercase tracking-wide">{metric.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Results Section - Moved up */}
      {caseStudy.results && caseStudy.results.length > 0 && (
        <section className="py-16 md:py-20 bg-gradient-to-br from-muted via-background to-muted">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-bebas text-3xl md:text-4xl text-foreground mb-8 uppercase tracking-wide">
                Detailed Results
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {caseStudy.results.map((result, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-card border-l-4 border-secondary p-5 rounded-lg hover:shadow-md transition-shadow duration-300">
                    <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                    <p className="text-foreground/90 font-medium">{result}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Video Section */}
      {caseStudy.video && (
        <section className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <h2 className="font-bebas text-3xl md:text-4xl text-foreground mb-8 text-center uppercase tracking-wide">
                See It In Action
              </h2>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={caseStudy.video}
                  className="absolute top-0 left-0 w-full h-full rounded-lg shadow-2xl"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={`${caseStudy.title} Video`}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Challenge Section */}
      {caseStudy.challenge && (
        <section className="py-16 md:py-20 bg-gradient-to-br from-muted via-background to-muted">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-bebas text-3xl md:text-4xl text-foreground mb-6 uppercase tracking-wide">
                The Challenge
              </h2>
              <p className="text-lg text-foreground/80 leading-relaxed">
                {caseStudy.challenge}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Solution Section */}
      {caseStudy.solution && (
        <section className="py-16 md:py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-bebas text-3xl md:text-4xl text-foreground mb-6 uppercase tracking-wide">
                Our Solution
              </h2>
              <p className="text-lg text-foreground/80 leading-relaxed">
                {caseStudy.solution}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Testimonial Section */}
      {caseStudy.testimonial && (
        <section className="py-16 md:py-20 bg-gradient-to-br from-primary via-secondary to-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <Quote className="w-12 h-12 mx-auto mb-6 text-accent" />
              <blockquote className="text-xl md:text-2xl leading-relaxed mb-8 italic">
                "{caseStudy.testimonial.quote}"
              </blockquote>
              <div className="border-t border-primary-foreground/20 pt-6">
                <p className="font-bold text-lg">{caseStudy.testimonial.author}</p>
                <p className="text-primary-foreground/80">{caseStudy.testimonial.role}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Related Case Studies Section */}
      {relatedCaseStudies.length > 0 && (
        <section className="py-16 md:py-20 bg-gradient-to-br from-muted via-background to-muted">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="font-bebas text-3xl md:text-4xl text-foreground mb-4 uppercase tracking-wide text-center">
                Related Case Studies
              </h2>
              <p className="text-muted-foreground text-center mb-12 text-lg">
                More {caseStudy.category} campaigns with proven results
              </p>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedCaseStudies.map((study) => (
                  <Link 
                    key={study.id} 
                    to={`/case-studies/${study.id}`}
                    className="group"
                  >
                    <Card className="h-full bg-card border-2 border-secondary/20 hover:border-secondary transition-all duration-300 hover:shadow-xl overflow-hidden">
                      {study.image && (
                        <div className="relative h-48 overflow-hidden">
                          <img 
                            src={study.image} 
                            alt={`${study.title} campaign visual`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" aria-hidden="true" />
                        </div>
                      )}
                      <CardContent className="p-6 space-y-4">
                        <div className="inline-block bg-accent/20 text-accent px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider border border-accent/30">
                          {study.category}
                        </div>
                        <h3 className="font-bebas text-2xl text-foreground uppercase tracking-wide group-hover:text-secondary transition-colors">
                          {study.title}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {study.description}
                        </p>
                        <div className="pt-4 border-t border-border">
                          <div className="text-3xl font-bebas text-secondary">{study.stat}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="font-bebas text-4xl md:text-5xl text-foreground uppercase tracking-wide">
              Ready for Results Like These?
            </h2>
            <p className="text-xl text-muted-foreground">
              Let's build your winning campaign strategy together.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="text-lg">
                <Link to="/contact">Start Your Campaign</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg">
                <Link to="/case-studies">View More Case Studies</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CaseStudyDetail;
