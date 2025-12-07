import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AnalyticsAPI from '@/lib/analytics-api';
import type {
  AnalyticsOverview,
  UserAnalytics,
  ConversationAnalytics,
  DocumentAnalytics,
  SystemHealth,
  CostAnalytics
} from '@/lib/analytics-api';
import type { Environment } from '@/lib/environments';
import { ENVIRONMENTS, DEFAULT_ENVIRONMENT } from '@/lib/environments';
import { toast } from 'sonner';

interface AnalyticsContextType {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  loading: boolean;
  error: string | null;

  overview: AnalyticsOverview | null;
  users: UserAnalytics | null;
  conversations: ConversationAnalytics | null;
  documents: DocumentAnalytics | null;
  systemHealth: SystemHealth | null;
  costs: CostAnalytics | null;

  fetchOverview: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchConversations: () => Promise<void>;
  fetchDocuments: () => Promise<void>;
  fetchSystemHealth: () => Promise<void>;
  fetchCosts: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironmentState] = useState<Environment>(
    ENVIRONMENTS[DEFAULT_ENVIRONMENT]
  );
  const [api] = useState(() => new AnalyticsAPI(ENVIRONMENTS[DEFAULT_ENVIRONMENT]));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [users, setUsers] = useState<UserAnalytics | null>(null);
  const [conversations, setConversations] = useState<ConversationAnalytics | null>(null);
  const [documents, setDocuments] = useState<DocumentAnalytics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [costs, setCosts] = useState<CostAnalytics | null>(null);

  const setEnvironment = useCallback((env: Environment) => {
    setEnvironmentState(env);
    api.setEnvironment(env);
    toast.success(`Switched to ${env.name}`);
  }, [api]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOverview();
      setOverview(data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch overview';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserAnalytics();
      setUsers(data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch user analytics';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getConversationAnalytics();
      setConversations(data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch conversation analytics';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDocumentAnalytics();
      setDocuments(data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch document analytics';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchSystemHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSystemHealth();
      setSystemHealth(data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch system health';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCostAnalytics();
      setCosts(data);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch cost analytics';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const refreshAll = useCallback(async () => {
    toast.info('Refreshing all analytics...');
    await Promise.all([
      fetchOverview(),
      fetchUsers(),
      fetchConversations(),
      fetchDocuments(),
      fetchSystemHealth(),
      fetchCosts()
    ]);
    toast.success('Analytics refreshed');
  }, [fetchOverview, fetchUsers, fetchConversations, fetchDocuments, fetchSystemHealth, fetchCosts]);

  return (
    <AnalyticsContext.Provider
      value={{
        environment,
        setEnvironment,
        loading,
        error,
        overview,
        users,
        conversations,
        documents,
        systemHealth,
        costs,
        fetchOverview,
        fetchUsers,
        fetchConversations,
        fetchDocuments,
        fetchSystemHealth,
        fetchCosts,
        refreshAll
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within AnalyticsProvider');
  }
  return context;
}

// Alias for cleaner imports
export const useAnalytics = useAnalyticsContext;

export default AnalyticsContext;
