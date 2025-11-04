import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { TrendingUp, Users, DollarSign, Target, Shield, MessageSquare, Mail, Monitor } from "lucide-react";

const CaseStudies = () => {
  const [filter, setFilter] = useState("all");

  const studies = [
    {
      category: "issue",
      title: "Unity & Justice Fund",
      roi: "947%",
      avgDonation: "$144.60",
      newDonors: "490",
      timeframe: "2 months",
      challenge:
        "A new progressive PAC needed to rapidly build a donor base and establish credibility in the movement.",
      strategy:
        "Multi-channel approach combining SMS blasts to activist networks, targeted Meta ads to progressive audiences, and email sequences to engaged supporters. Focused on storytelling around specific policy wins.",
      results:
        "Achieved 947% ROI with an average donation of $144.60, bringing in 490 new recurring donors. Established the PAC as a serious player in progressive fundraising.",
      ethicalApproach:
        "By respecting donor preferences and segmenting our messaging, we achieved an impressive 89% donor retention rate. We never used deceptive urgency or misleading tactics—just authentic storytelling about policy impact.",
      creativeType: "SMS",
      creativeExample: "/src/assets/sms-mockup.jpg",
    },
    {
      category: "state",
      title: "Rashid for Illinois",
      roi: "415%",
      avgDonation: "$0",
      newDonors: "875",
      timeframe: "2 weeks",
      challenge:
        "A first-time candidate running in a competitive primary needed to quickly expand donor base to demonstrate viability.",
      strategy:
        "Aggressive SMS campaign targeting progressive voters in the district, combined with precision Facebook targeting. Emphasized grassroots momentum and underdog narrative.",
      results:
        "Generated 415% ROI and acquired 875 new donors in just 2 weeks, giving the campaign the momentum needed to compete.",
      ethicalApproach:
        "Despite the aggressive timeline, we maintained clear opt-out language and respected all unsubscribe requests immediately. This built trust that translated into higher conversion rates.",
      creativeType: "Display Ad",
      creativeExample: null,
    },
    {
      category: "state",
      title: "Nasser for Michigan",
      roi: "325%",
      avgDonation: "$129.56",
      newDonors: "0",
      timeframe: "3 months",
      challenge:
        "A State House candidate in a swing district needed to maximize fundraising efficiency to compete with establishment-backed opponent.",
      strategy:
        "High-value donor acquisition through optimized Meta ads and sophisticated email nurture sequences. Focused on ROI over volume.",
      results:
        "Achieved 325% ROI with high average donation of $129.56, allowing the campaign to compete in expensive media markets.",
      ethicalApproach:
        "We prioritized quality over quantity, ensuring every donor received personalized follow-up and transparent impact reports. This ethical approach resulted in 67% of donors giving multiple times.",
      creativeType: "Email",
      creativeExample: null,
    },
    {
      category: "state",
      title: "Preston for PA",
      roi: "236%",
      avgDonation: "$29.11",
      newDonors: "2349",
      timeframe: "4 months",
      challenge:
        "A progressive challenger needed to build a small-dollar donor base to show grassroots support against an establishment incumbent.",
      strategy:
        "Volume-focused SMS and email strategy combined with low-cost Meta acquisition campaigns. Emphasized accessible $20-30 donation asks.",
      results:
        "236% ROI while acquiring 2,349 new donors with an accessible average donation of $29.11, demonstrating broad grassroots support.",
      ethicalApproach:
        "We paced our outreach carefully to avoid donor fatigue, spacing messages appropriately and varying content. Lower volume but higher trust led to sustainable long-term support.",
      creativeType: "SMS",
      creativeExample: null,
    },
    {
      category: "federal",
      title: "Abdul for U.S. Senate",
      roi: "257%",
      avgDonation: "$55.98",
      newDonors: "0",
      timeframe: "6 months",
      challenge:
        "A Senate campaign in a red-leaning state needed to prove it could compete financially with national resources.",
      strategy:
        "Integrated digital strategy combining national progressive networks via email, local SMS targeting, and statewide Meta campaigns. Built coalition across demographics.",
      results:
        "257% ROI with $55.98 average donation, raising enough to stay competitive in expensive statewide race.",
      ethicalApproach:
        "Every message was vetted for accuracy and FEC compliance. We built credibility by being truthful about the competitive landscape, which resonated with informed voters.",
      creativeType: "Display Ad",
      creativeExample: null,
    },
    {
      category: "nonprofit",
      title: "Arab-American Nonprofit",
      roi: "304%",
      avgDonation: "$0",
      newDonors: "5909",
      timeframe: "5 months",
      challenge:
        "A community organization needed to dramatically expand its donor base to fund advocacy and direct services.",
      strategy:
        "Community-focused SMS and email campaigns emphasizing impact stories, combined with lookalike audience targeting on Meta. Culturally tailored messaging.",
      results:
        "304% ROI while acquiring 5,909 new donors, providing sustainable funding for ongoing programs.",
      ethicalApproach:
        "Culturally sensitive messaging and transparent use of funds built deep community trust. We ensured all content was authentic and represented the community accurately.",
      creativeType: "Email",
      creativeExample: null,
    },
    {
      category: "issue",
      title: "A New Policy 501(c)(4)",
      roi: "289%",
      avgDonation: "$0",
      newDonors: "502",
      timeframe: "1 month",
      challenge:
        "A new advocacy organization needed to quickly build a membership base ahead of a key legislative push.",
      strategy:
        "Rapid SMS and email recruitment campaigns targeting policy-engaged progressives. Emphasized urgency around pending legislation.",
      results:
        "289% ROI and 502 new monthly donors in just 30 days, creating sustainable funding for ongoing advocacy.",
      ethicalApproach:
        "While urgency was real due to legislative deadlines, we never manufactured false emergencies. Honest, factual advocacy built credibility and long-term donor relationships.",
      creativeType: "SMS",
      creativeExample: null,
    },
  ];

  const filteredStudies = filter === "all" ? studies : studies.filter((study) => study.category === filter);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent overflow-hidden diagonal-bottom">
        <div className="texture-overlay"></div>
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="text-display text-white mb-6 leading-tight animate-fade-in energy-glow">Proven Wins</h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto font-light animate-fade-in">
            Real campaigns. Real results. Real impact for progressive causes.
          </p>
        </div>
      </section>

      {/* Filter Section */}
      <section className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b border-border py-6 brutal-shadow">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {["all", "congressional", "senate", "statewide", "issue"].map((category) => (
              <Button
                key={category}
                onClick={() => setFilter(category)}
                variant={filter === category ? "brutal" : "outline"}
                className="capitalize"
              >
                {category === "all" ? "All Campaigns" : category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-20">
        <div className="container mx-auto px-4 space-y-16">
          {filteredStudies.map((study, index) => (
            <Card key={index} className="overflow-hidden hover-lift brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="grid md:grid-cols-5 gap-6 p-6">
                {/* Left: Metrics */}
                <div className="md:col-span-2 space-y-6">
                  <div>
                    <Badge className="mb-4" variant="outline">
                      {study.category}
                    </Badge>
                    <h2 className="text-3xl font-black text-foreground mb-2">{study.title}</h2>
                    <p className="text-muted-foreground">{study.timeframe}</p>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 brutal-shadow hover:energy-glow transition-all duration-300">
                      <TrendingUp className="w-6 h-6 text-primary mb-2 energy-glow" />
                      <div className="text-2xl font-bold text-foreground">{study.roi}</div>
                      <div className="text-sm text-muted-foreground">ROI</div>
                    </div>
                    <div className="bg-accent/5 p-4 rounded-lg border border-accent/20 brutal-shadow hover:energy-glow transition-all duration-300">
                      <DollarSign className="w-6 h-6 text-accent mb-2 energy-glow" />
                      <div className="text-2xl font-bold text-foreground">{study.avgDonation}</div>
                      <div className="text-sm text-muted-foreground">Avg Donation</div>
                    </div>
                    <div className="bg-secondary/5 p-4 rounded-lg border border-secondary/20 col-span-2 brutal-shadow hover:energy-glow transition-all duration-300">
                      <Users className="w-6 h-6 text-secondary mb-2 energy-glow" />
                      <div className="text-2xl font-bold text-foreground">{study.newDonors}</div>
                      <div className="text-sm text-muted-foreground">New Donors</div>
                    </div>
                  </div>
                </div>

                {/* Right: Details */}
                <div className="md:col-span-3 space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary energy-glow" />
                      The Challenge
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">{study.challenge}</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Our Strategy</h3>
                    <p className="text-muted-foreground leading-relaxed">{study.strategy}</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">The Results</h3>
                    <p className="text-muted-foreground leading-relaxed">{study.results}</p>
                  </div>

                  <div className="border-t border-border pt-6">
                    <div className="flex items-start gap-3 mb-3">
                      <Shield className="w-5 h-5 text-secondary mt-1 energy-glow" />
                      <h3 className="text-xl font-bold text-foreground">Ethical Approach</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">{study.ethicalApproach}</p>
                  </div>

                  {study.creativeExample && (
                    <div className="border-t border-border pt-6">
                      <div className="flex items-start gap-3 mb-3">
                        {study.creativeType === "SMS" && <MessageSquare className="w-5 h-5 text-accent mt-1 energy-glow" />}
                        {study.creativeType === "Email" && <Mail className="w-5 h-5 text-accent mt-1 energy-glow" />}
                        {study.creativeType === "Display Ad" && <Monitor className="w-5 h-5 text-accent mt-1 energy-glow" />}
                        <h3 className="text-xl font-bold text-foreground">Creative Used</h3>
                      </div>
                      <div className="bg-muted rounded-lg p-4 brutal-shadow">
                        <img
                          src={study.creativeExample}
                          alt={`${study.title} - ${study.creativeType} creative example`}
                          className="w-full rounded-lg"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-secondary to-accent text-white diagonal-both relative overflow-hidden">
        <div className="texture-overlay"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-display mb-6 animate-fade-in energy-glow">Ready to Write Your Success Story?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90 animate-fade-in">
            Let's build a campaign that delivers results and stays true to progressive values
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
            <Link to="/contact">
              <Button size="lg" variant="brutal">
                Start Your Campaign
              </Button>
            </Link>
            <Link to="/creative-showcase">
              <Button size="lg" variant="movement">
                View Our Creative Work
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CaseStudies;
