import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Heart, Shield, Users, TrendingUp, Target, Zap, CheckCircle2, Sparkles } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent overflow-hidden diagonal-bottom">
        <div className="texture-overlay"></div>
        <div className="container relative z-10 mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-display text-white mb-4 md:mb-6 leading-tight animate-fade-in energy-glow">
            Our Story
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto font-light animate-fade-in px-4">
            Where grassroots organizing meets performance marketing
          </p>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-12 md:py-20 bg-background relative">
        <div className="texture-overlay opacity-30"></div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-headline text-foreground mb-8 animate-fade-in">
              Why We Exist
            </h2>
            
            <div className="space-y-6 text-lg text-muted-foreground leading-relaxed animate-fade-in">
              <p>
                Mojo Digital was born from frustration and urgency. We watched progressive candidates and causes
                get outspent and outmaneuvered by establishment machines with outdated strategies and stale tactics.
                We knew there had to be a better way.
              </p>
              <p>
                Our founders came from the trenches of grassroots organizing—knocking doors, making calls, and
                mobilizing communities. But they also brought expertise from elite performance marketing, where
                every click, every message, and every dollar is optimized for maximum impact.
              </p>
              <p>
                We built Mojo Digital to merge these worlds: the passion and energy of organizing with the
                precision and scale of data-driven marketing. The result? Campaigns that consistently outperform
                the establishment, turning grassroots support into electoral power.
              </p>
              <p className="font-semibold text-foreground">
                Today, we've helped dozens of progressive candidates and causes raise millions, acquire thousands
                of new donors, and win races that the pundits said were unwinnable. Our average ROI exceeds 300%.
                Our win rate speaks for itself. And we're just getting started.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Progressive Principles */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-muted/30 to-background diagonal-both relative">
        <div className="texture-overlay"></div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
            <h2 className="text-headline text-foreground mb-4">
              Our Core Principles
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              The values that guide every campaign we run
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: Heart,
                title: "Progressive Values First",
                desc: "We only work with candidates and causes aligned with our values. No exceptions.",
              },
              {
                icon: Users,
                title: "Grassroots Power",
                desc: "Small-dollar donors can compete with billionaires when mobilized effectively.",
              },
              {
                icon: Shield,
                title: "Ethical Fundraising",
                desc: "Honest messaging, transparent practices, and respect for every supporter.",
              },
            ].map((principle, index) => (
              <Card key={index} className="text-center hover-lift brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <CardHeader>
                  <div className="bg-primary/10 text-primary p-4 rounded-full w-fit mx-auto mb-4 energy-glow">
                    <principle.icon className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-xl font-bold">{principle.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{principle.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership & Experience */}
      <section className="py-12 md:py-20 bg-background diagonal-top relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-headline text-foreground mb-8 text-center animate-fade-in">
              Built by Campaign Veterans
            </h2>

            <Card className="mb-12 brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-4">Our Team's Background</h3>
                    <ul className="space-y-3 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Target className="w-5 h-5 text-primary mt-1 flex-shrink-0 energy-glow" />
                        <span>10+ years in progressive political campaigns</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Zap className="w-5 h-5 text-primary mt-1 flex-shrink-0 energy-glow" />
                        <span>Alumni of top-tier Presidential and Senate races</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <TrendingUp className="w-5 h-5 text-primary mt-1 flex-shrink-0 energy-glow" />
                        <span>Managed $50M+ in digital ad spend</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className="w-5 h-5 text-primary mt-1 flex-shrink-0 energy-glow" />
                        <span>Mobilized millions of grassroots supporters</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-4">What Sets Us Apart</h3>
                    <p className="text-muted-foreground mb-4">
                      We've been on the ground during crunch time. We understand the pressure of quarterly FEC deadlines, the
                      chaos of rapid response, and the stakes of every dollar raised.
                    </p>
                    <p className="text-muted-foreground">
                      That frontline experience shapes everything we do—from creative strategy to compliance protocols.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Ethical Commitments */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-accent/5 via-background to-primary/5 diagonal-both relative">
        <div className="texture-overlay"></div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-12 md:mb-16 animate-fade-in px-4">
            <h2 className="text-display text-foreground mb-4">
              Our Commitments to You
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Non-negotiable standards for every campaign
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {[
              {
                icon: CheckCircle2,
                title: "No Misleading Tactics",
                desc: "Clear, honest messaging. We never pretend to be someone we're not or use deceptive subject lines.",
              },
              {
                icon: Shield,
                title: "FEC Compliance Guarantee",
                desc: "Every campaign is structured to meet federal regulations. Built-in compliance checks at every stage.",
              },
              {
                icon: Heart,
                title: "Donor Privacy Protected",
                desc: "Your supporter data is sacred. We never share, sell, or misuse contact information.",
              },
              {
                icon: TrendingUp,
                title: "Transparent Reporting",
                desc: "Real-time dashboards showing exactly where money goes and what results you're getting.",
              },
            ].map((commitment, index) => (
              <Card key={index} className="hover-lift brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="bg-accent/10 text-accent p-3 rounded-lg flex-shrink-0 energy-glow">
                      <commitment.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg mb-2 font-bold">{commitment.title}</CardTitle>
                      <p className="text-muted-foreground text-sm">{commitment.desc}</p>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 brutal-shadow energy-glow animate-fade-in">
            <CardContent className="p-8 text-center">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4 energy-glow" />
              <h3 className="text-2xl font-bold text-foreground mb-3">Performance AND Principles</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                We prove every day that you don't have to sacrifice ethics for results. The best campaigns are built on trust,
                transparency, and authentic connection with supporters.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-primary via-secondary to-accent text-white diagonal-both relative overflow-hidden">
        <div className="texture-overlay"></div>
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <h2 className="text-display mb-4 md:mb-6 animate-fade-in energy-glow px-4">Let's Win Together</h2>
          <p className="text-lg md:text-xl mb-6 md:mb-8 max-w-2xl mx-auto opacity-90 animate-fade-in px-4">
            Ready to partner with a team that shares your values and delivers results?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
            <Link to="/contact">
              <Button size="lg" variant="brutal">
                Start a Conversation
              </Button>
            </Link>
            <Link to="/services">
              <Button size="lg" variant="movement">
                Explore Our Services
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
