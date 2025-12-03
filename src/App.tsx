import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PageTransition } from "@/components/PageTransition";
import ScrollToTop from "@/components/ScrollToTop";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";
import BackToTop from "@/components/BackToTop";
import CookieConsent from "@/components/CookieConsent";
import MetaPixel from "@/components/MetaPixel";
import { ExitIntentPopup } from "@/components/ExitIntentPopup";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import Index from "./pages/Index";
import About from "./pages/About";
import Services from "./pages/Services";
import CaseStudies from "./pages/CaseStudies";
import CaseStudyDetail from "./pages/CaseStudyDetail";
import Contact from "./pages/Contact";
import CreativeShowcase from "./pages/CreativeShowcase";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import AdminClientView from "./pages/AdminClientView";
import ClientLogin from "./pages/ClientLogin";
import ClientDashboard from "./pages/ClientDashboard";
import ClientDashboardCustom from "./pages/ClientDashboardCustom";
import { Navigate } from "react-router-dom";
import ClientWatchlist from "./pages/ClientWatchlist";
import ClientAlerts from "./pages/ClientAlerts";
import ClientActions from "./pages/ClientActions";
import ClientOpportunities from "./pages/ClientOpportunities";
import PollingIntelligence from "./pages/PollingIntelligence";
import ClientDemographics from "./pages/ClientDemographics";
import ClientDonorJourney from "./pages/ClientDonorJourney";
import ClientProfile from "./pages/ClientProfile";
import ClientPollingAlerts from "./pages/ClientPollingAlerts";
import ClientSettings from "./pages/ClientSettings";
import ClientIntelligence from "./pages/ClientIntelligence";
import BillDetail from "./pages/BillDetail";
import Settings from "./pages/Settings";
import Install from "./pages/Install";
import AccessDenied from "./pages/AccessDenied";

import { ImpersonationProvider } from "@/contexts/ImpersonationContext";

const queryClient = new QueryClient();

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
          {/* News, Bills, Analytics, and Bookmarks moved to admin dashboard */}
          <Route path="/bills/:billNumber" element={<BillDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/install" element={<Install />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/client-view/:organizationId" element={<AdminClientView />} />
          <Route path="/client-login" element={<ClientLogin />} />
          <Route path="/client/dashboard" element={<ClientDashboard />} />
          <Route path="/client/dashboard/custom" element={<ClientDashboardCustom />} />
          {/* Redirect legacy portal route to consolidated dashboard */}
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
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
