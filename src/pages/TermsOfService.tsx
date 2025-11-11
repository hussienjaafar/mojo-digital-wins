import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";
import { useEffect } from "react";

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Structured Data for SEO
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": window.location.origin
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Terms of Service",
        "item": window.location.href
      }
    ]
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Terms of Service",
    "description": "Terms of Service for Molitico - Political consulting and campaign management services",
    "url": window.location.href
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data for SEO */}
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(webPageSchema)}
      </script>

      <Navigation />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-8">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Terms of Service</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p className="text-foreground/80 mb-4">
              Welcome to Molitico. By accessing our website, engaging our services, or making donations through our platform, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our services.
            </p>
            <p className="text-foreground/80">
              These Terms constitute a legally binding agreement between you and Molitico ("we," "us," or "our").
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Services Description</h2>
            <p className="text-foreground/80 mb-4">
              Molitico provides political consulting and campaign management services, including but not limited to:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>SMS fundraising and voter outreach</li>
              <li>Digital advertising campaign management</li>
              <li>Email marketing and donor acquisition</li>
              <li>Social media advertising and content strategy</li>
              <li>Performance analytics and reporting</li>
              <li>Political strategy consulting</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. User Obligations</h2>
            
            <h3 className="text-xl font-semibold mb-3">3.1 Accuracy of Information</h3>
            <p className="text-foreground/80 mb-4">
              You agree to provide accurate, current, and complete information when using our services or making donations. You are responsible for maintaining the accuracy of your information.
            </p>

            <h3 className="text-xl font-semibold mb-3">3.2 Lawful Use</h3>
            <p className="text-foreground/80 mb-4">You agree to use our services only for lawful purposes and in compliance with:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Federal Election Commission (FEC) regulations</li>
              <li>State campaign finance laws</li>
              <li>Telephone Consumer Protection Act (TCPA)</li>
              <li>CAN-SPAM Act</li>
              <li>All applicable federal, state, and local laws</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.3 Prohibited Activities</h3>
            <p className="text-foreground/80 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Use our services for any illegal or fraudulent purpose</li>
              <li>Impersonate any person or entity</li>
              <li>Transmit viruses, malware, or harmful code</li>
              <li>Interfere with or disrupt our services</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Violate any applicable campaign finance laws</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Political Contributions and Donations</h2>
            
            <h3 className="text-xl font-semibold mb-3">4.1 Contribution Limits</h3>
            <p className="text-foreground/80 mb-4">
              All political contributions must comply with federal and state contribution limits. By making a donation, you certify that:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>You are a U.S. citizen or lawfully admitted permanent resident</li>
              <li>The contribution is made from your own funds</li>
              <li>You are not a federal contractor</li>
              <li>The contribution does not exceed legal limits</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">4.2 Refund Policy</h3>
            <p className="text-foreground/80 mb-4">
              Political contributions are generally non-refundable. Refund requests will be considered on a case-by-case basis and must be submitted within 30 days of the contribution. Refunds are subject to FEC regulations.
            </p>

            <h3 className="text-xl font-semibold mb-3">4.3 Recurring Contributions</h3>
            <p className="text-foreground/80 mb-4">
              If you opt into recurring contributions, you authorize us to charge your payment method at the specified intervals. You may cancel recurring contributions at any time by contacting us.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Client Services Terms</h2>
            
            <h3 className="text-xl font-semibold mb-3">5.1 Service Agreements</h3>
            <p className="text-foreground/80 mb-4">
              Specific terms for consulting and campaign management services are detailed in separate service agreements. These Terms supplement those agreements.
            </p>

            <h3 className="text-xl font-semibold mb-3">5.2 Performance Standards</h3>
            <p className="text-foreground/80 mb-4">
              While we strive for excellence, campaign results depend on many factors beyond our control. We make no guarantees regarding election outcomes, fundraising totals, or specific performance metrics unless explicitly stated in writing.
            </p>

            <h3 className="text-xl font-semibold mb-3">5.3 Client Responsibilities</h3>
            <p className="text-foreground/80 mb-4">
              Clients are responsible for:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Timely payment of invoices</li>
              <li>Providing necessary campaign materials and approvals</li>
              <li>Ensuring all content complies with campaign finance laws</li>
              <li>Maintaining required FEC and state filings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Intellectual Property Rights</h2>
            
            <h3 className="text-xl font-semibold mb-3">6.1 Our Content</h3>
            <p className="text-foreground/80 mb-4">
              All content on our website, including text, graphics, logos, images, and software, is the property of Molitico or our licensors and is protected by copyright, trademark, and other intellectual property laws.
            </p>

            <h3 className="text-xl font-semibold mb-3">6.2 Campaign Materials</h3>
            <p className="text-foreground/80 mb-4">
              Creative materials developed for clients remain the property of Molitico unless otherwise specified in a service agreement. Clients receive a license to use materials for their campaign purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Privacy and Data Protection</h2>
            <p className="text-foreground/80 mb-4">
              Your use of our services is also governed by our <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Limitation of Liability</h2>
            <p className="text-foreground/80 mb-4">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Molitico shall not be liable for any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Our total liability shall not exceed the amount paid by you to us in the 12 months preceding the claim</li>
              <li>We are not liable for campaign losses, election outcomes, or fundraising results</li>
              <li>We are not responsible for third-party platform policies or changes (Facebook, Google, etc.)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Indemnification</h2>
            <p className="text-foreground/80">
              You agree to indemnify and hold harmless Molitico, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Your violation of these Terms</li>
              <li>Your violation of any law or regulation</li>
              <li>Your violation of any third-party rights</li>
              <li>Content you provide to us for campaign use</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Termination</h2>
            <p className="text-foreground/80 mb-4">
              We reserve the right to terminate or suspend your access to our services at any time, without notice, for conduct that we believe:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Violates these Terms</li>
              <li>Violates applicable laws or regulations</li>
              <li>Could harm other users or our business</li>
              <li>Exposes us to legal liability</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Governing Law and Dispute Resolution</h2>
            
            <h3 className="text-xl font-semibold mb-3">11.1 Governing Law</h3>
            <p className="text-foreground/80 mb-4">
              These Terms shall be governed by and construed in accordance with the laws of [Your State], without regard to its conflict of law provisions.
            </p>

            <h3 className="text-xl font-semibold mb-3">11.2 Arbitration</h3>
            <p className="text-foreground/80 mb-4">
              Any dispute arising from these Terms shall be resolved through binding arbitration in accordance with the American Arbitration Association rules, except for claims that may be brought in small claims court.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Modifications to Terms</h2>
            <p className="text-foreground/80">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website with a new "Last Updated" date. Your continued use of our services after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Severability</h2>
            <p className="text-foreground/80">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">14. Contact Information</h2>
            <p className="text-foreground/80 mb-4">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <div className="bg-muted p-6 rounded-lg text-foreground/80">
              <p className="font-semibold mb-2">Molitico</p>
              <p>Email: legal@molitico.com</p>
              <p>Address: [Your Business Address]</p>
              <p>Phone: [Your Contact Number]</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t">
            <h3 className="text-lg font-semibold mb-4">Related Policies</h3>
            <ul className="space-y-2">
              <li><Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link></li>
              <li><Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link></li>
              <li><Link to="/disclaimer" className="text-primary hover:underline">Disclaimer</Link></li>
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TermsOfService;
