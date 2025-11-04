import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Shield, Clock } from "lucide-react";

const Contact = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    campaignType: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      toast({
        title: "Message Received!",
        description: "We'll get back to you within 24 hours to discuss your campaign strategy.",
      });
      setFormData({
        name: "",
        email: "",
        organization: "",
        campaignType: "",
        message: "",
      });
      setIsSubmitting(false);
    }, 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent overflow-hidden diagonal-bottom">
        <div className="texture-overlay"></div>
        <div className="container relative z-10 mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-display text-white mb-4 md:mb-6 leading-tight animate-fade-in energy-glow">
            Let's Build Your Win
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto font-light animate-fade-in px-4">
            Get in touch to start planning your campaign's digital strategy
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12 max-w-6xl mx-auto">
            {/* Contact Form */}
            <Card className="md:col-span-2 brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in">
              <CardHeader>
                <CardTitle className="text-headline">Send Us a Message</CardTitle>
                <CardDescription>Fill out the form below and we'll get back to you within 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-2">
                      Your Name *
                    </label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="Jane Smith"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-2">
                      Email Address *
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="jane@campaign.org"
                    />
                  </div>

                  <div>
                    <label htmlFor="organization" className="block text-sm font-semibold text-foreground mb-2">
                      Campaign/Organization Name *
                    </label>
                    <Input
                      id="organization"
                      name="organization"
                      type="text"
                      value={formData.organization}
                      onChange={handleChange}
                      required
                      placeholder="Smith for Senate"
                    />
                  </div>

                  <div>
                    <label htmlFor="campaignType" className="block text-sm font-semibold text-foreground mb-2">
                      Campaign Type *
                    </label>
                    <Input
                      id="campaignType"
                      name="campaignType"
                      type="text"
                      value={formData.campaignType}
                      onChange={handleChange}
                      required
                      placeholder="Federal, State, Local, PAC, or Nonprofit"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-semibold text-foreground mb-2">
                      Tell Us About Your Campaign *
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      placeholder="What are your fundraising goals? What challenges are you facing? How can we help?"
                      rows={5}
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full min-h-[48px]" disabled={isSubmitting} variant="brutal">
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info & Credibility */}
            <div className="space-y-6">
              {/* Contact Details */}
              <Card className="brutal-shadow hover:energy-glow transition-all duration-300 animate-fade-in">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">Get In Touch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-primary mt-1 energy-glow" />
                    <div>
                      <div className="font-semibold text-foreground">Email</div>
                      <a href="mailto:hello@mojodigital.com" className="text-primary hover:underline">
                        hello@mojodigital.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-primary mt-1 energy-glow" />
                    <div>
                      <div className="font-semibold text-foreground">Phone</div>
                      <a href="tel:+15551234567" className="text-primary hover:underline">
                        (555) 123-4567
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-primary mt-1 energy-glow" />
                    <div>
                      <div className="font-semibold text-foreground">Location</div>
                      <p className="text-muted-foreground">Remote-first team based in the US</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credibility Message */}
              <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 brutal-shadow diagonal-top relative overflow-hidden animate-fade-in" style={{ animationDelay: "100ms" }}>
                <CardContent className="p-6 relative z-10">
                  <Shield className="w-10 h-10 text-primary mb-4 energy-glow" />
                  <h3 className="text-xl font-bold text-foreground mb-2">Your Campaign's Success Matters</h3>
                  <p className="text-muted-foreground mb-4">
                    We're selective about the campaigns we work with because we're invested in your win. When you reach out,
                    we'll have an honest conversation about fit, strategy, and goals.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    We work exclusively with progressive candidates and causes. If that's you, let's talk.
                  </p>
                </CardContent>
              </Card>

              {/* Response Time */}
              <Card className="bg-gradient-to-r from-accent/10 to-primary/10 brutal-shadow energy-glow animate-fade-in" style={{ animationDelay: "200ms" }}>
                <CardContent className="p-6">
                  <Clock className="w-10 h-10 text-accent mb-4 energy-glow" />
                  <h3 className="text-xl font-bold text-foreground mb-2">Fast Response Time</h3>
                  <p className="text-muted-foreground">
                    In politics, timing is everything. We respond to all inquiries within 24 hours, often much faster.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
