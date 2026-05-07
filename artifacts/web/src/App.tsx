import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Layout } from "@/components/Layout";
import { RedirectToApp } from "@/components/RedirectToApp";
import {
  getProductAppUrl,
  getProductLoginUrl,
  getProductRegisterUrl,
} from "@/lib/productAppUrl";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import PublicDemoPage from "@/pages/PublicDemoPage";
import AdminDemoEnvironment from "@/pages/admin/AdminDemoEnvironment";
import PricingPage from "@/pages/PricingPage";
import PrivacyPage from "@/pages/legal/PrivacyPage";
import TermsPage from "@/pages/legal/TermsPage";
import SupportPage from "@/pages/legal/SupportPage";
import SecurityPage from "@/pages/legal/SecurityPage";
import ContactPage from "@/pages/legal/ContactPage";

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <Layout>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login">
          <RedirectToApp to={getProductLoginUrl()} />
        </Route>
        <Route path="/signup">
          <RedirectToApp to={getProductRegisterUrl()} />
        </Route>
        <Route path="/dashboard">
          <RedirectToApp to={getProductAppUrl()} />
        </Route>
        <Route path="/workspace/:rest*">
          <RedirectToApp to={getProductAppUrl()} />
        </Route>
        <Route path="/workspace">
          <RedirectToApp to={getProductAppUrl()} />
        </Route>
        <Route path="/demo" component={PublicDemoPage} />
        <Route path="/admin/demo-environment/:section?" component={AdminDemoEnvironment} />
        <Route path="/admin/demo-environment" component={AdminDemoEnvironment} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/security" component={SecurityPage} />
        <Route path="/contact" component={ContactPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
