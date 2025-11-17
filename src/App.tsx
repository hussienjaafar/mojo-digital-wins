import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
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
import ClientPortal from "./components/client/ClientPortal";
import News from "./pages/News";
import Bills from "./pages/Bills";
import BillDetail from "./pages/BillDetail";
import Bookmarks from "./pages/Bookmarks";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Install from "./pages/Install";

const queryClient = new QueryClient();

const AppContent = () => {
  useSmoothScroll();
  
  return (
    <>
      <ScrollProgressIndicator />
      <ScrollToTop />
      <BackToTop />
      <CookieConsent />
      <MetaPixel />
      <ExitIntentPopup />
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
        <Route path="/news" element={<News />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/bills/:billNumber" element={<BillDetail />} />
        <Route path="/bookmarks" element={<Bookmarks />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/install" element={<Install />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/client-view/:organizationId" element={<AdminClientView />} />
        <Route path="/client-login" element={<ClientLogin />} />
        <Route path="/client/dashboard" element={<ClientDashboard />} />
        <Route path="/client/dashboard/custom" element={<ClientDashboardCustom />} />
        <Route path="/client/portal" element={<ClientPortal />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="molitico-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
