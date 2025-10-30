/** Security Monitoring Service - Minimal Stub (Non-MVP) */
class SecurityMonitoringService {
  async logEvent(event: string, data: any) { return true; }
  async getEvents() { return []; }
}
export default new SecurityMonitoringService();
