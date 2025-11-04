import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Monitor, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Creative {
  id: string;
  type: "SMS" | "Email" | "Display Ad" | "Social";
  campaign: string;
  image: string;
  result: string;
  description: string;
}

// Placeholder data - replace with actual creatives
const placeholderCreatives: Creative[] = [
  {
    id: "1",
    type: "SMS",
    campaign: "Unity & Justice Fund",
    image: "/src/assets/sms-mockup.jpg",
    result: "Generated $45K in 48 hours",
    description: "High-urgency fundraising message with personal storytelling",
  },
  // More will be added when you upload creative examples
];

export const CreativeGallery = () => {
  const [filter, setFilter] = useState<string>("All");
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);

  const categories = [
    { name: "All", icon: null },
    { name: "SMS", icon: MessageSquare },
    { name: "Email", icon: Mail },
    { name: "Display Ad", icon: Monitor },
    { name: "Social", icon: Share2 },
  ];

  const filteredCreatives =
    filter === "All" ? placeholderCreatives : placeholderCreatives.filter((c) => c.type === filter);

  return (
    <>
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-4 justify-center mb-16">
        {categories.map((category) => (
          <Button
            key={category.name}
            variant={filter === category.name ? "movement" : "outline"}
            size="lg"
            onClick={() => setFilter(category.name)}
            className="gap-2 font-bold uppercase tracking-wider"
          >
            {category.icon && <category.icon className="w-5 h-5" />}
            {category.name}
          </Button>
        ))}
      </div>

      {/* Gallery Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredCreatives.map((creative, index) => (
          <Card
            key={creative.id}
            className="overflow-hidden hover-lift cursor-pointer animate-bounce-in border-2 border-secondary/20 hover:border-secondary brutal-shadow group"
            style={{ animationDelay: `${index * 0.1}s` }}
            onClick={() => setSelectedCreative(creative)}
          >
            <CardContent className="p-0">
              <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
                <img
                  src={creative.image}
                  alt={`${creative.campaign} - ${creative.type}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-6 bg-gradient-to-br from-card to-muted">
                <div className="inline-block bg-secondary/20 text-secondary border-2 border-secondary/40 px-4 py-2 rounded-full text-sm font-bold mb-4 uppercase tracking-wider">
                  {creative.type}
                </div>
                <h3 className="font-bebas text-2xl text-foreground mb-2 uppercase tracking-wide">{creative.campaign}</h3>
                <p className="text-accent font-bold mb-2 text-lg">{creative.result}</p>
                <p className="text-sm text-muted-foreground">{creative.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredCreatives.length === 0 && (
        <div className="text-center py-20">
          <p className="text-xl text-muted-foreground">No creatives found for this category.</p>
          <p className="text-sm text-muted-foreground mt-2">Upload creative examples to showcase your work.</p>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedCreative && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedCreative(null)}
        >
          <div
            className="max-w-5xl w-full bg-card rounded-lg shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 bg-background/80 hover:bg-background"
                onClick={() => setSelectedCreative(null)}
              >
                <X className="w-5 h-5" />
              </Button>
              <div className="grid md:grid-cols-2">
                <div className="bg-muted flex items-center justify-center p-8">
                  <img
                    src={selectedCreative.image}
                    alt={`${selectedCreative.campaign} - ${selectedCreative.type}`}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
                <div className="p-8">
                  <div className="inline-block bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm font-semibold mb-4">
                    {selectedCreative.type}
                  </div>
                  <h2 className="text-3xl font-black text-foreground mb-4">{selectedCreative.campaign}</h2>
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-6">
                    <p className="text-lg font-bold text-accent-foreground">{selectedCreative.result}</p>
                  </div>
                  <p className="text-lg text-muted-foreground leading-relaxed">{selectedCreative.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
