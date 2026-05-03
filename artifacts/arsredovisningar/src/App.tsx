import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarLayout } from "./components/layout/SidebarLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequirePaid } from "./components/RequirePaid";
import { Dashboard } from "./pages/Dashboard";
import { Companies } from "./pages/Companies";
import { CompanyNew } from "./pages/CompanyNew";
import { CompanyEdit } from "./pages/CompanyEdit";
import { CompanyDetail } from "./pages/CompanyDetail";
import { Upgrade } from "./pages/Upgrade";
import { Admin } from "./pages/Admin";
import { ReportWorkspace } from "./pages/ReportWorkspace";
import { ReportSummary } from "./pages/ReportSummary";
import { ImportPage } from "./pages/ImportPage";
import { MappingPage } from "./pages/MappingPage";
import { NotesPage } from "./pages/NotesPage";
import { ReclassificationReview } from "./pages/ReclassificationReview";
import { ValidationView } from "./pages/ValidationView";
import { CashFlowPage } from "./pages/CashFlowPage";
import { ReviewView } from "./pages/ReviewView";
import { Settings } from "./pages/Settings";
import { LaunchChecklist } from "./pages/LaunchChecklist";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import NotFound from "@/pages/not-found";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Code-split heavy pages (P3-3) ──────────────────────────────────────────
// Pages with large dependency trees (PDF preview, full statements grid,
// audit timeline, recovery flow) get loaded only when their route is hit.
const PreviewExport = lazy(() => import("./pages/PreviewExport"));
const FinancialStatements = lazy(() =>
  import("./pages/FinancialStatements").then((m) => ({
    default: m.FinancialStatements,
  })),
);
const AuditView = lazy(() =>
  import("./pages/AuditView").then((m) => ({ default: m.AuditView })),
);
const ResetPassword = lazy(() =>
  import("./pages/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  }
});

function PageFallback() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function AppRoutes() {
  return (
    <ProtectedRoute>
      <SidebarLayout>
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/upgrade" component={Upgrade} />
            <Route path="/admin" component={Admin} />
            <Route path="/companies" component={Companies} />
            <Route path="/companies/new">
              <RequirePaid><CompanyNew /></RequirePaid>
            </Route>
            <Route path="/companies/:companyId/edit">
              <RequirePaid><CompanyEdit /></RequirePaid>
            </Route>
            <Route path="/companies/:companyId">
              <RequirePaid><CompanyDetail /></RequirePaid>
            </Route>
            {/* All real /reports/:reportId/* routes are gated. The reportId
                path param maps to a project on the server; we gate by
                "user is paid in general" here and let the API enforce
                per-project ownership (which produces 402 / 404 with
                content-aware redirects in each page). */}
            <Route path="/reports/:reportId">
              <RequirePaid><ReportWorkspace /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/import">
              <RequirePaid><ImportPage /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/mapping">
              <RequirePaid><MappingPage /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/statements">
              <RequirePaid><FinancialStatements /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/notes">
              <RequirePaid><NotesPage /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/reclassifications">
              <RequirePaid><ReclassificationReview /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/cash-flow">
              <RequirePaid><CashFlowPage /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/validation">
              <RequirePaid><ValidationView /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/review">
              <RequirePaid><ReviewView /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/audit">
              <RequirePaid><AuditView /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/summary">
              <RequirePaid><ReportSummary /></RequirePaid>
            </Route>
            <Route path="/reports/:reportId/preview">
              <RequirePaid><PreviewExport /></RequirePaid>
            </Route>
            <Route path="/settings" component={Settings} />
            <Route path="/launch-checklist" component={LaunchChecklist} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
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
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/login">
          <AuthRedirect component={Login} />
        </Route>
        <Route path="/register">
          <AuthRedirect component={Register} />
        </Route>
        <Route path="/forgot-password">
          <AuthRedirect component={ForgotPassword} />
        </Route>
        {/* Recovery landing page: do NOT bounce away on auth — the magic
            link itself creates a session, and the page needs that session
            to call updateUser. */}
        <Route path="/reset-password" component={ResetPassword} />
        <Route component={AppRoutes} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ErrorBoundary>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <Router />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </ErrorBoundary>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
