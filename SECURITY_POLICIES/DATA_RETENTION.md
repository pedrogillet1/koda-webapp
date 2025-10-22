# 🗄️ Data Retention & Deletion Policy

**Organization:** KODA AI Document Intelligence Platform
**Document Owner:** Compliance Team
**Last Updated:** October 11, 2025
**Version:** 1.0
**Review Cycle:** Annually

---

## 1. Purpose

This Data Retention and Deletion Policy establishes guidelines for the collection, retention, and secure deletion of data within the KODA AI platform. This policy ensures compliance with GDPR, CCPA, SOC 2, and other applicable regulations while balancing business needs and legal requirements.

---

## 2. Scope

This policy applies to:
- All customer data (documents, chat history, personal information)
- All employee data
- All system logs and audit trails
- All backups and archives
- All data stored on company systems or third-party services

---

## 3. Regulatory Requirements

### GDPR (General Data Protection Regulation)
- Data retention limited to necessary duration
- Right to erasure ("right to be forgotten")
- Data minimization principle
- Secure deletion required

### CCPA (California Consumer Privacy Act)
- Consumer right to deletion
- Deletion within 45 days of request
- Service provider obligations

### SOC 2
- Audit log retention: Minimum 1 year
- Change logs: Minimum 1 year
- Security incident logs: 7 years

### Industry Standards
- Financial records: 7 years (IRS requirement)
- Legal documents: 7 years post-closure
- Employment records: 7 years post-termination

---

## 4. Data Classification

### 4.1 Data Categories

#### 🔴 **Critical Data**
**Definition:** Data essential for legal, regulatory, or business continuity
**Examples:** Audit logs, financial records, legal agreements
**Retention:** 7 years minimum
**Deletion:** Secure deletion after retention period

---

#### 🟠 **Sensitive Data**
**Definition:** Personal or confidential information
**Examples:** User documents, PII, payment information
**Retention:** While account active + 30 days after deletion request
**Deletion:** Secure deletion within 30 days

---

#### 🟡 **Operational Data**
**Definition:** Data needed for ongoing operations
**Examples:** User accounts, system configurations, application logs
**Retention:** While actively used
**Deletion:** Standard deletion when no longer needed

---

#### 🟢 **Temporary Data**
**Definition:** Short-term data for processing
**Examples:** Session data, cache, temporary files
**Retention:** Hours to days
**Deletion:** Automatic deletion

---

## 5. Data Retention Schedule

### 5.1 Customer Data

| Data Type | Retention Period | Post-Deletion | Deletion Method |
|-----------|------------------|---------------|-----------------|
| **User Documents** | While account active | 30-day recovery | Secure deletion |
| **Document Embeddings** | Linked to document | Immediate | Database deletion |
| **Chat History** | While account active | 30-day recovery | Secure deletion |
| **User Profile** | While account active | 30 days | Anonymization |
| **Payment Information** | 7 years (compliance) | N/A | Tokenized storage |
| **API Usage Logs** | 13 months | N/A | Automatic deletion |

---

### 5.2 Audit & Security Logs

| Log Type | Retention Period | Storage Location | Access Control |
|----------|------------------|------------------|----------------|
| **Audit Logs** | 7 years | Database + Archive | Admin only |
| **System Logs** | 1 year | Log aggregation | DevOps only |
| **Access Logs** | 2 years | Database | Security team |
| **Error Logs (Sentry)** | 90 days | Sentry cloud | Developers |
| **Security Incidents** | 7 years | Secure storage | Security + Legal |

---

### 5.3 Employee Data

| Data Type | Retention Period | Post-Employment | Legal Basis |
|-----------|------------------|-----------------|-------------|
| **Employment Records** | 7 years post-termination | N/A | Legal requirement |
| **Payroll Records** | 7 years | N/A | Tax law |
| **Performance Reviews** | 3 years | N/A | Business need |
| **Training Records** | 7 years | N/A | Compliance |
| **Email (Work)** | 7 years | N/A | Discovery requests |
| **Access Logs** | 7 years | N/A | Security audits |

---

### 5.4 Business Records

| Record Type | Retention Period | Legal Basis |
|-------------|------------------|-------------|
| **Contracts** | 7 years post-expiration | Statute of limitations |
| **Financial Statements** | 7 years | IRS requirement |
| **Tax Records** | 7 years | Tax law |
| **Invoices** | 7 years | Accounting standards |
| **Insurance Policies** | 7 years post-expiration | Risk management |
| **Patents/IP** | Life of IP + 7 years | Legal protection |

---

## 6. Data Deletion Procedures

### 6.1 User-Initiated Deletion

#### Document Deletion

**Process:**
1. User clicks "Delete" on document
2. Document moved to "Trash" folder
3. 30-day recovery period begins
4. User can restore from Trash
5. After 30 days: Automatic permanent deletion

**Implementation:**
```typescript
// Soft delete (move to trash)
await prisma.document.update({
  where: { id: documentId },
  data: {
    deletedAt: new Date(),
    deletedBy: userId,
    status: 'trash'
  }
});

// Permanent deletion (after 30 days)
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

await prisma.document.deleteMany({
  where: {
    deletedAt: {
      lte: thirtyDaysAgo
    },
    status: 'trash'
  }
});

// Also delete embeddings
await qdrant.delete({
  filter: {
    must: [{ key: 'document_id', match: { value: documentId } }]
  }
});

// Delete files from GCS
await storage.bucket(bucketName).file(filePath).delete();
```

---

#### Account Deletion

**Process:**
1. User requests account deletion via settings
2. Confirmation email sent (prevents accidental deletion)
3. User confirms via email link
4. Account deactivated immediately
5. 30-day grace period for recovery
6. After 30 days: Permanent deletion

**What Gets Deleted:**
- ✅ All user documents
- ✅ All chat history
- ✅ All embeddings
- ✅ Profile information
- ✅ Preferences and settings
- ✅ API keys
- ❌ Audit logs (retained for compliance)
- ❌ Financial records (retained 7 years)

**Implementation:**
```typescript
// Step 1: Deactivate account
await prisma.user.update({
  where: { id: userId },
  data: {
    isActive: false,
    deletionRequestedAt: new Date(),
    deletionConfirmed: false
  }
});

// Send confirmation email
await sendAccountDeletionConfirmation(user.email);

// Step 2: After confirmation
await prisma.user.update({
  where: { id: userId },
  data: { deletionConfirmed: true }
});

// Step 3: Permanent deletion (after 30 days)
const deletionService = new AccountDeletionService();
await deletionService.permanentlyDeleteAccount(userId);
```

---

### 6.2 Automatic Deletion

#### Inactive Account Cleanup

**Schedule:**
- **90 days inactive:** Warning email sent
- **120 days inactive:** Second warning email
- **180 days inactive:** Account deactivated
- **365 days inactive:** Account deleted (after data export offered)

**Implementation:**
```typescript
// Scheduled job (runs daily)
async function cleanupInactiveAccounts() {
  const now = new Date();

  // 90-day warning
  const warnDate1 = new Date(now);
  warnDate1.setDate(warnDate1.getDate() - 90);

  const usersToWarn1 = await prisma.user.findMany({
    where: {
      lastLoginAt: { lte: warnDate1 },
      inactivityWarning1Sent: false
    }
  });

  for (const user of usersToWarn1) {
    await sendInactivityWarning(user.email, 90);
    await prisma.user.update({
      where: { id: user.id },
      data: { inactivityWarning1Sent: true }
    });
  }

  // Similar for 120, 180, and 365 days...
}
```

---

#### Temporary Data Cleanup

**Automatic Deletion:**
| Data Type | Retention | Cleanup Frequency |
|-----------|-----------|-------------------|
| **Session Data** | 8 hours | Hourly |
| **Password Reset Tokens** | 1 hour | Hourly |
| **Email Verification Codes** | 24 hours | Daily |
| **Temporary Files** | 24 hours | Daily |
| **Cache** | 1 hour | Continuous |
| **API Rate Limit Counters** | 15 minutes | Continuous |

---

### 6.3 Secure Deletion Methods

#### Database Deletion
```typescript
// Standard deletion
await prisma.document.delete({ where: { id: documentId } });

// Cascade deletion (automatically deletes related records)
// Configured in Prisma schema:
// onDelete: Cascade
```

#### File Storage Deletion (Google Cloud Storage)
```typescript
// Delete file from GCS
await storage.bucket(bucketName).file(filePath).delete();

// Verify deletion
const [exists] = await storage.bucket(bucketName).file(filePath).exists();
if (exists) {
  throw new Error('File deletion failed');
}
```

#### Vector Database Deletion (Qdrant)
```typescript
// Delete embeddings for a document
await qdrant.delete('koda_documents', {
  filter: {
    must: [
      { key: 'document_id', match: { value: documentId } }
    ]
  }
});
```

#### Anonymization (for retained audit logs)
```typescript
// Anonymize user data in logs
await prisma.auditLog.updateMany({
  where: { userId: deletedUserId },
  data: {
    userEmail: '[DELETED]',
    ipAddress: '0.0.0.0',
    userAgent: '[REDACTED]'
  }
});
```

---

## 7. Data Portability (GDPR Right to Data Portability)

### 7.1 Data Export

**User Rights:**
- Request complete data export
- Receive data in machine-readable format (JSON)
- Transfer data to another service

**Export Process:**
1. User requests export via settings
2. Export job queued
3. Data compiled into JSON format
4. Download link emailed (expires in 7 days)
5. Export logged for audit trail

**Data Included:**
- ✅ All documents (original files)
- ✅ Document metadata
- ✅ Chat history
- ✅ User profile
- ✅ Account settings
- ✅ API usage statistics
- ❌ Embeddings (derived data)
- ❌ System logs

**Implementation:**
```typescript
async function exportUserData(userId: string): Promise<string> {
  // Compile user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      documents: true,
      conversations: {
        include: { messages: true }
      },
      folders: true,
      tags: true
    }
  });

  // Remove sensitive fields
  const exportData = {
    user: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt
    },
    documents: user.documents.map(doc => ({
      name: doc.name,
      type: doc.type,
      size: doc.size,
      uploadedAt: doc.createdAt,
      downloadUrl: await getSignedUrl(doc.gcsPath)
    })),
    conversations: user.conversations,
    // ... other data
  };

  // Save to GCS
  const exportFile = `exports/user-${userId}-${Date.now()}.json`;
  await storage.bucket(bucketName).file(exportFile).save(
    JSON.stringify(exportData, null, 2)
  );

  // Generate signed URL (expires in 7 days)
  const [url] = await storage.bucket(bucketName).file(exportFile).getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
  });

  // Send email with download link
  await sendDataExportEmail(user.email, url);

  return url;
}
```

---

## 8. Backup Retention

### 8.1 Database Backups

**Backup Schedule:**
- **Daily:** Full database backup at 2 AM
- **Weekly:** Archive to long-term storage
- **Monthly:** Off-site backup

**Retention:**
| Backup Type | Retention | Storage Location |
|-------------|-----------|------------------|
| **Daily** | 30 days | Primary backup storage |
| **Weekly** | 3 months | Archive storage |
| **Monthly** | 7 years | Off-site/cloud storage |

**Backup Security:**
- ✅ Encrypted at rest (AES-256)
- ✅ Encrypted in transit (TLS 1.3)
- ✅ Access restricted to authorized personnel
- ✅ Integrity verification (checksums)

---

### 8.2 Backup Deletion

**When Backups Deleted:**
1. After retention period expires
2. User requests deletion (must also delete backups)
3. Regulatory compliance requires deletion

**Process:**
```bash
# Automated cleanup in backup script
find /var/backups/koda -name "*.sql.gz" -mtime +30 -delete
```

**Exception:** Backups containing data subject to legal hold are retained indefinitely until hold is lifted.

---

## 9. Legal Holds & Exceptions

### 9.1 Legal Hold Process

**When Legal Hold Applies:**
- Pending litigation
- Government investigation
- Regulatory audit
- Internal investigation

**Process:**
1. Legal team issues legal hold notice
2. IT team flags affected data
3. Normal deletion suspended
4. Data preserved indefinitely
5. Hold lifted after case resolution

**Implementation:**
```typescript
// Flag data for legal hold
await prisma.document.update({
  where: { id: documentId },
  data: {
    legalHold: true,
    legalHoldReason: 'Litigation - Case #12345',
    legalHoldDate: new Date()
  }
});

// Prevent deletion during legal hold
if (document.legalHold) {
  throw new Error('Cannot delete: Document under legal hold');
}
```

---

## 10. Data Minimization

### 10.1 Collection Principles

**Only Collect:**
- Data necessary for service operation
- Data required by law
- Data explicitly requested by user

**Do NOT Collect:**
- Excessive personal information
- Sensitive data unless required
- Data without clear purpose

### 10.2 Anonymization & Pseudonymization

**Techniques:**
- **Hashing:** For identifiers (e.g., IP addresses)
- **Masking:** For partial data display (e.g., credit cards)
- **Aggregation:** For analytics (no individual tracking)
- **Tokenization:** For payment information

**Example:**
```typescript
// Anonymize IP address for analytics
function anonymizeIP(ip: string): string {
  return ip.split('.').slice(0, 3).join('.') + '.0';
}

// Mask credit card
function maskCreditCard(cardNumber: string): string {
  return `****-****-****-${cardNumber.slice(-4)}`;
}
```

---

## 11. Third-Party Data Processing

### 11.1 Data Processor Agreements (DPA)

**Required For:**
- Google Cloud Platform (storage)
- SendGrid (email)
- Sentry (error tracking)
- Qdrant (vector database)

**DPA Requirements:**
- Data processing only per instructions
- Same security standards as KODA AI
- Data deletion upon termination
- Sub-processor transparency

### 11.2 Data Transfer

**International Transfers:**
- Use Standard Contractual Clauses (SCCs)
- Ensure adequate protection (GDPR Article 46)
- Document transfer mechanisms

---

## 12. User Rights & Requests

### 12.1 GDPR Rights

| Right | Request Method | Response Time |
|-------|---------------|---------------|
| **Right to Access** | settings → download data | 30 days |
| **Right to Rectification** | Update profile | Immediate |
| **Right to Erasure** | Delete account | 30 days |
| **Right to Data Portability** | Export data | 30 days |
| **Right to Object** | Unsubscribe | Immediate |

### 12.2 Request Process

**Steps:**
1. User submits request via support or settings
2. Identity verification (security measure)
3. Request logged in compliance system
4. Action taken within legal timeline
5. User notified of completion
6. Request documented for audit

---

## 13. Monitoring & Compliance

### 13.1 Deletion Verification

**Verification Steps:**
1. Check database for deleted records
2. Verify file deletion from GCS
3. Confirm embedding removal from Qdrant
4. Check backups (anonymized)
5. Review audit logs

### 13.2 Compliance Reporting

**Monthly Reports:**
- Deletion requests received
- Deletion requests completed
- Average response time
- Backlog of pending requests

**Annual Audit:**
- Retention policy compliance
- Backup verification
- Legal hold review
- Third-party processor audit

---

## 14. Training & Awareness

**Required Training:**
- All employees: Annual data retention training
- Developers: Secure deletion procedures
- Support team: Handling deletion requests
- Legal team: Legal hold procedures

---

## 15. Policy Review & Updates

**Review Schedule:**
- Annually: Comprehensive review
- Quarterly: Minor updates
- As Needed: Regulatory changes

**Approval Authority:**
- Compliance Officer
- Legal Counsel
- Chief Technology Officer

---

## Appendix A: Data Flow Diagram

```
[User Uploads Document]
        ↓
[File stored in GCS] → [Metadata in Database] → [Embeddings in Qdrant]
        ↓
[User Deletes Document]
        ↓
[Soft Delete (Trash)] → 30-day recovery period
        ↓
[After 30 days: Permanent Deletion]
        ↓
[Delete from GCS] → [Delete from Database] → [Delete from Qdrant]
        ↓
[Verify Deletion] → [Log in Audit Trail]
```

---

## Appendix B: Deletion Checklist

When permanently deleting user data:

- [ ] Delete documents from GCS
- [ ] Delete document metadata from database
- [ ] Delete embeddings from Qdrant
- [ ] Delete chat history
- [ ] Delete user profile
- [ ] Anonymize audit logs
- [ ] Revoke API keys
- [ ] Cancel subscriptions
- [ ] Send confirmation email
- [ ] Update deletion log
- [ ] Verify all data deleted
- [ ] Check backups (anonymize if needed)

---

**Document Control:**
- **Classification:** Internal - Confidential
- **Distribution:** All Employees, Management, Compliance Team
- **Next Review Date:** October 11, 2026

---

*This policy complies with GDPR, CCPA, SOC 2, and other applicable data protection regulations.*
