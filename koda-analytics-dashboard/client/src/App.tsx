import { Route, Switch, Redirect } from 'wouter';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { EnvironmentProvider } from '@/contexts/EnvironmentContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AnalyticsProvider, useAnalytics } from '@/contexts/AnalyticsContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DashboardLayout } from '@/components/DashboardLayout';

// Pages
import Login from '@/pages/Login';
import Overview from '@/pages/Overview';
import UsersPage from '@/pages/Users';
import ConversationsPage from '@/pages/Conversations';
import DocumentsPage from '@/pages/Documents';
import SystemHealthPage from '@/pages/SystemHealth';
import CostsPage from '@/pages/Costs';
import RealtimePage from '@/pages/Realtime';
import NotFound from '@/pages/NotFound';

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

// Public Route - redirects to dashboard if already authenticated
function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

// Dashboard Router with Analytics Context
function DashboardRouter() {
  const { environment, setEnvironment, refreshAll } = useAnalytics();

  return (
    <DashboardLayout
      currentEnvironment={environment}
      onEnvironmentChange={setEnvironment}
      onRefresh={refreshAll}
    >
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/users" component={UsersPage} />
        <Route path="/conversations" component={ConversationsPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/system" component={SystemHealthPage} />
        <Route path="/costs" component={CostsPage} />
        <Route path="/realtime" component={RealtimePage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={Login} />
      </Route>
      <Route>
        <ProtectedRoute component={DashboardRouter} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <EnvironmentProvider>
            <AuthProvider>
              <AnalyticsProvider>
                <AppRoutes />
              </AnalyticsProvider>
            </AuthProvider>
          </EnvironmentProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
