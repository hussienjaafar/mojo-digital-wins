import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Heart, Shield, Users, TrendingUp } from "lucide-react";

const About = () => {
  const principles = [
    {
      icon: Heart,
      title: "Progressive Values First",
      description:
        "We only work with campaigns and causes fighting for racial justice, climate action, economic equity, immigrant rights, and human dignity.",
    },
    {
      icon: Shield,
      title: "Ethical Fundraising",
      description:
        "Donor trust is sacred. We build relationships that last beyond Election Day, respecting supporters and their contributions.",
    },
    {
      icon: Users,
      title: "People-Powered Movements",
      description:
        "Real change comes from grassroots organizing. We amplify voices, expand bases, and build coalitions that win.",
    },
    {
      icon: TrendingUp,
      title: "Performance Excellence",
      description:
        "We combine organizing energy with elite marketing rigor—every dollar counts, every strategy is tested, every campaign optimized to win.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-black mb-6">Our Story</h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90">
              From grassroots activists to performance marketing leaders—built to win for progressive causes.
            </p>
          </div>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-lg max-w-none animate-fade-in">
              <h2 className="text-4xl font-black text-foreground mb-6">Why We Exist</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Mojo Digital was born from frustration and urgency. We watched progressive candidates and causes
                get outspent and outmaneuvered by establishment machines with outdated strategies and stale tactics.
                We knew there had to be a better way.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Our founders came from the trenches of grassroots organizing—knocking doors, making calls, and
                mobilizing communities. But they also brought expertise from elite performance marketing, where
                every click, every message, and every dollar is optimized for maximum impact.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                We built Mojo Digital to merge these worlds: the passion and energy of organizing with the
                precision and scale of data-driven marketing. The result? Campaigns that consistently outperform
                the establishment, turning grassroots support into electoral power.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Today, we've helped dozens of progressive candidates and causes raise millions, acquire thousands
                of new donors, and win races that the pundits said were unwinnable. Our average ROI exceeds 300%.
                Our win rate speaks for itself. And we're just getting started.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Progressive Principles */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">Our Principles</h2>
              <p className="text-xl text-muted-foreground">
                These aren't just values on a website—they guide every strategy, every campaign, every decision.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {principles.map((principle, index) => (
                <div
                  key={index}
                  className="bg-background p-8 rounded-lg shadow-sm animate-scale-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <principle.icon className="w-12 h-12 text-secondary mb-4" />
                  <h3 className="text-2xl font-bold text-foreground mb-4">{principle.title}</h3>
                  <p className="text-muted-foreground">{principle.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">Leadership & Experience</h2>
              <p className="text-xl text-muted-foreground">
                Our team brings decades of combined experience from presidential campaigns, Senate races,
                grassroots organizing, and elite digital agencies.
              </p>
            </div>

            <div className="bg-muted p-8 rounded-lg animate-fade-in">
              <h3 className="text-2xl font-bold text-foreground mb-4">Our Expertise Includes:</h3>
              <ul className="space-y-3 text-lg text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-secondary mr-3 font-bold">•</span>
                  <span>
                    Senior digital strategists from presidential and Senate campaigns
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-secondary mr-3 font-bold">•</span>
                  <span>
                    Former organizers who've mobilized thousands in battleground states
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-secondary mr-3 font-bold">•</span>
                  <span>
                    Performance marketers from top agencies managing 8-figure budgets
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-secondary mr-3 font-bold">•</span>
                  <span>
                    Data scientists and analysts who optimize every campaign touchpoint
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="text-secondary mr-3 font-bold">•</span>
                  <span>
                    Veteran fundraisers who've raised millions for progressive causes
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Our Commitment</h2>
            <p className="text-xl text-primary-foreground/90 mb-8 leading-relaxed">
              We only take on campaigns we believe in. Every client is a partner in building a more just,
              equitable, and sustainable future. When you win, we win—and more importantly, our communities win.
            </p>
            <Button variant="cta" size="xl" asChild>
              <Link to="/contact">Partner With Us</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
