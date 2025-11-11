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

const CookiePolicy = () => {
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
        "name": "Cookie Policy",
        "item": window.location.href
      }
    ]
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Cookie Policy",
    "description": "Cookie Policy for Molitico - How we use cookies and tracking technologies",
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
              <BreadcrumbPage>Cookie Policy</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Cookie Policy</h1>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. What Are Cookies?</h2>
            <p className="text-foreground/80 mb-4">
              Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and provide information to website owners.
            </p>
            <p className="text-foreground/80">
              Molitico uses cookies and similar tracking technologies to enhance your browsing experience, analyze website traffic, and deliver targeted political advertising.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Types of Cookies We Use</h2>
            
            <h3 className="text-xl font-semibold mb-3">2.1 Essential Cookies</h3>
            <p className="text-foreground/80 mb-4">
              These cookies are necessary for the website to function properly. They enable basic features like page navigation, secure areas access, and form submissions.
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-sm text-foreground/80"><strong>Examples:</strong> Session management, security tokens, load balancing</p>
              <p className="text-sm text-foreground/80"><strong>Duration:</strong> Session or up to 1 year</p>
            </div>

            <h3 className="text-xl font-semibold mb-3">2.2 Analytics Cookies</h3>
            <p className="text-foreground/80 mb-4">
              We use analytics cookies to understand how visitors interact with our website. This helps us improve our services and user experience.
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-sm text-foreground/80"><strong>Examples:</strong> Google Analytics, page views, bounce rates, traffic sources</p>
              <p className="text-sm text-foreground/80"><strong>Duration:</strong> Up to 2 years</p>
              <p className="text-sm text-foreground/80"><strong>Third parties:</strong> Google Analytics</p>
            </div>

            <h3 className="text-xl font-semibold mb-3">2.3 Advertising Cookies</h3>
            <p className="text-foreground/80 mb-4">
              These cookies are used to deliver relevant political advertisements and track campaign performance. They help us show you ads that match your interests.
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-sm text-foreground/80"><strong>Examples:</strong> Facebook Pixel, Google Ads, retargeting pixels</p>
              <p className="text-sm text-foreground/80"><strong>Duration:</strong> Up to 90 days</p>
              <p className="text-sm text-foreground/80"><strong>Third parties:</strong> Meta/Facebook, Google, Twitter</p>
            </div>

            <h3 className="text-xl font-semibold mb-3">2.4 Functional Cookies</h3>
            <p className="text-foreground/80 mb-4">
              These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-sm text-foreground/80"><strong>Examples:</strong> Language preferences, donation amount preferences, form auto-fill</p>
              <p className="text-sm text-foreground/80"><strong>Duration:</strong> Up to 1 year</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Social Media and Advertising Pixels</h2>
            
            <h3 className="text-xl font-semibold mb-3">3.1 Facebook/Meta Pixel</h3>
            <p className="text-foreground/80 mb-4">
              We use the Facebook Pixel to:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Track conversions from Facebook and Instagram ads</li>
              <li>Build Custom Audiences for targeted advertising</li>
              <li>Optimize ad delivery to people likely to take action</li>
              <li>Remarket to website visitors</li>
            </ul>
            <p className="text-foreground/80 mb-4">
              The Facebook Pixel collects: IP address, browser information, page views, and actions taken on our website.
            </p>

            <h3 className="text-xl font-semibold mb-3">3.2 Google Analytics and Google Ads</h3>
            <p className="text-foreground/80 mb-4">
              We use Google Analytics to measure website traffic and Google Ads for retargeting campaigns. These services use cookies to track user behavior across websites.
            </p>

            <h3 className="text-xl font-semibold mb-3">3.3 Other Advertising Partners</h3>
            <p className="text-foreground/80 mb-4">
              We may use additional advertising partners for political campaign marketing:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Twitter/X conversion tracking</li>
              <li>LinkedIn Insight Tag</li>
              <li>Programmatic advertising platforms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. How Long Do Cookies Last?</h2>
            <p className="text-foreground/80 mb-4">Cookies can be either:</p>
            
            <h3 className="text-xl font-semibold mb-3">Session Cookies</h3>
            <p className="text-foreground/80 mb-4">
              Temporary cookies that are deleted when you close your browser. Used for essential website functions.
            </p>

            <h3 className="text-xl font-semibold mb-3">Persistent Cookies</h3>
            <p className="text-foreground/80 mb-4">
              Remain on your device for a set period or until you delete them. Used for analytics and advertising purposes.
            </p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-foreground/80"><strong>Typical duration:</strong> 30 days to 2 years, depending on cookie type</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Managing Your Cookie Preferences</h2>
            
            <h3 className="text-xl font-semibold mb-3">5.1 Browser Settings</h3>
            <p className="text-foreground/80 mb-4">
              You can control cookies through your browser settings. Most browsers allow you to:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>View what cookies are stored</li>
              <li>Delete all or specific cookies</li>
              <li>Block third-party cookies</li>
              <li>Block all cookies (may affect website functionality)</li>
              <li>Delete cookies when you close your browser</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">5.2 Opt-Out Links</h3>
            <p className="text-foreground/80 mb-4">
              You can opt out of interest-based advertising through:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><a href="https://www.facebook.com/ads/preferences" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Facebook Ad Preferences</a></li>
              <li><a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Ads Settings</a></li>
              <li><a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Network Advertising Initiative</a></li>
              <li><a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Digital Advertising Alliance</a></li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">5.3 Do Not Track</h3>
            <p className="text-foreground/80">
              Some browsers offer "Do Not Track" signals. However, there is no industry standard for responding to these signals, so we currently do not respond to Do Not Track requests.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Mobile Device Identifiers</h2>
            <p className="text-foreground/80 mb-4">
              When you access our services via mobile app or mobile browser, we may collect mobile device identifiers. You can limit ad tracking through your device settings:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>iOS:</strong> Settings → Privacy → Advertising → Limit Ad Tracking</li>
              <li><strong>Android:</strong> Settings → Google → Ads → Opt out of Ads Personalization</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Third-Party Cookies</h2>
            <p className="text-foreground/80 mb-4">
              Some cookies are placed by third-party services that appear on our pages. We do not control these cookies. Third parties include:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Social media platforms (Facebook, Twitter, LinkedIn)</li>
              <li>Analytics providers (Google Analytics)</li>
              <li>Advertising networks</li>
              <li>Payment processors</li>
            </ul>
            <p className="text-foreground/80">
              We recommend reviewing the privacy policies of these third parties for information about their cookie practices.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Updates to This Cookie Policy</h2>
            <p className="text-foreground/80">
              We may update this Cookie Policy to reflect changes in our practices or for legal, operational, or regulatory reasons. We will post the updated policy on this page with a new "Last Updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Contact Us</h2>
            <p className="text-foreground/80 mb-4">
              If you have questions about our use of cookies, please contact us at:
            </p>
            <div className="bg-muted p-6 rounded-lg text-foreground/80">
              <p className="font-semibold mb-2">Molitico</p>
              <p>Email: privacy@molitico.com</p>
              <p>Address: [Your Business Address]</p>
              <p>Phone: [Your Contact Number]</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t">
            <h3 className="text-lg font-semibold mb-4">Related Policies</h3>
            <ul className="space-y-2">
              <li><Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link></li>
              <li><Link to="/disclaimer" className="text-primary hover:underline">Disclaimer</Link></li>
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CookiePolicy;
