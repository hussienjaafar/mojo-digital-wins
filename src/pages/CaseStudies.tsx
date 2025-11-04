import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { TrendingUp, Users, DollarSign, Target } from "lucide-react";

const CaseStudies = () => {
  const [filter, setFilter] = useState("All");

  const categories = ["All", "Federal", "State", "Local", "PAC", "Nonprofit"];

  const studies = [
    {
      category: "PAC",
      name: "Unity & Justice Fund",
      roi: 947,
      avgDonation: 144.60,
      newDonors: 490,
      timeframe: "2 months",
      challenge:
        "A new progressive PAC needed to rapidly build a donor base and establish credibility in the movement.",
      strategy:
        "Multi-channel approach combining SMS blasts to activist networks, targeted Meta ads to progressive audiences, and email sequences to engaged supporters. Focused on storytelling around specific policy wins.",
      results:
        "Achieved 947% ROI with an average donation of $144.60, bringing in 490 new recurring donors. Established the PAC as a serious player in progressive fundraising.",
    },
    {
      category: "State",
      name: "Rashid for Illinois",
      roi: 415,
      avgDonation: 0,
      newDonors: 875,
      timeframe: "2 weeks",
      challenge:
        "A first-time candidate running in a competitive primary needed to quickly expand donor base to demonstrate viability.",
      strategy:
        "Aggressive SMS campaign targeting progressive voters in the district, combined with precision Facebook targeting. Emphasized grassroots momentum and underdog narrative.",
      results:
        "Generated 415% ROI and acquired 875 new donors in just 2 weeks, giving the campaign the momentum needed to compete.",
    },
    {
      category: "State",
      name: "Nasser for Michigan",
      roi: 325,
      avgDonation: 129.56,
      newDonors: 0,
      timeframe: "3 months",
      challenge:
        "A State House candidate in a swing district needed to maximize fundraising efficiency to compete with establishment-backed opponent.",
      strategy:
        "High-value donor acquisition through optimized Meta ads and sophisticated email nurture sequences. Focused on ROI over volume.",
      results:
        "Achieved 325% ROI with high average donation of $129.56, allowing the campaign to compete in expensive media markets.",
    },
    {
      category: "State",
      name: "Preston for PA",
      roi: 236,
      avgDonation: 29.11,
      newDonors: 2349,
      timeframe: "4 months",
      challenge:
        "A progressive challenger needed to build a small-dollar donor base to show grassroots support against an establishment incumbent.",
      strategy:
        "Volume-focused SMS and email strategy combined with low-cost Meta acquisition campaigns. Emphasized accessible $20-30 donation asks.",
      results:
        "236% ROI while acquiring 2,349 new donors with an accessible average donation of $29.11, demonstrating broad grassroots support.",
    },
    {
      category: "Federal",
      name: "Abdul for U.S. Senate",
      roi: 257,
      avgDonation: 55.98,
      newDonors: 0,
      timeframe: "6 months",
      challenge:
        "A Senate campaign in a red-leaning state needed to prove it could compete financially with national resources.",
      strategy:
        "Integrated digital strategy combining national progressive networks via email, local SMS targeting, and statewide Meta campaigns. Built coalition across demographics.",
      results:
        "257% ROI with $55.98 average donation, raising enough to stay competitive in expensive statewide race.",
    },
    {
      category: "Nonprofit",
      name: "Arab-American Nonprofit",
      roi: 304,
      avgDonation: 0,
      newDonors: 5909,
      timeframe: "5 months",
      challenge:
        "A community organization needed to dramatically expand its donor base to fund advocacy and direct services.",
      strategy:
        "Community-focused SMS and email campaigns emphasizing impact stories, combined with lookalike audience targeting on Meta. Culturally tailored messaging.",
      results:
        "304% ROI while acquiring 5,909 new donors, providing sustainable funding for ongoing programs.",
    },
    {
      category: "PAC",
      name: "A New Policy 501(c)(4)",
      roi: 289,
      avgDonation: 0,
      newDonors: 502,
      timeframe: "1 month",
      challenge:
        "A new advocacy organization needed to quickly build a membership base ahead of a key legislative push.",
      strategy:
        "Rapid SMS and email recruitment campaigns targeting policy-engaged progressives. Emphasized urgency around pending legislation.",
      results:
        "289% ROI and 502 new monthly donors in just 30 days, creating sustainable funding for ongoing advocacy.",
    },
  ];

  const filteredStudies = filter === "All" ? studies : studies.filter((study) => study.category === filter);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-black mb-6">Real Campaigns. Real Results.</h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90">
              Our track record speaks for itself—consistent performance that wins elections and grows movements.
            </p>
          </div>
        </div>
      </section>

      {/* Filter */}
      <section className="py-8 bg-muted sticky top-20 z-40 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map((category) => (
              <Button
                key={category}
                variant={filter === category ? "secondary" : "outline"}
                size="default"
                onClick={() => setFilter(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="space-y-16">
            {filteredStudies.map((study, index) => (
              <Card key={index} className="overflow-hidden animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-2">
                    {/* Metrics */}
                    <div className="bg-gradient-to-br from-secondary to-primary text-primary-foreground p-8 md:p-12">
                      <div className="inline-block bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-semibold mb-4">
                        {study.category}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black mb-8">{study.name}</h2>

                      <div className="space-y-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-primary-foreground/20 p-3 rounded-lg">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="text-4xl font-black">{study.roi}%</div>
                            <div className="text-primary-foreground/80 text-sm">Return on Investment</div>
                          </div>
                        </div>

                        {study.avgDonation > 0 && (
                          <div className="flex items-start gap-4">
                            <div className="bg-primary-foreground/20 p-3 rounded-lg">
                              <DollarSign className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="text-3xl font-bold">${study.avgDonation}</div>
                              <div className="text-primary-foreground/80 text-sm">Average Donation</div>
                            </div>
                          </div>
                        )}

                        {study.newDonors > 0 && (
                          <div className="flex items-start gap-4">
                            <div className="bg-primary-foreground/20 p-3 rounded-lg">
                              <Users className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="text-3xl font-bold">+{study.newDonors.toLocaleString()}</div>
                              <div className="text-primary-foreground/80 text-sm">New Donors</div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          <div className="bg-primary-foreground/20 p-3 rounded-lg">
                            <Target className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="text-2xl font-bold">{study.timeframe}</div>
                            <div className="text-primary-foreground/80 text-sm">Campaign Duration</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-8 md:p-12 bg-background">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-xl font-bold text-foreground mb-3">The Challenge</h3>
                          <p className="text-muted-foreground leading-relaxed">{study.challenge}</p>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-foreground mb-3">Our Strategy</h3>
                          <p className="text-muted-foreground leading-relaxed">{study.strategy}</p>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-foreground mb-3">The Results</h3>
                          <p className="text-muted-foreground leading-relaxed">{study.results}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredStudies.length === 0 && (
            <div className="text-center py-20">
              <p className="text-xl text-muted-foreground">No case studies found for this category.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6 animate-fade-in">
            Ready to Join Our Success Stories?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto animate-fade-in">
            Let's create your winning campaign strategy. Book a call to discuss your goals and how we can help.
          </p>
          <Button variant="cta" size="xl" asChild className="animate-pulse-subtle">
            <Link to="/contact">Book Strategy Call</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CaseStudies;
