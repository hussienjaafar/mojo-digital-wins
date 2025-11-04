import { DollarSign, TrendingUp, RefreshCw, Rocket } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface Step {
  number: string;
  icon: React.ElementType;
  title: string;
  description: string;
  highlight?: string;
}

const steps: Step[] = [
  {
    number: "01",
    icon: DollarSign,
    title: "Initial Investment",
    description: "$5,000 in strategic startup ad spend to launch the program",
  },
  {
    number: "02",
    icon: TrendingUp,
    title: "High-ROI Campaigns",
    description: "200–300% ROI typically generated within the first 30 days",
    highlight: "200–300%",
  },
  {
    number: "03",
    icon: RefreshCw,
    title: "Reinvestment Cycle",
    description: "20% of raised donations reinvested into ads each cycle",
    highlight: "20%",
  },
  {
    number: "04",
    icon: Rocket,
    title: "Scaling Results",
    description: "Daily ad spend grows to $500–$1,000/day based on performance",
    highlight: "$500–$1,000/day",
  },
];

export const CompoundingImpactModel = () => {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 });

  return (
    <section className="py-20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5">
      <div className="container mx-auto px-4">
        <div ref={ref} className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black text-foreground mb-4">
              The Compounding Impact Model
              <sup className="text-2xl md:text-3xl text-secondary">™</sup>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Our innovative reinvestment approach creates a self-sustaining fundraising engine that grows
              alongside grassroots support
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`relative bg-card border border-border rounded-lg p-8 hover-lift ${
                  isVisible ? "animate-fade-in-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Step Number */}
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center font-black text-lg shadow-lg">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="bg-secondary/10 text-secondary w-14 h-14 rounded-lg flex items-center justify-center mb-4 ml-8">
                  <step.icon className="w-7 h-7" />
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">{step.description}</p>

                {/* Highlight */}
                {step.highlight && (
                  <div className="mt-4 inline-block bg-accent/20 text-accent-foreground px-4 py-2 rounded-full font-bold">
                    {step.highlight}
                  </div>
                )}

                {/* Connector Arrow - Only for first 3 steps */}
                {index < 3 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 transform -translate-y-1/2 text-secondary">
                    <svg
                      className="w-8 h-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quote Callout */}
          <div
            className={`bg-primary text-primary-foreground rounded-lg p-8 md:p-12 text-center ${
              isVisible ? "animate-fade-in" : "opacity-0"
            }`}
            style={{ animationDelay: "0.8s" }}
          >
            <div className="text-6xl text-accent mb-4">"</div>
            <p className="text-xl md:text-2xl font-semibold mb-4 leading-relaxed">
              This model creates a self-sustaining fundraising engine that amplifies grassroots power while
              maintaining fiscal responsibility.
            </p>
            <div className="w-20 h-1 bg-accent mx-auto"></div>
          </div>
        </div>
      </div>
    </section>
  );
};
