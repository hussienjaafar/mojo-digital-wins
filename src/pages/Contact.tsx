import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Calendar } from "lucide-react";

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
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary to-secondary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-black mb-6">Let's Win Together</h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90">
              Ready to maximize your campaign's impact? Book a strategy call or send us a message.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Form */}
            <div className="animate-fade-in">
              <Card>
                <CardContent className="p-8">
                  <h2 className="text-3xl font-black text-foreground mb-6">Send Us a Message</h2>
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

                    <Button
                      type="submit"
                      variant="secondary"
                      size="lg"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Contact Info & Credibility */}
            <div className="space-y-8 animate-slide-in-right">
              {/* Contact Details */}
              <Card>
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-foreground mb-6">Get In Touch</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Email</div>
                        <a
                          href="mailto:hello@mojodigital.com"
                          className="text-secondary hover:underline"
                        >
                          hello@mojodigital.com
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Schedule a Call</div>
                        <p className="text-muted-foreground text-sm">
                          Book a 30-minute strategy session
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Phone</div>
                        <a href="tel:+1234567890" className="text-secondary hover:underline">
                          (123) 456-7890
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-secondary text-secondary-foreground p-3 rounded-lg">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">Location</div>
                        <p className="text-muted-foreground text-sm">
                          Serving progressive campaigns nationwide
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Credibility Message */}
              <Card className="bg-muted border-none">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    We Only Grow Campaigns We Believe In
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    At Mojo Digital, we're selective about who we partner with. We only work with campaigns and
                    causes aligned with our progressive values.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    If you're fighting for racial justice, climate action, economic equity, immigrant rights, or
                    human dignity—we want to help you win.
                  </p>
                </CardContent>
              </Card>

              {/* Response Time */}
              <Card className="bg-gradient-to-br from-secondary to-primary text-primary-foreground border-none">
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold mb-2">⚡ Fast Response</h3>
                  <p className="text-primary-foreground/90">
                    We typically respond within 24 hours. Campaigns move fast—so do we.
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
