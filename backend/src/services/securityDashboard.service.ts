/** Security Dashboard Service - Minimal Stub (Non-MVP) */
class SecurityDashboardService {
  async getMetrics() { return {}; }
  async getAlerts() { return []; }
  async getSecurityOverview(_hours?: number) { return {}; }
  async getSecurityTrends(_days?: number) { return {}; }
  async getSecurityInsights() { return [] as any[]; }
  async getComplianceReport() { return {}; }
  async getRealtimeStatus() { return {}; }
}
export default new SecurityDashboardService();
