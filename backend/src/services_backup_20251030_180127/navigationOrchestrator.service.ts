/**
 * Navigation Orchestrator Service - Minimal Stub  
 * Delegates to navigation.service
 */
import navigationService from './navigation.service';

class NavigationOrchestratorService {
  async orchestrate(query: string, userId: string) {
    // Simple pass-through to navigation service
    return await navigationService.findFiles(query, userId);
  }
}

export default new NavigationOrchestratorService();
