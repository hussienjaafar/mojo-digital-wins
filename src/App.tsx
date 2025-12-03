import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PageTransition } from "@/components/PageTransition";
import ScrollToTop from "@/components/ScrollToTop";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";
import BackToTop from "@/components/BackToTop";
import CookieConsent from "@/components/CookieConsent";
import MetaPixel from "@/components/MetaPixel";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
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

// Admin pages (lazy loaded - larger bundle)
const Admin = lazy(() => import("./pages/Admin"));
const AdminClientView = lazy(() => import("./pages/AdminClientView"));

// Client portal pages (lazy loaded)
const ClientLogin = lazy(() => import("./pages/ClientLogin"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const ClientDashboardCustom = lazy(() => import("./pages/ClientDashboardCustom"));
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
const ClientIntelligence = lazy(() => import("./pages/ClientIntelligence"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <LoadingSpinner size="lg" />
  </div>
);

const AppContent = () => {
  useSmoothScroll();
  const location = useLocation();
  const isPublicPage = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/client');
  
  return (
    <>
      <ScrollProgressIndicator />
      <ScrollToTop />
      <BackToTop />
      <CookieConsent />
      <MetaPixel />
      {isPublicPage && <ExitIntentPopup />}
      <PageTransition>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/case-studies" element={<CaseStudies />} />
            <Route path="/case-studies/:id" element={<CaseStudyDetail />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/creative-showcase" element={<CreativeShowcase />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/bills/:billNumber" element={<BillDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/install" element={<Install />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/client-view/:organizationId" element={<AdminClientView />} />
            <Route path="/client-login" element={<ClientLogin />} />
            <Route path="/client/dashboard" element={<ClientDashboard />} />
            <Route path="/client/dashboard/custom" element={<ClientDashboardCustom />} />
            <Route path="/client/portal" element={<Navigate to="/client/dashboard" replace />} />
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
            <Route path="/client/intelligence" element={<ClientIntelligence />} />
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
      <ImpersonationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </ImpersonationProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
