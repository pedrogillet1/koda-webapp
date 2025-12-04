/**
 * Multi-Environment Configuration
 */

export interface Environment {
  id: string;
  name: string;
  apiUrl: string;
  color: string;
  icon: string;
  description: string;
}

export const ENVIRONMENTS: Record<string, Environment> = {
  localhost: {
    id: 'localhost',
    name: 'Development',
    apiUrl: '/api',  // Use proxy in development
    color: '#3B82F6',
    icon: '💻',
    description: 'Local development environment'
  },
  production: {
    id: 'production',
    name: 'Production',
    apiUrl: 'https://api.getkoda.ai/api',
    color: '#10B981',
    icon: '🚀',
    description: 'Live production environment'
  }
};

export const DEFAULT_ENVIRONMENT = 'localhost';

export function getEnvironment(id: string): Environment {
  return ENVIRONMENTS[id] || ENVIRONMENTS[DEFAULT_ENVIRONMENT];
}

export function getAllEnvironments(): Environment[] {
  return Object.values(ENVIRONMENTS);
}
