import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { SidebarLayout } from "./components/layout/SidebarLayout";
import { Dashboard } from "./pages/Dashboard";
import { CompanyNew } from "./pages/CompanyNew";
import { CompanyDetail } from "./pages/CompanyDetail";
import { ReportWorkspace } from "./pages/ReportWorkspace";
import { ReportSummary } from "./pages/ReportSummary";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  }
});

function AppRoutes() {
  return (
    <SidebarLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/companies/new" component={CompanyNew} />
        <Route path="/companies/:companyId" component={CompanyDetail} />
        <Route path="/reports/:reportId" component={ReportWorkspace} />
        <Route path="/reports/:reportId/summary" component={ReportSummary} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </SidebarLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route component={AppRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
