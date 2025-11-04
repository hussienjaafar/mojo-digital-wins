import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, DollarSign, Target } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/sms-mockup.jpg";

const CaseStudies = () => {
  const [activeFilter, setActiveFilter] = useState("All");

  const caseStudies = [
    {
      title: "Rashid for Congress",
      category: "Federal",
      stat: "415% ROI",
      description: "Scaled a grassroots campaign from 5K donors to 180K+ through targeted digital acquisition and conversion-optimized email program.",
      metrics: [
        { icon: DollarSign, label: "$2.3M Raised", value: "2.3M" },
        { icon: Users, label: "180K Donors", value: "180K" },
        { icon: TrendingUp, label: "415% ROI", value: "415%" },
      ],
    },
    {
      title: "State Senate District 14",
      category: "State",
      stat: "87% Open Rate",
      description: "Built and executed an SMS-first strategy that mobilized volunteers and drove day-of turnout in a competitive swing district.",
      metrics: [
        { icon: Target, label: "87% Open Rate", value: "87%" },
        { icon: Users, label: "12K Volunteers", value: "12K" },
        { icon: TrendingUp, label: "14pt Margin", value: "+14pts" },
      ],
    },
    {
      title: "Ballot Initiative - Prop 22",
      category: "Issue Campaign",
      stat: "$4.2M Raised",
      description: "Led digital strategy for progressive ballot measure, building coalition support and driving small-dollar fundraising at scale.",
      metrics: [
        { icon: DollarSign, label: "$4.2M Raised", value: "4.2M" },
        { icon: Users, label: "320K Supporters", value: "320K" },
        { icon: TrendingUp, label: "62% Yes Vote", value: "62%" },
      ],
    },
    {
      title: "City Council At-Large",
      category: "Local",
      stat: "2,400% Audience Growth",
      description: "Helped first-time candidate break through with compelling social content and targeted digital advertising.",
      metrics: [
        { icon: Target, label: "2.4M Impressions", value: "2.4M" },
        { icon: Users, label: "24x Audience", value: "2400%" },
        { icon: TrendingUp, label: "Won by 8pts", value: "+8pts" },
      ],
    },
    {
      title: "Progressive PAC - 2024 Cycle",
      category: "Organization",
      stat: "$12M+ Raised",
      description: "Full-stack digital program across email, SMS, and paid media supporting 40+ progressive candidates nationwide.",
      metrics: [
        { icon: DollarSign, label: "$12M+ Raised", value: "12M" },
        { icon: Target, label: "40+ Campaigns", value: "40+" },
        { icon: TrendingUp, label: "78% Win Rate", value: "78%" },
      ],
    },
    {
      title: "County Commissioner Race",
      category: "Local",
      stat: "340% Email Revenue Growth",
      description: "Transformed underperforming email program with message testing, segmentation, and conversion optimization.",
      metrics: [
        { icon: DollarSign, label: "$480K Raised", value: "480K" },
        { icon: TrendingUp, label: "340% Growth", value: "340%" },
        { icon: Users, label: "35K Supporters", value: "35K" },
      ],
    },
  ];

  const filters = ["All", "Federal", "State", "Local", "Issue Campaign", "Organization"];

  const filteredCaseStudies = activeFilter === "All" 
    ? caseStudies 
    : caseStudies.filter(study => study.category === activeFilter);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-28 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }} />
        <div className="absolute inset-0 bg-primary/75" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-[680px] space-y-6">
            <h1 className="font-bebas text-primary-foreground leading-[0.95]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', letterSpacing: '0.02em' }}>
              Campaigns That Won
            </h1>
            <p className="text-primary-foreground/90 leading-relaxed" style={{ fontSize: 'clamp(1.125rem, 2vw, 1.25rem)' }}>
              Real results from real campaigns. See how we've helped progressive candidates and causes break through, raise millions, and win.
            </p>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="py-8 bg-background border-b border-border sticky top-16 z-40 backdrop-blur-lg">
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
            {filteredCaseStudies.map((study, index) => (
              <Card key={index} className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
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
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-destructive via-secondary to-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8 text-white">
            <h2 className="font-bebas leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
              Ready to Be Our Next Success Story?
            </h2>
            <p className="text-lg md:text-xl leading-relaxed">Let's build a winning campaign together.</p>
            <Link to="/contact">
              <Button size="lg" variant="secondary" className="text-lg px-8 shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-300">
                Start Your Campaign
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CaseStudies;
