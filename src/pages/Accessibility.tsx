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

const Accessibility = () => {
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
        "name": "Accessibility Statement",
        "item": window.location.href
      }
    ]
  };

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Accessibility Statement",
    "description": "Accessibility commitment and features for Molitico website",
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
              <BreadcrumbPage>Accessibility Statement</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Accessibility Statement</h1>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Our Commitment to Accessibility</h2>
            <p className="text-foreground/80 mb-4">
              Molitico is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards to ensure we provide equal access to all of our users.
            </p>
            <p className="text-foreground/80">
              We believe that political participation should be accessible to everyone, regardless of ability. Our commitment to accessibility reflects our progressive values and dedication to inclusive democracy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Accessibility Standards</h2>
            <p className="text-foreground/80 mb-4">
              We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. These guidelines explain how to make web content more accessible for people with disabilities and more user-friendly for everyone.
            </p>
            <p className="text-foreground/80">
              Our website is designed to be compatible with:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Screen readers (JAWS, NVDA, VoiceOver)</li>
              <li>Browser zoom and text resizing</li>
              <li>Keyboard-only navigation</li>
              <li>Voice recognition software</li>
              <li>Alternative input devices</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Accessibility Features</h2>
            
            <h3 className="text-xl font-semibold mb-3">3.1 Navigation and Structure</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Semantic HTML:</strong> Proper heading hierarchy and landmark regions</li>
              <li><strong>Skip Links:</strong> Ability to skip to main content</li>
              <li><strong>Consistent Navigation:</strong> Predictable menu structure across pages</li>
              <li><strong>Breadcrumbs:</strong> Clear indication of page location within site structure</li>
              <li><strong>Focus Indicators:</strong> Visible keyboard focus states for all interactive elements</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.2 Visual Design</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Color Contrast:</strong> Minimum 4.5:1 contrast ratio for normal text</li>
              <li><strong>Text Resizing:</strong> Content remains readable at 200% zoom</li>
              <li><strong>Color Independence:</strong> Information not conveyed by color alone</li>
              <li><strong>Responsive Design:</strong> Adapts to different screen sizes and orientations</li>
              <li><strong>Clear Typography:</strong> Readable fonts with appropriate spacing</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.3 Multimedia Content</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Alternative Text:</strong> Descriptive alt text for all images</li>
              <li><strong>Video Captions:</strong> Closed captions for video content</li>
              <li><strong>Audio Transcripts:</strong> Text alternatives for audio-only content</li>
              <li><strong>Controls:</strong> Accessible media player controls</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.4 Forms and Interactive Elements</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Form Labels:</strong> Clear, descriptive labels for all form fields</li>
              <li><strong>Error Messages:</strong> Clear identification and description of input errors</li>
              <li><strong>Required Fields:</strong> Clearly marked required form fields</li>
              <li><strong>Button Descriptions:</strong> Descriptive button text and ARIA labels</li>
              <li><strong>Keyboard Access:</strong> All interactive elements accessible via keyboard</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">3.5 Mobile Accessibility</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li><strong>Touch Targets:</strong> Minimum 44x44 pixel touch target size</li>
              <li><strong>Orientation Support:</strong> Works in portrait and landscape modes</li>
              <li><strong>Mobile Screen Readers:</strong> Compatible with VoiceOver (iOS) and TalkBack (Android)</li>
              <li><strong>Responsive Text:</strong> Adjusts to mobile screen sizes without horizontal scrolling</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Assistive Technology Compatibility</h2>
            <p className="text-foreground/80 mb-4">
              Our website is designed to work with the following assistive technologies:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>JAWS (Job Access With Speech) screen reader</li>
              <li>NVDA (NonVisual Desktop Access) screen reader</li>
              <li>VoiceOver (macOS and iOS)</li>
              <li>TalkBack (Android)</li>
              <li>Dragon NaturallySpeaking voice recognition software</li>
              <li>ZoomText screen magnification</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Third-Party Content</h2>
            <p className="text-foreground/80 mb-4">
              We make efforts to ensure that third-party content on our website (such as embedded videos, social media feeds, and advertising) is accessible. However, we may not have full control over the accessibility of third-party content.
            </p>
            <p className="text-foreground/80">
              We are committed to working with our vendors and partners to improve the accessibility of all content on our site.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Known Limitations</h2>
            <p className="text-foreground/80 mb-4">
              Despite our best efforts, some areas of our website may not yet be fully accessible. We are aware of the following limitations and are working to address them:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Some legacy PDF documents may not be fully accessible</li>
              <li>Third-party embedded content may have accessibility issues</li>
              <li>Some complex data visualizations may require alternative text descriptions</li>
            </ul>
            <p className="text-foreground/80">
              If you encounter any accessibility barriers, please let us know so we can work on improvements.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Feedback and Assistance</h2>
            <p className="text-foreground/80 mb-4">
              We welcome your feedback on the accessibility of our website. If you encounter accessibility barriers or need assistance:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Email us at: info@molitico.com</li>
              <li>Call us at: [Your Contact Number]</li>
              <li>Contact us via our <Link to="/contact" className="text-primary hover:underline">contact form</Link></li>
            </ul>
            <p className="text-foreground/80">
              We aim to respond to accessibility feedback within 2 business days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Accessibility Testing</h2>
            <p className="text-foreground/80 mb-4">
              We regularly test our website for accessibility using:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Automated accessibility testing tools (WAVE, axe DevTools)</li>
              <li>Manual testing with screen readers</li>
              <li>Keyboard-only navigation testing</li>
              <li>Color contrast analysis</li>
              <li>User testing with people with disabilities</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Alternative Formats</h2>
            <p className="text-foreground/80 mb-4">
              If you need website content in an alternative format, we can provide:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Large print documents</li>
              <li>Plain text versions</li>
              <li>Accessible PDFs</li>
              <li>Audio descriptions</li>
            </ul>
            <p className="text-foreground/80">
              Please contact us to request content in an alternative format.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Continuous Improvement</h2>
            <p className="text-foreground/80 mb-4">
              Accessibility is an ongoing effort. We are committed to:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Regular accessibility audits and updates</li>
              <li>Staff training on accessibility best practices</li>
              <li>Incorporating accessibility into our development process</li>
              <li>Monitoring new accessibility standards and technologies</li>
              <li>Engaging with the disability community for feedback</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Legal Compliance</h2>
            <p className="text-foreground/80 mb-4">
              We strive to comply with:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground/80 space-y-2">
              <li>Americans with Disabilities Act (ADA)</li>
              <li>Section 508 of the Rehabilitation Act</li>
              <li>Web Content Accessibility Guidelines (WCAG) 2.1 Level AA</li>
              <li>State and local accessibility requirements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">12. Contact Information</h2>
            <p className="text-foreground/80 mb-4">
              For accessibility questions, concerns, or to request accommodations:
            </p>
            <div className="bg-muted p-6 rounded-lg text-foreground/80">
              <p className="font-semibold mb-2">Molitico Accessibility Team</p>
              <p>Email: info@molitico.com</p>
              <p>Address: [Your Business Address]</p>
              <p>Phone: [Your Contact Number]</p>
              <p className="mt-4 text-sm">TTY/TDD: [Your TTY Number] (if available)</p>
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

export default Accessibility;
