import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SidebarLayout } from "./components/layout/SidebarLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { CompanyNew } from "./pages/CompanyNew";
import { CompanyDetail } from "./pages/CompanyDetail";
import { ReportWorkspace } from "./pages/ReportWorkspace";
import { ReportSummary } from "./pages/ReportSummary";
import PreviewExport from "./pages/PreviewExport";
import { FinancialStatements } from "./pages/FinancialStatements";
import { NotesPage } from "./pages/NotesPage";
import { ReclassificationReview } from "./pages/ReclassificationReview";
import { ValidationView } from "./pages/ValidationView";
import { CashFlowPage } from "./pages/CashFlowPage";
import { ReviewView } from "./pages/ReviewView";
import { AuditView } from "./pages/AuditView";
import { Settings } from "./pages/Settings";
import { LaunchChecklist } from "./pages/LaunchChecklist";
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
    <ProtectedRoute>
      <SidebarLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/companies/new" component={CompanyNew} />
          <Route path="/companies/:companyId" component={CompanyDetail} />
          <Route path="/reports/:reportId" component={ReportWorkspace} />
          <Route path="/reports/:reportId/statements" component={FinancialStatements} />
          <Route path="/reports/:reportId/notes" component={NotesPage} />
          <Route
            path="/reports/:reportId/reclassifications"
            component={ReclassificationReview}
          />
          <Route path="/reports/:reportId/cash-flow" component={CashFlowPage} />
          <Route path="/reports/:reportId/validation" component={ValidationView} />
          <Route path="/reports/:reportId/review" component={ReviewView} />
          <Route path="/reports/:reportId/audit" component={AuditView} />
          <Route path="/reports/:reportId/summary" component={ReportSummary} />
          <Route path="/reports/:reportId/preview" component={PreviewExport} />
          <Route path="/settings" component={Settings} />
          <Route path="/launch-checklist" component={LaunchChecklist} />
          <Route component={NotFound} />
        </Switch>
      </SidebarLayout>
    </ProtectedRoute>
  );
}

function AuthRedirect({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <AuthRedirect component={Login} />
      </Route>
      <Route path="/register">
        <AuthRedirect component={Register} />
      </Route>
      <Route component={AppRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
