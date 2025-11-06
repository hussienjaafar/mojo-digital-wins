import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, DollarSign, Target } from "lucide-react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import heroImage from "@/assets/sms-mockup.jpg";
import unityJusticeImage from "@/assets/unity-justice-fund.png";

const CaseStudies = () => {
  const [activeFilter, setActiveFilter] = useState("All");

  const caseStudies = [
    {
      title: "Unity & Justice Fund",
      category: "PACs",
      stat: "947% ROI",
      description: "Generated $45K in 48 hours with high-urgency fundraising message and personal storytelling. Achieved exceptional ROI through targeted SMS campaigns.",
      metrics: [
        { icon: TrendingUp, label: "947% ROI", value: "947%" },
        { icon: Users, label: "490 New Donors", value: "490" },
        { icon: DollarSign, label: "$144.60 Avg", value: "$144.60" },
      ],
      image: unityJusticeImage,
    },
    {
      title: "Abdul for U.S. Senate",
      category: "Senate",
      stat: "257% ROI",
      description: "Effective Senate campaign leveraging targeted outreach and compelling messaging to drive grassroots support.",
      metrics: [
        { icon: TrendingUp, label: "257% ROI", value: "257%" },
        { icon: DollarSign, label: "$55.98 Avg", value: "$55.98" },
      ],
    },
    {
      title: "Nasser for Michigan",
      category: "Senate",
      stat: "325% ROI",
      description: "Delivered strong ROI with high average donation through compelling narrative-driven email strategy and targeted digital advertising.",
      metrics: [
        { icon: TrendingUp, label: "325% ROI", value: "325%" },
        { icon: DollarSign, label: "$129.56 Avg", value: "$129.56" },
      ],
    },
    {
      title: "Preston For PA",
      category: "Congressional",
      stat: "236% ROI",
      description: "Scaled Congressional campaign through strategic digital programs, adding over 2,300 new grassroots supporters.",
      metrics: [
        { icon: TrendingUp, label: "236% ROI", value: "236%" },
        { icon: Users, label: "2,349 New Donors", value: "2,349" },
        { icon: DollarSign, label: "$29.11 Avg", value: "$29.11" },
      ],
    },
    {
      title: "Rashid for Illinois",
      category: "Local",
      stat: "415% ROI",
      description: "Scaled grassroots campaign through targeted digital acquisition and conversion-optimized email program, adding 875 new donors in just 2 weeks.",
      metrics: [
        { icon: TrendingUp, label: "415% ROI", value: "415%" },
        { icon: Users, label: "875 New Donors", value: "875" },
        { icon: DollarSign, label: "$46.51 Avg", value: "$46.51" },
        { icon: Target, label: "2 Week Sprint", value: "2 weeks" },
      ],
    },
    {
      title: "Arab-American Non-profit",
      category: "501C(3)",
      stat: "304% ROI",
      description: "Exceptional donor acquisition for nonprofit organization, bringing in nearly 6,000 new supporters with compelling community-focused messaging.",
      metrics: [
        { icon: TrendingUp, label: "304% ROI", value: "304%" },
        { icon: Users, label: "5,909 New Donors", value: "5,909" },
        { icon: DollarSign, label: "$95.79 Avg", value: "$95.79" },
      ],
    },
    {
      title: "A New Policy",
      category: "501C(4)",
      stat: "289% ROI",
      description: "One-month advocacy campaign delivering strong returns through targeted issue-based messaging and strategic donor outreach.",
      metrics: [
        { icon: TrendingUp, label: "289% ROI", value: "289%" },
        { icon: Users, label: "502 New Donors", value: "502" },
        { icon: DollarSign, label: "$84.26 Avg", value: "$84.26" },
        { icon: Target, label: "1 Month Timeline", value: "1 month" },
      ],
    },
  ];

  const filters = ["All", "Senate", "Congressional", "Local", "PACs", "501C(3)", "501C(4)"];

  const filteredCaseStudies = activeFilter === "All" 
    ? caseStudies 
    : caseStudies.filter(study => study.category === activeFilter);

  return (
    <div className="min-h-screen">
      <Navigation />
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
              <Card key={index} className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm overflow-hidden">
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
      <Footer />
    </div>
  );
};

export default CaseStudies;
