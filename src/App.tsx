import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PortalRoot } from "@/components/PortalRoot";
import { PageTransition } from "@/components/PageTransition";
import ScrollToTop from "@/components/ScrollToTop";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";
import BackToTop from "@/components/BackToTop";
import CookieConsent from "@/components/CookieConsent";
import MetaPixel from "@/components/MetaPixel";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { MaintenanceProvider } from "@/contexts/MaintenanceContext";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Eagerly loaded pages (critical path)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy loaded pages for better performance
const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const CaseStudies = lazy(() => import("./pages/CaseStudies"));
const CaseStudyDetail = lazy(() => import("./pages/CaseStudyDetail"));
const Contact = lazy(() => import("./pages/Contact"));
const CreativeShowcase = lazy(() => import("./pages/CreativeShowcase"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Auth = lazy(() => import("./pages/Auth"));
const Settings = lazy(() => import("./pages/Settings"));
const Install = lazy(() => import("./pages/Install"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const BillDetail = lazy(() => import("./pages/BillDetail"));
const MetaOAuthCallback = lazy(() => import("./pages/MetaOAuthCallback"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const Redirect = lazy(() => import("./pages/Redirect"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Login = lazy(() => import("./pages/Login"));
const Experience = lazy(() => import("./pages/Experience"));
const GetStarted = lazy(() => import("./pages/GetStarted"));
const Polls = lazy(() => import("./pages/Polls"));
const PollDetail = lazy(() => import("./pages/PollDetail"));

// Admin pages (lazy loaded - larger bundle)
const Admin = lazy(() => import("./pages/Admin"));
const AdminClientView = lazy(() => import("./pages/AdminClientView"));
const UserDetail = lazy(() => import("./pages/admin/UserDetail"));
const DashboardHealth = lazy(() => import("./pages/admin/DashboardHealth"));
const OrganizationDetail = lazy(() => import("./pages/admin/OrganizationDetail"));
const ContactSubmissions = lazy(() => import("./pages/admin/ContactSubmissions"));
const VoterImpactMap = lazy(() => import("./pages/admin/VoterImpactMap"));
const AdminAdCopyStudio = lazy(() => import("./pages/AdminAdCopyStudio"));
const FunnelInsights = lazy(() => import("./pages/admin/FunnelInsights"));
const Profile = lazy(() => import("./pages/Profile"));

// Client portal pages (lazy loaded)
const ClientLogin = lazy(() => import("./pages/ClientLogin"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const ClientWatchlist = lazy(() => import("./pages/ClientWatchlist"));
const ClientAlerts = lazy(() => import("./pages/ClientAlerts"));
const ClientActions = lazy(() => import("./pages/ClientActions"));
const ClientOpportunities = lazy(() => import("./pages/ClientOpportunities"));
const PollingIntelligence = lazy(() => import("./pages/PollingIntelligence"));
const ClientDemographics = lazy(() => import("./pages/ClientDemographics"));
const ClientDonorJourney = lazy(() => import("./pages/ClientDonorJourney"));
const ClientProfile = lazy(() => import("./pages/ClientProfile"));
const ClientPollingAlerts = lazy(() => import("./pages/ClientPollingAlerts"));
const ClientSettings = lazy(() => import("./pages/ClientSettings"));
const ClientMediaIntelligence = lazy(() => import("./pages/ClientIntelligence"));
const ClientDonorIntelligence = lazy(() => import("./pages/ClientDonorIntelligence"));
const ClientCreativeIntelligence = lazy(() => import("./pages/ClientCreativeIntelligence"));
const ClientCreativeIntelligenceV2 = lazy(() => import("./pages/ClientCreativeIntelligenceV2"));
const ClientABTests = lazy(() => import("./pages/ClientABTests"));
const ClientRecurringHealth = lazy(() => import("./pages/ClientRecurringHealth"));
const ClientNewsTrends = lazy(() => import("./pages/ClientNewsTrends"));
const ClientAdPerformance = lazy(() => import("./pages/ClientAdPerformance"));
const ClientLinkTracking = lazy(() => import("./pages/ClientLinkTracking"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <LoadingSpinner size="lg" />
  </div>
);

// Lightweight skeleton for Experience route — matches dark page aesthetic for seamless transition
const ExperienceSkeleton = () => (
  <div className="min-h-screen bg-[#0a0f1a]" />
);

// Domain-aware router for subdomain architecture
// Handles redirects between molitico.com (marketing) and portal.molitico.com (app)
const DomainRouter = () => {
  const location = useLocation();
  const hostname = window.location.hostname;
  
  const isPortalDomain = hostname === 'portal.molitico.com';
  const isMarketingDomain = hostname === 'molitico.com' || 
                            hostname === 'www.molitico.com';
  
  // For preview/localhost, allow all routes without redirects
  const isDevelopment = hostname.includes('preview') || 
                        hostname.includes('lovable.app') ||
                        hostname === 'localhost';
  
  if (isDevelopment) {
    return null; // No redirects in development/preview
  }
  
  // Marketing routes (public pages) - note: '/' handled separately on portal
  const marketingRoutes = ['/about', '/services', '/case-studies', 
    '/blog', '/contact', '/privacy-policy', '/creative-showcase', '/bills', '/experience', '/get-started', '/polls'];
  
  // Portal route prefixes (app pages)
  const portalPrefixes = ['/client', '/admin', '/accept-invite', 
    '/reset-password', '/forgot-password', '/login', '/auth', '/profile', '/settings',
    '/access-denied', '/client-login'];
  
  const isMarketingRoute = marketingRoutes.some(route => 
    location.pathname === route || 
    location.pathname.startsWith('/case-studies/') ||
    location.pathname.startsWith('/blog/') ||
    location.pathname.startsWith('/bills/') ||
    location.pathname.startsWith('/polls/')
  );
  
  const isPortalRoute = portalPrefixes.some(prefix => 
    location.pathname.startsWith(prefix)
  );

  // PORTAL DOMAIN LOGIC - synchronous redirects
  if (isPortalDomain) {
    // Root path → redirect to client login immediately
    if (location.pathname === '/') {
      return <Navigate to="/client-login" replace />;
    }
    
    // Marketing routes on portal → redirect to marketing domain
    if (isMarketingRoute) {
      window.location.replace(`https://molitico.com${location.pathname}`);
      return null;
    }
  }
  
  // MARKETING DOMAIN LOGIC
  if (isMarketingDomain) {
    // Portal routes on marketing → redirect to portal subdomain
    if (isPortalRoute) {
      window.location.replace(`https://portal.molitico.com${location.pathname}${location.search}`);
      return null;
    }
  }

  return null;
};

const AppContent = () => {
  useSmoothScroll();
  const location = useLocation();
  const isPublicPage = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/client') && location.pathname !== '/experience';
  
  return (
    <>
      <DomainRouter />
      <ScrollProgressIndicator />
      <ScrollToTop />
      <BackToTop />
      <CookieConsent />
      <MetaPixel />
      {isPublicPage && <ExitIntentPopup />}
      <PageTransition>
        <Suspense fallback={location.pathname === "/experience" ? <ExperienceSkeleton /> : <PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/r/:org/:form" element={<Redirect />} />
            <Route path="/r" element={<Redirect />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/case-studies" element={<CaseStudies />} />
            <Route path="/case-studies/:id" element={<CaseStudyDetail />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/creative-showcase" element={<CreativeShowcase />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/experience" element={<Experience />} />
            <Route path="/get-started" element={<GetStarted />} />
            <Route path="/polls" element={<Polls />} />
            <Route path="/polls/:slug" element={<PollDetail />} />
            <Route path="/bills/:billNumber" element={<BillDetail />} />
            <Route path="/meta-oauth-callback" element={<MetaOAuthCallback />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/install" element={<Install />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login" element={<Login />} />
            <Route path="/accept-invite" element={<AcceptInvitation />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/users/:userId" element={<UserDetail />} />
            <Route path="/admin/organizations/:organizationId" element={<OrganizationDetail />} />
            <Route path="/admin/contacts" element={<ContactSubmissions />} />
            <Route path="/admin/client-view/:organizationId" element={<AdminClientView />} />
            <Route path="/admin/health" element={<DashboardHealth />} />
            <Route path="/admin/voter-impact-map" element={<VoterImpactMap />} />
            <Route path="/admin/ad-copy-studio" element={<AdminAdCopyStudio />} />
            <Route path="/admin/funnel-insights" element={<FunnelInsights />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/client-login" element={<ClientLogin />} />
            <Route path="/client/dashboard" element={<ClientDashboard />} />
            <Route path="/client/portal" element={<Navigate to="/client/dashboard" replace />} />
            <Route path="/client-portal" element={<Navigate to="/client/dashboard" replace />} />
            {/* Redirect deprecated custom dashboard route */}
            <Route path="/client/dashboard/custom" element={<Navigate to="/client/dashboard" replace />} />
            <Route path="/client/watchlist" element={<ClientWatchlist />} />
            <Route path="/client/alerts" element={<ClientAlerts />} />
            <Route path="/client/actions" element={<ClientActions />} />
            <Route path="/client/opportunities" element={<ClientOpportunities />} />
            <Route path="/client/polling" element={<PollingIntelligence />} />
            <Route path="/client/demographics" element={<ClientDemographics />} />
            <Route path="/client/journey" element={<ClientDonorJourney />} />
            <Route path="/client/profile" element={<ClientProfile />} />
            <Route path="/client/polling-alerts" element={<ClientPollingAlerts />} />
            <Route path="/client/settings" element={<ClientSettings />} />
            <Route path="/client/intelligence" element={<Navigate to="/client/media-intelligence" replace />} />
            <Route path="/client/media-intelligence" element={<ClientMediaIntelligence />} />
            <Route path="/client/donor-intelligence" element={<ClientDonorIntelligence />} />
            <Route path="/client/creative-intelligence" element={<ClientCreativeIntelligence />} />
            <Route path="/client/creative-intelligence-v2" element={<ClientCreativeIntelligenceV2 />} />
            <Route path="/client/attribution" element={<Navigate to="/client/journey" replace />} />
            <Route path="/client/ab-tests" element={<ClientABTests />} />
            <Route path="/client/recurring-health" element={<ClientRecurringHealth />} />
            <Route path="/client/news-trends" element={<ClientNewsTrends />} />
            <Route path="/client/ad-performance" element={<ClientAdPerformance />} />
            <Route path="/client/link-tracking" element={<ClientLinkTracking />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PageTransition>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="molitico-ui-theme">
      {/* Global portal root - MUST be inside ThemeProvider for CSS variable inheritance */}
      <PortalRoot />
      <MaintenanceProvider>
        <ImpersonationProvider>
          <TooltipProvider>
            <MaintenanceBanner />
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </ImpersonationProvider>
      </MaintenanceProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
