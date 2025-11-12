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

const PrivacyPolicy = () => {
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
        "name": "Privacy Policy",
        "item": window.location.href
      }
    ]
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Privacy Policy",
    "description": "Privacy Policy for Molitico - Political consulting and campaign management firm",
    "url": window.location.href,
    "mainEntity": {
      "@type": "Organization",
      "name": "Molitico"
    }
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
              <BreadcrumbPage>Privacy Policy</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
            <p className="text-foreground/80 mb-4">
              Molitico ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or engage our services for political campaign management and consulting.
            </p>
            <p className="text-foreground/80">
              This policy complies with applicable privacy laws and regulations, including requirements for political advertising and data collection.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3">2.1 Personal Information</h3>
            <p className="text-foreground/80 mb-4">We may collect personally identifiable information, including but not limited to:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Name, email address, phone number</li>
              <li>Mailing address</li>
              <li>Payment and billing information</li>
              <li>Political preferences and affiliations</li>
              <li>Donation history and financial contributions</li>
              <li>Demographic information</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2.2 Usage Data</h3>
            <p className="text-foreground/80 mb-4">We automatically collect certain information when you visit our website:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>IP address and browser type</li>
              <li>Device information and operating system</li>
              <li>Pages viewed and time spent on pages</li>
              <li>Referring website addresses</li>
              <li>Clickstream data</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2.3 Cookies and Tracking Technologies</h3>
            <p className="text-foreground/80 mb-4">
              We use cookies, web beacons, and similar tracking technologies to enhance your experience and analyze website traffic.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Meta/Facebook Pixel and Social Media Tools</h2>
            
            <h3 className="text-xl font-semibold mb-3">3.1 Facebook Pixel Usage</h3>
            <p className="text-foreground/80 mb-4">
              We use Facebook Pixel and Meta Business Tools to track conversions from Facebook and Instagram ads, optimize campaigns, build targeted audiences, and remarket to people who have taken action on our website.
            </p>
            
            <h3 className="text-xl font-semibold mb-3">3.2 Data Shared with Meta</h3>
            <p className="text-foreground/80 mb-4">Through these tools, Meta may collect:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>IP address and user agent</li>
              <li>Pages visited and buttons clicked</li>
              <li>Form submissions and conversion events</li>
              <li>Custom audience matching data</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.3 Custom Audiences and Remarketing</h3>
            <p className="text-foreground/80 mb-4">
              We may use your email address or phone number to create Custom Audiences for targeted advertising on Facebook and Instagram. You can opt out of interest-based advertising through your Facebook Ad Preferences.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. How We Use Your Information</h2>
            <p className="text-foreground/80 mb-4">We use collected information for:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Providing and improving our political consulting services</li>
              <li>Processing donations and payments</li>
              <li>Communicating campaign updates and political information</li>
              <li>Sending fundraising appeals and advocacy messages</li>
              <li>Analyzing website usage and campaign performance</li>
              <li>Targeting political advertisements on social media platforms</li>
              <li>Building voter outreach lists and supporter databases</li>
              <li>Complying with legal obligations and FEC reporting requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Lead Generation and Form Data</h2>
            <p className="text-foreground/80 mb-4">
              When you submit a form on our website or through our Facebook/Instagram lead ads:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Your information is stored securely in our CRM systems</li>
              <li>You may receive follow-up communications about campaigns, events, or fundraising</li>
              <li>Your data may be shared with political campaigns we represent</li>
              <li>You can opt out of communications at any time using the unsubscribe link</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Political Advertising Data Retention</h2>
            <p className="text-foreground/80 mb-4">
              In compliance with federal and state campaign finance laws:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Donor information is retained for at least 3 years for FEC compliance</li>
              <li>Political advertising records are maintained for 2 years minimum</li>
              <li>Contributor data may be reported to regulatory agencies as required by law</li>
              <li>California residents have additional rights under CCPA (see Section 10)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Information Sharing and Disclosure</h2>
            <p className="text-foreground/80 mb-4">We may share your information with:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Political Campaigns:</strong> Candidates and campaigns we represent</li>
              <li><strong>Service Providers:</strong> Email platforms, SMS providers, payment processors, CRM systems</li>
              <li><strong>Social Media Platforms:</strong> Meta, Google, Twitter for advertising purposes</li>
              <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
              <li><strong>Partner Organizations:</strong> Allied political organizations and advocacy groups</li>
            </ul>
            <p className="text-foreground/80 mt-4">
              We do not sell your personal information to third parties for their marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Data Security</h2>
            <p className="text-foreground/80 mb-4">
              We implement appropriate security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>SSL encryption for data transmission</li>
              <li>Secure servers and encrypted databases</li>
              <li>Access controls and authentication requirements</li>
              <li>Regular security audits and updates</li>
            </ul>
            <p className="text-foreground/80">
              However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Your Privacy Rights</h2>
            <p className="text-foreground/80 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal retention requirements)</li>
              <li>Opt out of marketing communications</li>
              <li>Opt out of interest-based advertising</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. California Privacy Rights (CCPA)</h2>
            <p className="text-foreground/80 mb-4">
              California residents have additional rights under the California Consumer Privacy Act:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Right to know what personal information is collected</li>
              <li>Right to know if personal information is sold or disclosed</li>
              <li>Right to say no to the sale of personal information</li>
              <li>Right to access your personal information</li>
              <li>Right to equal service and price</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. GDPR Compliance (European Union Users)</h2>
            <p className="text-foreground/80 mb-4">
              If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have additional rights under the General Data Protection Regulation (GDPR).
            </p>

            <h3 className="text-xl font-semibold mb-3">11.1 Legal Basis for Processing</h3>
            <p className="text-foreground/80 mb-4">We process your personal data under the following legal bases:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Consent:</strong> When you provide explicit consent for specific processing activities</li>
              <li><strong>Contract Performance:</strong> Processing necessary to fulfill our services to you</li>
              <li><strong>Legitimate Interests:</strong> For our business operations, fraud prevention, and security</li>
              <li><strong>Legal Obligation:</strong> To comply with applicable laws and regulations</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">11.2 Your GDPR Rights</h3>
            <p className="text-foreground/80 mb-4">Under GDPR, you have the following rights:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Right of Access:</strong> Request copies of your personal data</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data ("right to be forgotten")</li>
              <li><strong>Right to Restrict Processing:</strong> Request limitation of how we use your data</li>
              <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Right to Object:</strong> Object to processing based on legitimate interests or direct marketing</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
              <li><strong>Right to Lodge a Complaint:</strong> File a complaint with your local data protection authority</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">11.3 Data Transfers</h3>
            <p className="text-foreground/80 mb-4">
              Your information may be transferred to and processed in the United States or other countries outside the EEA. We ensure adequate safeguards are in place, including:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Standard Contractual Clauses approved by the European Commission</li>
              <li>Adequacy decisions recognizing equivalent data protection standards</li>
              <li>Appropriate technical and organizational security measures</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">11.4 Data Retention</h3>
            <p className="text-foreground/80 mb-4">
              We retain personal data only for as long as necessary to fulfill the purposes outlined in this policy, comply with legal obligations, and resolve disputes. Specific retention periods include:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Marketing communications: Until you unsubscribe or request deletion</li>
              <li>Donor records: Minimum 3 years for regulatory compliance</li>
              <li>Website analytics: Up to 26 months</li>
              <li>Customer service records: Up to 6 years after last interaction</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">11.5 Automated Decision-Making</h3>
            <p className="text-foreground/80 mb-4">
              We may use automated decision-making for audience targeting and campaign optimization. You have the right to:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Request human intervention in automated decisions</li>
              <li>Express your point of view regarding automated decisions</li>
              <li>Contest decisions made solely by automated processing</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">11.6 Exercising Your GDPR Rights</h3>
            <p className="text-foreground/80 mb-4">
              To exercise any of your GDPR rights, please contact us at info@molitico.com with "GDPR Request" in the subject line. We will respond to your request within 30 days. You may also contact your local data protection authority if you have concerns about our data practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Children's Privacy</h2>
            <p className="text-foreground/80">
              Our services are not directed to children under 13. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">13. Changes to This Privacy Policy</h2>
            <p className="text-foreground/80">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page with an updated "Last Updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">14. Contact Us</h2>
            <p className="text-foreground/80 mb-4">
              If you have questions about this Privacy Policy or wish to exercise your privacy rights, contact us at:
            </p>
            <div className="bg-muted p-6 rounded-lg text-foreground/80">
              <p className="font-semibold mb-2">Molitico</p>
              <p>Email: info@molitico.com</p>
            </div>
          </section>

        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
