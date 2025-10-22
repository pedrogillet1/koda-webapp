# Security Documentation

## Overview

This document outlines the comprehensive security measures implemented in the application to ensure data isolation, prevent unauthorized access, and monitor security events.

## Table of Contents

1. [Data Isolation](#data-isolation)
2. [Audit Logging](#audit-logging)
3. [Rate Limiting](#rate-limiting)
4. [Security Monitoring](#security-monitoring)
5. [API Endpoints](#api-endpoints)
6. [Best Practices](#best-practices)

---

## Data Isolation

### User Data Separation

All database queries implement strict user isolation using userId filtering:

```typescript
// Example: All document queries include userId filter
const documents = await prisma.document.findMany({
  where: { userId: req.user.id }
});
```

### Authorization Checks

Every resource access includes ownership verification:

```typescript
const document = await prisma.document.findUnique({
  where: { id: documentId }
});

if (!document || document.userId !== userId) {
  throw new Error('Document not found or unauthorized');
}
```

### Verified Secure Endpoints

The following services have been audited and verified for proper user isolation:

- **Document Service** (`src/services/document.service.ts`)
- **Chat Service** (`src/services/chat.service.ts`)
- **Folder Service** (`src/services/folder.service.ts`)
- **Tag Service** (`src/services/tag.service.ts`)

All queries include `where: { userId }` clauses to prevent cross-user data access.

---

## Audit Logging

### Overview

The audit logging middleware (`src/middleware/auditLog.middleware.ts`) records all sensitive operations for security monitoring and compliance.

### Logged Operations

Audit logs are created for:
- Document access (GET, POST, PUT, DELETE)
- Folder operations
- Chat interactions
- User profile changes

### Log Structure

Each audit log entry contains:

```typescript
{
  userId: string | null,
  action: string,           // e.g., "GET /api/documents/123"
  resource: string | null,  // Resource ID (document, folder, etc.)
  ipAddress: string | null,
  userAgent: string | null,
  status: 'success' | 'failure',
  details: string | null,   // Error details for failures
  createdAt: Date
}
```

### Security Violation Detection

The system automatically detects and logs security violations:

- **401 Unauthorized**: Authentication failures
- **403 Forbidden**: Authorization failures
- Logs include user ID, action, IP address, and error details

Console warnings are generated for immediate visibility:

```
🚨 SECURITY VIOLATION DETECTED:
   User: user-id-here
   Action: GET /api/documents/xyz
   IP: 192.168.1.100
   Status: 403
```

### Performance Monitoring

Operations taking longer than 5 seconds trigger slow operation warnings:

```
⚠️ SLOW OPERATION (5234ms): POST /api/chat - User: user-id-here
```

---

## Rate Limiting

### General API Rate Limiter

Applied to all `/api/*` endpoints:

```typescript
windowMs: 15 * 60 * 1000  // 15 minutes
max: 500                   // 500 requests per IP
```

### Authentication Rate Limiter

Stricter limits for auth endpoints:

```typescript
windowMs: 15 * 60 * 1000  // 15 minutes
max: 5                     // 5 login attempts per IP
skipSuccessfulRequests: true
```

### 2FA Verification Rate Limiter

Very strict limits for 2FA:

```typescript
windowMs: 15 * 60 * 1000  // 15 minutes
max: 3                     // 3 attempts per IP
```

### AI/Chat Rate Limiter

```typescript
windowMs: 60 * 1000       // 1 minute
max: 30                    // 30 requests per minute
```

### File Upload Rate Limiter

```typescript
windowMs: 60 * 60 * 1000  // 1 hour
max: 50                    // 50 uploads per hour
```

### Download Rate Limiter

```typescript
windowMs: 60 * 1000       // 1 minute
max: 60                    // 60 downloads per minute
```

### Search Rate Limiter

Prevents brute-force document discovery:

```typescript
windowMs: 60 * 1000       // 1 minute
max: 100                   // 100 searches per minute
```

### Suspicious Activity Rate Limiter

Applied when suspicious patterns detected:

```typescript
windowMs: 60 * 60 * 1000  // 1 hour
max: 10                    // Only 10 requests per hour
```

### Rate Limit Headers

All rate limiters expose headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Remaining requests
- `RateLimit-Reset`: Time when limit resets

---

## Security Monitoring

### Available Helper Functions

```typescript
// Get user's audit logs
getUserAuditLogs(userId: string, limit: number = 50)

// Get all security violations
getSecurityViolations(limit: number = 100)

// Detect suspicious activity patterns
detectSuspiciousActivity(userId: string, timeWindowMinutes: number = 60)

// Detect cross-user access attempts
detectCrossUserAccessAttempts(limit: number = 50)
```

### Suspicious Activity Detection

The system monitors for:

1. **Excessive Failed Attempts**: More than 10 failed requests in 60 minutes
2. **Unusual Activity Volume**: More than 500 successful requests in 60 minutes
3. **Risk Levels**:
   - `LOW`: 0-5 failed attempts
   - `MEDIUM`: 6-10 failed attempts
   - `HIGH`: 10+ failed attempts or 500+ total requests

Example response:

```json
{
  "userId": "user-id",
  "timeWindowMinutes": 60,
  "failedAttempts": 12,
  "successfulAccesses": 450,
  "isSuspicious": true,
  "risk": "HIGH"
}
```

---

## API Endpoints

All security endpoints require authentication (`authenticateToken` middleware).

### `GET /api/security/audit-logs`

Get current user's audit logs.

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 50)

**Response:**
```json
{
  "logs": [
    {
      "id": "log-id",
      "userId": "user-id",
      "action": "GET /api/documents/123",
      "resource": "123",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "status": "success",
      "details": null,
      "createdAt": "2025-10-09T12:00:00Z"
    }
  ]
}
```

### `GET /api/security/violations`

Get security violations (admin only - TODO: implement role check).

**Query Parameters:**
- `limit` (optional): Number of violations to return (default: 100)

**Response:**
```json
{
  "violations": [/* array of audit logs with status: 'failure' */]
}
```

### `GET /api/security/suspicious-activity`

Detect suspicious activity for current user.

**Query Parameters:**
- `timeWindow` (optional): Time window in minutes (default: 60)

**Response:**
```json
{
  "userId": "user-id",
  "timeWindowMinutes": 60,
  "failedAttempts": 3,
  "successfulAccesses": 120,
  "isSuspicious": false,
  "risk": "LOW"
}
```

### `GET /api/security/cross-user-attempts`

Get cross-user access attempts (admin only - TODO: implement role check).

**Query Parameters:**
- `limit` (optional): Number of attempts to return (default: 50)

**Response:**
```json
{
  "attempts": [/* array of unauthorized access attempts */]
}
```

### `GET /api/security/dashboard`

Get security dashboard summary for current user.

**Response:**
```json
{
  "summary": {
    "totalRequests": 1250,
    "successfulRequests": 1230,
    "failedRequests": 20,
    "successRate": "98.40%",
    "timeWindow": "24 hours"
  },
  "suspiciousActivity": {
    "risk": "LOW",
    "failedAttempts": 2,
    "isSuspicious": false
  },
  "recentActivity": [
    {
      "action": "GET /api/documents",
      "status": "success",
      "timestamp": "2025-10-09T12:00:00Z",
      "ipAddress": "192.168.1.100"
    }
  ]
}
```

### `GET /api/security/system-metrics`

Get system-wide security metrics (admin only - TODO: implement role check).

**Response:**
```json
{
  "systemMetrics": {
    "totalRequests": 15000,
    "failedRequests": 250,
    "uniqueActiveUsers": 45,
    "successRate": "98.33%",
    "timeWindow": "24 hours"
  },
  "topUsers": [
    {
      "userId": "user-id-1",
      "requestCount": 500
    }
  ]
}
```

---

## Best Practices

### For Developers

1. **Always Filter by User ID**
   ```typescript
   // ✅ Correct
   await prisma.document.findMany({
     where: { userId: req.user.id }
   });

   // ❌ Incorrect - exposes all users' data
   await prisma.document.findMany();
   ```

2. **Verify Ownership Before Access**
   ```typescript
   const resource = await getResource(id);
   if (!resource || resource.userId !== req.user.id) {
     return res.status(403).json({ error: 'Unauthorized' });
   }
   ```

3. **Use Appropriate Rate Limiters**
   ```typescript
   import { authLimiter, uploadLimiter } from './middleware/rateLimit.middleware';

   router.post('/login', authLimiter, loginHandler);
   router.post('/upload', uploadLimiter, uploadHandler);
   ```

4. **Log Sensitive Operations**
   - Audit logging middleware automatically logs sensitive operations
   - Add custom logging for critical business logic:
   ```typescript
   console.warn('🚨 CRITICAL OPERATION:', details);
   ```

### For Administrators

1. **Monitor Security Dashboard**
   - Check `/api/security/dashboard` regularly
   - Review suspicious activity alerts
   - Monitor failed authentication attempts

2. **Review Audit Logs**
   - Use `/api/security/violations` to find security issues
   - Investigate users with high risk levels
   - Check `/api/security/cross-user-attempts` for unauthorized access

3. **Adjust Rate Limits**
   - Modify limits in `src/middleware/rateLimit.middleware.ts`
   - Consider stricter limits for production
   - Monitor rate limit headers in responses

4. **Incident Response**
   - Audit logs provide complete activity trail
   - IP addresses logged for all operations
   - User agents help identify automated attacks

### Security Checklist

- [ ] All database queries include userId filtering
- [ ] Resource ownership verified before access
- [ ] Rate limiting applied to all sensitive endpoints
- [ ] Audit logging enabled for all operations
- [ ] Security dashboard monitored regularly
- [ ] Admin role checks implemented (TODO)
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented

---

## Future Enhancements

### Planned Improvements

1. **Admin Role System**
   - Implement role-based access control
   - Restrict admin endpoints to authorized users
   - Add role checks to violations and system-metrics endpoints

2. **Automated Security Testing**
   - CI/CD integration for security tests
   - Automated user isolation testing
   - Rate limit verification tests
   - Unauthorized access attempt simulations

3. **Real-time Alerts**
   - Email notifications for security violations
   - Slack/Discord integration for critical alerts
   - Dashboard push notifications

4. **Advanced Threat Detection**
   - Machine learning for anomaly detection
   - IP reputation checking
   - Geographic access pattern analysis
   - Automated account lockout for suspicious activity

5. **Compliance Features**
   - GDPR audit log export
   - Data retention policies
   - User data deletion workflows
   - Compliance reporting dashboard

---

## Contact

For security concerns or to report vulnerabilities, please contact the development team immediately.

**DO NOT** publicly disclose security vulnerabilities. Follow responsible disclosure practices.
