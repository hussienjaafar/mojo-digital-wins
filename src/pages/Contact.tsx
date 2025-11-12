import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, Phone } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ParticleButton } from "@/components/ParticleButton";
import AnimatedPatternHero from "@/components/AnimatedPatternHero";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";

const Contact = () => {
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");
  };

  return (
    <div className="min-h-screen">
      <ScrollProgressIndicator />
      <Navigation />
      <AnimatedPatternHero
        title="Let's Win Together"
        description="Ready to make progressive impact? Tell us about your organization and goals, and we'll show you how we can help."
      />

      {/* Contact Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* Primary CTA - Book a Call */}
            <div className="text-center mb-16 space-y-8">
              <div>
                <h2 className="font-bebas text-primary mb-4 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
                  Book Your Free Strategy Call
                </h2>
                <p className="text-lg text-foreground/80 leading-relaxed max-w-2xl mx-auto">
                  Let's discuss your organization's goals and how we can help you win. Choose a time that works for you.
                </p>
              </div>
              
              <ParticleButton
                href="https://calendly.com/molitico/30min"
                size="xl"
                particleColor="hsl(var(--secondary))"
                particleCount={25}
                className="text-lg font-bold"
              >
                Schedule Your Call Now
              </ParticleButton>

              <div className="pt-6">
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="text-muted-foreground hover:text-foreground transition-colors underline text-sm"
                >
                  {showForm ? "Hide contact form" : "Prefer to send a message instead?"}
                </button>
              </div>
            </div>

            {/* Contact Form - Collapsible */}
            {showForm && (
              <div className="grid md:grid-cols-2 gap-12 animate-fade-in">
                {/* Contact Info */}
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-4">Get in Touch</h3>
                    <p className="text-lg text-foreground/80 leading-relaxed">
                      Fill out the form and we'll get back to you within 24 hours.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {[
                      { icon: Mail, title: "Email Us", value: "info@molitico.com" },
                      { icon: MessageSquare, title: "Quick Questions", value: "Use the form for fastest response" }
                    ].map((contact, index) => (
                      <Card key={index} className="shadow-md hover:shadow-lg transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                        <CardContent className="p-6 flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-secondary to-accent rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                            <contact.icon className="h-6 w-6 text-white drop-shadow-sm" />
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground mb-1">{contact.title}</h4>
                            <p className="text-muted-foreground">{contact.value}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Contact Form */}
                <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                  <CardContent className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" placeholder="Your name" required className="border-border/50 focus:border-secondary transition-colors" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" type="email" placeholder="your@email.com" required className="border-border/50 focus:border-secondary transition-colors" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="campaign">Campaign/Organization *</Label>
                        <Input id="campaign" placeholder="Smith for Senate" required className="border-border/50 focus:border-secondary transition-colors" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="race-type">Organization Type</Label>
                        <Input id="race-type" placeholder="Campaign, PAC, 501(c)(3), 501(c)(4), etc." className="border-border/50 focus:border-secondary transition-colors" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Tell Us About Your Organization *</Label>
                        <Textarea id="message" placeholder="What are your goals? What help do you need?" required rows={5} className="border-border/50 focus:border-secondary transition-colors resize-none" />
                      </div>

                      <Button type="submit" size="lg" className="w-full shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                        Send Message
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-bebas text-primary text-center mb-12 leading-tight" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '0.02em' }}>
              Common Questions
            </h2>
            
            <div className="space-y-6">
              {[
                { question: "What types of organizations do you work with?", answer: "We work with progressive organizations of all types and sizes—political campaigns, PACs, 501(c)(3)s, and 501(c)(4)s. From local races to national advocacy movements, if you're committed to progressive values and ready to make impact, we want to work with you." },
                { question: "How quickly can we get started?", answer: "Most projects can launch within 1-2 weeks. We move fast because we know you can't wait." },
                { question: "What's your pricing model?", answer: "We offer flexible pricing based on your organization's size and scope. We'll discuss options on our first call to find what works for your budget." },
                { question: "Do you only work with Democrats?", answer: "We work exclusively with progressive candidates and causes aligned with our values—racial justice, economic equality, climate action, and democracy reform." }
              ].map((faq, index) => (
                <Card key={index} className="shadow-md hover:shadow-lg transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm">
                  <CardContent className="p-6 space-y-3">
                    <h3 className="text-xl font-bold text-foreground">{faq.question}</h3>
                    <p className="text-foreground/80 leading-relaxed">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Contact;
