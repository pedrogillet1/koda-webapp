/** Security Monitoring Service - Minimal Stub (Non-MVP) */

export enum SecurityEventType {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  BRUTE_FORCE = 'BRUTE_FORCE',
  SUSPICIOUS_IP = 'SUSPICIOUS_IP',
  SUSPICIOUS_IP_BEHAVIOR = 'SUSPICIOUS_IP_BEHAVIOR',
}

export enum ThreatLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

class SecurityMonitoringService {
  async logEvent(event: string, data: any) { return true; }
  async getEvents() { return []; }
  async recordSecurityEvent(data: any) { return true; }
  async getRecentSecurityEvents(limit?: number) { return []; }
  async getSecurityMetrics() { return {}; }
  async detectBruteForce(userId: string) { return false; }
  async detectMassDownload(userId: string) { return false; }
  async detectSuspiciousIP(ip: string) { return false; }
  async detectUnauthorizedAccess(userId: string, resource: string) { return false; }
}
export default new SecurityMonitoringService();
