import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AnalyticsAPI from '@/lib/analytics-api';
import { Environment, getEnvironment, DEFAULT_ENVIRONMENT } from '@/lib/environments';

interface EnvironmentContextType {
  currentEnvironment: Environment;
  apiClient: AnalyticsAPI;
  switchEnvironment: (environmentId: string) => void;
  setAuthToken: (token: string) => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [currentEnvironment, setCurrentEnvironment] = useState<Environment>(() =>
    getEnvironment(localStorage.getItem('analytics_environment') || DEFAULT_ENVIRONMENT)
  );

  const [apiClient] = useState(() => new AnalyticsAPI(currentEnvironment));

  const switchEnvironment = useCallback((environmentId: string) => {
    const newEnv = getEnvironment(environmentId);
    setCurrentEnvironment(newEnv);
    apiClient.setEnvironment(newEnv);
    localStorage.setItem('analytics_environment', environmentId);
  }, [apiClient]);

  const setAuthToken = useCallback((token: string) => {
    apiClient.setAuthToken(token);
    localStorage.setItem('analytics_token', token);
  }, [apiClient]);

  // Restore token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('analytics_token');
    if (savedToken) {
      setAuthToken(savedToken);
    }
  }, [setAuthToken]);

  return (
    <EnvironmentContext.Provider value={{
      currentEnvironment,
      apiClient,
      switchEnvironment,
      setAuthToken
    }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }
  return context;
}
