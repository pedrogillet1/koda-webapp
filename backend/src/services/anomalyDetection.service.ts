import { PrismaClient } from '@prisma/client';
import securityMonitoringService, { SecurityEventType, ThreatLevel } from './securityMonitoring.service';
import securityAlertingService from './securityAlerting.service';

const prisma = new PrismaClient();

/**
 * Anomaly Detection Service
 *
 * Machine learning-inspired behavioral analysis:
 * - User behavior profiling
 * - Statistical anomaly detection
 * - Time-series analysis
 * - Geolocation anomaly detection
 * - Access pattern analysis
 * - Velocity checks
 */

interface UserProfile {
  userId: string;
  normalLoginTimes: number[]; // Hours of day (0-23)
  normalLocations: string[]; // City/Country codes
  normalDevices: string[]; // Device fingerprints
  averageSessionDuration: number; // Minutes
  typicalAccessPatterns: string[]; // Resource access patterns
  loginFrequency: number; // Logins per day
  lastUpdated: Date;
}

interface AnomalyScore {
  overall: number; // 0-100
  factors: {
    time: number;
    location: number;
    device: number;
    velocity: number;
    accessPattern: number;
  };
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface BehaviorEvent {
  userId: string;
  eventType: string;
  timestamp: Date;
  ipAddress: string;
  location?: {
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  device: string;
  userAgent: string;
  metadata?: any;
}

class AnomalyDetectionService {
  private userProfiles: Map<string, UserProfile> = new Map();
  private readonly ANOMALY_THRESHOLD = 70; // Score above this triggers alert
  private readonly PROFILE_UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Analyze event for anomalies
   */
  async analyzeEvent(event: BehaviorEvent): Promise<AnomalyScore> {
    try {
      // Get or create user profile
      let profile = await this.getUserProfile(event.userId);
      if (!profile) {
        profile = await this.createUserProfile(event.userId);
      }

      // Calculate anomaly scores for each factor
      const scores = {
        time: this.calculateTimeAnomaly(event, profile),
        location: this.calculateLocationAnomaly(event, profile),
        device: this.calculateDeviceAnomaly(event, profile),
        velocity: await this.calculateVelocityAnomaly(event, profile),
        accessPattern: this.calculateAccessPatternAnomaly(event, profile),
      };

      // Calculate weighted overall score
      const weights = {
        time: 0.15,
        location: 0.25,
        device: 0.20,
        velocity: 0.25,
        accessPattern: 0.15,
      };

      const overall =
        scores.time * weights.time +
        scores.location * weights.location +
        scores.device * weights.device +
        scores.velocity * weights.velocity +
        scores.accessPattern * weights.accessPattern;

      const isAnomaly = overall >= this.ANOMALY_THRESHOLD;
      const severity = this.determineSeverity(overall);

      const anomalyScore: AnomalyScore = {
        overall,
        factors: scores,
        isAnomaly,
        severity,
      };

      // If anomaly detected, create security event
      if (isAnomaly) {
        await this.handleAnomalyDetected(event, anomalyScore);
      }

      // Update profile with normal behavior (if not anomalous)
      if (!isAnomaly) {
        await this.updateUserProfile(event, profile);
      }

      return anomalyScore;
    } catch (error) {
      console.error('Error analyzing event for anomalies:', error);
      return {
        overall: 0,
        factors: { time: 0, location: 0, device: 0, velocity: 0, accessPattern: 0 },
        isAnomaly: false,
        severity: 'low',
      };
    }
  }

  /**
   * Get user behavioral profile
   */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Check cache
    if (this.userProfiles.has(userId)) {
      const profile = this.userProfiles.get(userId)!;
      // Refresh if stale
      if (Date.now() - profile.lastUpdated.getTime() < this.PROFILE_UPDATE_INTERVAL) {
        return profile;
      }
    }

    // Build profile from historical data
    return await this.buildUserProfile(userId);
  }

  /**
   * Build user profile from historical data
   */
  private async buildUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Get last 30 days of sessions
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sessions = await prisma.session.findMany({
        where: {
          userId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      });

      if (sessions.length < 5) {
        return null; // Not enough data to build profile
      }

      // Extract login times (hour of day)
      const loginHours = sessions.map((s) => s.createdAt.getHours());
      const normalLoginTimes = this.findMostFrequent(loginHours, 3);

      // Extract locations
      const locations = sessions
        .map((s) => {
          if (s.city && s.country) {
            return `${s.city},${s.country}`;
          }
          return null;
        })
        .filter(Boolean) as string[];
      const normalLocations = this.findMostFrequent(locations, 3);

      // Extract devices
      const devices = sessions.map((s) => s.deviceId || 'unknown');
      const normalDevices = this.findMostFrequent(devices, 3);

      // Calculate average session duration
      const durations = sessions
        .filter((s) => s.lastActivityAt)
        .map((s) => {
          const duration = s.lastActivityAt!.getTime() - s.createdAt.getTime();
          return duration / (1000 * 60); // Convert to minutes
        });
      const averageSessionDuration =
        durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 30;

      // Login frequency
      const loginFrequency = sessions.length / 30; // Per day

      const profile: UserProfile = {
        userId,
        normalLoginTimes,
        normalLocations,
        normalDevices,
        averageSessionDuration,
        typicalAccessPatterns: [],
        loginFrequency,
        lastUpdated: new Date(),
      };

      // Cache profile
      this.userProfiles.set(userId, profile);

      return profile;
    } catch (error) {
      console.error('Error building user profile:', error);
      return null;
    }
  }

  /**
   * Create initial user profile
   */
  private async createUserProfile(userId: string): Promise<UserProfile> {
    const profile: UserProfile = {
      userId,
      normalLoginTimes: [],
      normalLocations: [],
      normalDevices: [],
      averageSessionDuration: 30,
      typicalAccessPatterns: [],
      loginFrequency: 1,
      lastUpdated: new Date(),
    };

    this.userProfiles.set(userId, profile);
    return profile;
  }

  /**
   * Calculate time-based anomaly score
   */
  private calculateTimeAnomaly(event: BehaviorEvent, profile: UserProfile): number {
    if (profile.normalLoginTimes.length === 0) return 0;

    const eventHour = event.timestamp.getHours();
    const isNormalTime = profile.normalLoginTimes.some(
      (hour) => Math.abs(hour - eventHour) <= 2
    );

    return isNormalTime ? 0 : 60;
  }

  /**
   * Calculate location-based anomaly score
   */
  private calculateLocationAnomaly(event: BehaviorEvent, profile: UserProfile): number {
    if (profile.normalLocations.length === 0) return 0;
    if (!event.location) return 30; // No location data

    const eventLocation = `${event.location.city},${event.location.country}`;
    const isNormalLocation = profile.normalLocations.includes(eventLocation);

    return isNormalLocation ? 0 : 80;
  }

  /**
   * Calculate device-based anomaly score
   */
  private calculateDeviceAnomaly(event: BehaviorEvent, profile: UserProfile): number {
    if (profile.normalDevices.length === 0) return 0;

    const isNormalDevice = profile.normalDevices.includes(event.device);
    return isNormalDevice ? 0 : 50;
  }

  /**
   * Calculate velocity-based anomaly (impossible travel)
   */
  private async calculateVelocityAnomaly(
    event: BehaviorEvent,
    profile: UserProfile
  ): Promise<number> {
    try {
      // Get last login location and time
      const lastSession = await prisma.session.findFirst({
        where: {
          userId: event.userId,
          createdAt: {
            lt: event.timestamp,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!lastSession || !event.location) return 0;

      // Session model doesn't store latitude/longitude, only city/country
      // Skip velocity check since we don't have precise coordinates
      // TODO: Implement geolocation API to get coordinates from city/country
      return 0;
    } catch (error) {
      console.error('Error calculating velocity anomaly:', error);
      return 0;
    }
  }

  /**
   * Calculate access pattern anomaly
   */
  private calculateAccessPatternAnomaly(event: BehaviorEvent, profile: UserProfile): number {
    // Placeholder for access pattern analysis
    // In production, analyze resource access patterns
    return 0;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Determine severity from score
   */
  private determineSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'critical';
    if (score >= 80) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }

  /**
   * Handle detected anomaly
   */
  private async handleAnomalyDetected(
    event: BehaviorEvent,
    anomalyScore: AnomalyScore
  ): Promise<void> {
    console.log(
      `🚨 ANOMALY DETECTED: User ${event.userId} - Score: ${anomalyScore.overall.toFixed(2)} (${anomalyScore.severity})`
    );

    // Create security event
    const threatLevel =
      anomalyScore.severity === 'critical'
        ? ThreatLevel.CRITICAL
        : anomalyScore.severity === 'high'
        ? ThreatLevel.HIGH
        : anomalyScore.severity === 'medium'
        ? ThreatLevel.MEDIUM
        : ThreatLevel.LOW;

    await securityMonitoringService.recordSecurityEvent({
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      threatLevel,
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      description: `Behavioral anomaly detected (score: ${anomalyScore.overall.toFixed(2)})`,
      metadata: {
        anomalyScore: anomalyScore.overall,
        factors: anomalyScore.factors,
        severity: anomalyScore.severity,
        eventType: event.eventType,
      },
    });
  }

  /**
   * Update user profile with normal behavior
   */
  private async updateUserProfile(event: BehaviorEvent, profile: UserProfile): Promise<void> {
    // Add to normal times if not already present
    const eventHour = event.timestamp.getHours();
    if (!profile.normalLoginTimes.includes(eventHour)) {
      profile.normalLoginTimes.push(eventHour);
      // Keep only top 5 most frequent
      if (profile.normalLoginTimes.length > 5) {
        profile.normalLoginTimes.shift();
      }
    }

    // Add to normal devices
    if (!profile.normalDevices.includes(event.device)) {
      profile.normalDevices.push(event.device);
      if (profile.normalDevices.length > 5) {
        profile.normalDevices.shift();
      }
    }

    // Add to normal locations
    if (event.location) {
      const locationKey = `${event.location.city},${event.location.country}`;
      if (!profile.normalLocations.includes(locationKey)) {
        profile.normalLocations.push(locationKey);
        if (profile.normalLocations.length > 5) {
          profile.normalLocations.shift();
        }
      }
    }

    profile.lastUpdated = new Date();
    this.userProfiles.set(profile.userId, profile);
  }

  /**
   * Find most frequent elements in array
   */
  private findMostFrequent<T>(arr: T[], count: number): T[] {
    const frequency = new Map<T, number>();

    for (const item of arr) {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([item]) => item);
  }

  /**
   * Get user profile stats
   */
  async getUserProfileStats(userId: string): Promise<UserProfile | null> {
    return await this.getUserProfile(userId);
  }

  /**
   * Clear user profile (force rebuild)
   */
  clearUserProfile(userId: string): void {
    this.userProfiles.delete(userId);
    console.log(`🧹 Cleared behavior profile for user ${userId}`);
  }

  /**
   * Get all cached profiles count
   */
  getCachedProfilesCount(): number {
    return this.userProfiles.size;
  }

  /**
   * Clean up old profiles
   */
  cleanupStaleProfiles(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, profile] of this.userProfiles.entries()) {
      if (now - profile.lastUpdated.getTime() > this.PROFILE_UPDATE_INTERVAL * 7) {
        this.userProfiles.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} stale behavior profiles`);
    }
  }
}

export default new AnomalyDetectionService();
export { UserProfile, AnomalyScore, BehaviorEvent };
