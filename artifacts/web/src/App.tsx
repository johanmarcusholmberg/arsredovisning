import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Layout } from "@/components/Layout";
import { RedirectToApp } from "@/components/RedirectToApp";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import DemoWorkspacePage from "@/pages/DemoWorkspacePage";
import PricingPage from "@/pages/PricingPage";
import PrivacyPage from "@/pages/legal/PrivacyPage";
import TermsPage from "@/pages/legal/TermsPage";
import SupportPage from "@/pages/legal/SupportPage";
import SecurityPage from "@/pages/legal/SecurityPage";
import ContactPage from "@/pages/legal/ContactPage";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login">
          <RedirectToApp to="/arsredovisningar/login" />
        </Route>
        <Route path="/signup">
          <RedirectToApp to="/arsredovisningar/register" />
        </Route>
        <Route path="/dashboard">
          <RedirectToApp to="/arsredovisningar/" />
        </Route>
        <Route path="/workspace/:rest*">
          <RedirectToApp to="/arsredovisningar/" />
        </Route>
        <Route path="/workspace">
          <RedirectToApp to="/arsredovisningar/" />
        </Route>
        <Route path="/demo/:section?" component={DemoWorkspacePage} />
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
