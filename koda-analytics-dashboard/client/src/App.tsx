import { Route, Switch, Redirect } from 'wouter';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { EnvironmentProvider } from '@/contexts/EnvironmentContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';

// Pages
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
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

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={Login} />
      </Route>
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UsersPage} />
      </Route>
      <Route path="/conversations">
        <ProtectedRoute component={ConversationsPage} />
      </Route>
      <Route path="/documents">
        <ProtectedRoute component={DocumentsPage} />
      </Route>
      <Route path="/system-health">
        <ProtectedRoute component={SystemHealthPage} />
      </Route>
      <Route path="/costs">
        <ProtectedRoute component={CostsPage} />
      </Route>
      <Route path="/realtime">
        <ProtectedRoute component={RealtimePage} />
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <EnvironmentProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </EnvironmentProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
