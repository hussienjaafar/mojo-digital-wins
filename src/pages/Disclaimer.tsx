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

const Disclaimer = () => {
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
        "name": "Disclaimer",
        "item": window.location.href
      }
    ]
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Disclaimer",
    "description": "Legal disclaimers and FEC compliance information for Molitico political consulting services",
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
              <BreadcrumbPage>Disclaimer</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Disclaimer</h1>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* FEC Compliance Notice - Highlighted */}
        <div className="bg-primary/10 border-l-4 border-primary p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Political Advertising Disclaimer</h2>
          <p className="text-foreground font-semibold mb-2">
            Paid for by Molitico. Not authorized by any candidate or candidate's committee.
          </p>
          <p className="text-foreground/80 text-sm">
            This disclaimer appears on all political advertisements and communications as required by federal and state campaign finance laws.
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. General Website Disclaimer</h2>
            <p className="text-foreground/80 mb-4">
              The information provided on this website is for general informational purposes only. While we strive to keep the information accurate and up-to-date, we make no representations or warranties of any kind, express or implied, about the completeness, accuracy, reliability, suitability, or availability of the website or the information, products, services, or related graphics contained on the website.
            </p>
            <p className="text-foreground/80">
              Any reliance you place on such information is strictly at your own risk. In no event will Molitico be liable for any loss or damage arising from the use of this website.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. FEC Compliance and Political Advertising</h2>
            
            <h3 className="text-xl font-semibold mb-3">2.1 Federal Disclaimer Requirements</h3>
            <p className="text-foreground/80 mb-4">
              All political advertisements and communications funded by Molitico comply with Federal Election Commission (FEC) disclaimer requirements under 52 U.S.C. § 30120 and 11 CFR 110.11.
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-foreground/80 font-semibold mb-2">Standard FEC Disclaimer:</p>
              <p className="text-foreground/80 italic">"Paid for by Molitico. Not authorized by any candidate or candidate's committee."</p>
            </div>

            <h3 className="text-xl font-semibold mb-3">2.2 Independent Expenditure Disclaimers</h3>
            <p className="text-foreground/80 mb-4">
              For independent expenditures, our communications include the required disclaimer:
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-foreground/80 italic">
                "Paid for by [Committee Name]. Not authorized by any candidate or candidate's committee. [Top Five Donors if applicable]"
              </p>
            </div>

            <h3 className="text-xl font-semibold mb-3">2.3 Client Authorization</h3>
            <p className="text-foreground/80 mb-4">
              All campaign advertisements created for clients are authorized and approved by the respective candidate or authorized campaign committee before publication. Required disclaimers include:
            </p>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-foreground/80 italic">
                "Paid for by [Candidate Name] for [Office]" or<br />
                "[Candidate Name] approved this message"
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Meta Political Advertising Compliance</h2>
            
            <h3 className="text-xl font-semibold mb-3">3.1 Meta's "Paid for by" Requirement</h3>
            <p className="text-foreground/80 mb-4">
              All political advertisements on Facebook and Instagram include Meta's required "Paid for by" disclaimer, which identifies:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>The entity that paid for the advertisement</li>
              <li>Contact information for the paying entity</li>
              <li>Additional disclosures as required by Meta's political advertising policies</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.2 Ad Library Transparency</h3>
            <p className="text-foreground/80 mb-4">
              All political ads run through Molitico are stored in Meta's Ad Library for seven years, providing public transparency about:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Who paid for the ad</li>
              <li>How much was spent</li>
              <li>Who saw the ad (demographics and geography)</li>
              <li>When the ad ran</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.3 Authorized Advertisers</h3>
            <p className="text-foreground/80">
              Molitico maintains authorization to run political ads on Meta platforms through identity verification and disclaimer compliance procedures.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. State-Specific Disclaimers</h2>
            <p className="text-foreground/80 mb-4">
              In addition to federal requirements, we comply with state-specific political advertising disclosure laws, which may require:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Additional disclaimer language</li>
              <li>Specific font sizes and placement requirements</li>
              <li>Top contributor disclosures</li>
              <li>Registration of political advertising sponsors</li>
              <li>Pre-approval by state election authorities</li>
            </ul>
            <p className="text-foreground/80">
              Disclaimer requirements vary by state and are updated as laws change.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. No Guarantee of Results</h2>
            <p className="text-foreground/80 mb-4">
              Political campaign outcomes depend on numerous factors beyond our control. While we employ proven strategies and best practices, Molitico makes no guarantees regarding:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Election results or vote margins</li>
              <li>Fundraising totals or donor acquisition numbers</li>
              <li>Social media engagement or follower growth</li>
              <li>Polling numbers or public opinion shifts</li>
              <li>Media coverage or earned media value</li>
              <li>Ad performance metrics meeting specific targets</li>
            </ul>
            <p className="text-foreground/80">
              Past performance and case study results are not indicative of future outcomes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Third-Party Platforms</h2>
            <p className="text-foreground/80 mb-4">
              We utilize third-party platforms for advertising and outreach, including:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Facebook/Instagram (Meta)</li>
              <li>Google Ads</li>
              <li>Twitter/X</li>
              <li>Email service providers</li>
              <li>SMS/texting platforms</li>
            </ul>
            <p className="text-foreground/80 mb-4">
              These platforms have their own terms of service, advertising policies, and political content restrictions that may change without notice. Molitico is not responsible for:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Platform policy changes or ad rejections</li>
              <li>Account suspensions or restrictions</li>
              <li>Algorithm changes affecting ad delivery</li>
              <li>Platform outages or technical issues</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Professional Advice Disclaimer</h2>
            <p className="text-foreground/80 mb-4">
              The information and strategies provided by Molitico are for informational purposes only and do not constitute:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Legal advice regarding campaign finance law</li>
              <li>Tax advice regarding political contributions</li>
              <li>Financial advice regarding campaign budgets</li>
              <li>Compliance advice without proper legal review</li>
            </ul>
            <p className="text-foreground/80">
              Clients should consult with qualified legal, tax, and compliance professionals regarding their specific situations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Data Accuracy and Case Studies</h2>
            <p className="text-foreground/80 mb-4">
              Case studies and performance metrics displayed on this website:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Represent actual client campaigns with client permission</li>
              <li>May be anonymized or aggregated to protect client confidentiality</li>
              <li>Reflect performance during specific time periods</li>
              <li>Are not guarantees of future performance</li>
              <li>May have been achieved under unique circumstances</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. External Links</h2>
            <p className="text-foreground/80">
              This website may contain links to external websites. We have no control over the content and nature of these sites and cannot be held responsible for their content, privacy policies, or practices. The inclusion of any links does not necessarily imply a recommendation or endorse the views expressed within them.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Testimonials and Endorsements</h2>
            <p className="text-foreground/80 mb-4">
              Testimonials on this website:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Are from real clients with their permission</li>
              <li>May not be representative of all client experiences</li>
              <li>Do not guarantee similar results for other campaigns</li>
              <li>Reflect the opinions of the individuals, not Molitico</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Updates to Disclaimers</h2>
            <p className="text-foreground/80">
              This disclaimer may be updated periodically to reflect changes in laws, regulations, or our practices. Material changes will be noted with an updated "Last Updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Contact Information</h2>
            <p className="text-foreground/80 mb-4">
              For questions about our disclaimers or FEC compliance, contact:
            </p>
            <div className="bg-muted p-6 rounded-lg text-foreground/80">
              <p className="font-semibold mb-2">Molitico</p>
              <p>Email: info@molitico.com</p>
              <p>Address: [Your Business Address]</p>
              <p>Phone: [Your Contact Number]</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t">
            <h3 className="text-lg font-semibold mb-4">Related Policies</h3>
            <ul className="space-y-2">
              <li><Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="text-primary hover:underline">Terms of Service</Link></li>
              <li><Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link></li>
            </ul>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Disclaimer;
