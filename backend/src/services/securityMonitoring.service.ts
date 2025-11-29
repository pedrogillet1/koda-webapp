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
  async logEvent(_event: string, _data: any) { return true; }
  async getEvents() { return []; }
  async recordSecurityEvent(_data: any) { return true; }
  async getRecentSecurityEvents(_limit?: number) { return []; }
  async getSecurityMetrics(_hours?: number) { return {}; }
  async detectBruteForce(_userId: string, _ipAddress?: string) {
    return { detected: false, threatLevel: ThreatLevel.LOW };
  }
  async detectMassDownload(_userId: string, _ipAddress?: string) {
    return { detected: false, threatLevel: ThreatLevel.LOW };
  }
  async detectSuspiciousIP(_ip: string) {
    return { detected: false, threatLevel: ThreatLevel.LOW };
  }
  async detectUnauthorizedAccess(_userId: string, _resource?: string) {
    return { detected: false, threatLevel: ThreatLevel.LOW };
  }
  async addToBlacklist(_ip: string, _reason: string, _durationHours?: number) {
    return { success: true };
  }
  async removeFromBlacklist(_ip: string) {
    return { success: true };
  }
  async getBlacklist() {
    return [];
  }
  async getSuspiciousLogins(_userId: string, _limit?: number) {
    return [];
  }
  async getSecurityScoreForUser(_userId: string) {
    return { score: 100, factors: [] };
  }
  async getSecurityAlerts(_userId?: string) {
    return [];
  }
}
export default new SecurityMonitoringService();
