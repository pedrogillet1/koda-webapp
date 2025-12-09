/**
 * Analytics Cache Service - Stub
 *
 * This is a stub file to allow the server to start.
 * TODO: Implement proper caching functionality if needed.
 */

export const analyticsCache = {
  get: async (key: string): Promise<any> => null,
  set: async (key: string, value: any, ttl?: number): Promise<void> => {},
  del: async (key: string): Promise<void> => {},
  clear: async (): Promise<void> => {},
};

export default analyticsCache;
