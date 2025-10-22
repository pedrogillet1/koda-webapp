# 🔐 Access Control Policy

**Organization:** KODA AI Document Intelligence Platform
**Document Owner:** Security Team
**Last Updated:** October 11, 2025
**Version:** 1.0
**Review Cycle:** Quarterly

---

## 1. Purpose

This Access Control Policy establishes guidelines for managing user access to KODA AI systems, applications, and data. This policy ensures that only authorized individuals have appropriate access to perform their job functions while protecting sensitive data from unauthorized access, modification, or disclosure.

---

## 2. Scope

This policy applies to:
- All KODA AI employees, contractors, and vendors
- All systems and applications
- All user accounts (internal and customer)
- All data repositories
- Physical and logical access controls

---

## 3. Access Control Principles

### 3.1 Least Privilege
Users are granted the minimum level of access required to perform their job functions. Access beyond immediate needs must be justified and approved.

### 3.2 Separation of Duties
Critical functions are divided among multiple individuals to prevent fraud and errors. No single individual has complete control over critical processes.

### 3.3 Need-to-Know
Access to sensitive information is restricted to those with a legitimate business need.

### 3.4 Default Deny
All access is denied by default unless explicitly granted.

---

## 4. User Roles & Permissions

### 4.1 System Roles

#### 🔴 **System Administrator**
**Access Level:** Full system access
**Responsibilities:** System configuration, maintenance, monitoring
**Permissions:**
- ✅ Full database access
- ✅ Server administration
- ✅ User account management
- ✅ Security configuration
- ✅ Audit log access
- ✅ Backup/restore operations

**Assignment Criteria:**
- Full-time employee
- Background check completed
- Security training completed
- Manager approval required
- CEO approval for production access

---

#### 🟠 **Developer**
**Access Level:** Development and staging environments only
**Responsibilities:** Application development, bug fixes, feature implementation
**Permissions:**
- ✅ Code repository access
- ✅ Development environment access
- ✅ Staging database access (anonymized data)
- ❌ Production database access
- ❌ Customer data access
- ⚠️ Production read-only access (with justification)

**Assignment Criteria:**
- Employee or contractor
- NDA signed
- Security training completed
- Team lead approval

---

#### 🟡 **Support Agent**
**Access Level:** Customer support functions only
**Responsibilities:** Customer assistance, ticket resolution
**Permissions:**
- ✅ Customer support portal
- ✅ User account lookup (limited fields)
- ✅ Document metadata view (not content)
- ❌ Document content access
- ❌ Database access
- ❌ System administration

**Assignment Criteria:**
- Employee or contractor
- Customer service training completed
- Background check completed
- Support lead approval

---

### 4.2 Customer Roles

#### 👤 **Regular User**
**Access Level:** Own documents only
**Permissions:**
- ✅ Upload/delete own documents
- ✅ Create/manage own folders
- ✅ Share documents (viewer/editor permissions)
- ✅ AI chat queries on own documents
- ❌ Access others' documents (unless shared)
- ❌ Administrative functions

---

#### 👔 **Professional User** (Lawyer, Accountant, etc.)
**Access Level:** Own documents + shared documents
**Permissions:**
- All Regular User permissions, plus:
- ✅ Advanced search features
- ✅ Document templates
- ✅ Bulk operations
- ✅ Enhanced sharing controls
- ✅ API access (with rate limits)

---

#### 👨‍💼 **Organization Admin**
**Access Level:** All organization documents
**Permissions:**
- All Professional User permissions, plus:
- ✅ User management within organization
- ✅ Role assignment
- ✅ Usage analytics
- ✅ Billing management
- ✅ Audit log access (organization only)
- ❌ Access to other organizations

---

## 5. Account Management

### 5.1 Account Provisioning

**Process:**
1. **Request Submission**
   - Manager submits access request via ticketing system
   - Includes: User name, role, justification, duration

2. **Approval Workflow**
   - Manager approval required
   - Security team approval for elevated access
   - CEO approval for System Administrator

3. **Account Creation**
   - IT creates account with appropriate role
   - Temporary password generated
   - MFA enabled (required for admins)
   - Welcome email sent

4. **Documentation**
   - Access logged in user management system
   - Approval tickets archived
   - Audit trail maintained

**Timeline:**
- Standard access: Within 1 business day
- Elevated access: Within 3 business days

---

### 5.2 Account Modification

**Triggers:**
- Role change
- Department transfer
- Responsibility change
- Temporary elevated access needed

**Process:**
1. Manager submits modification request
2. Approval obtained (same as provisioning)
3. IT implements changes
4. User notified of changes
5. Changes logged in audit trail

---

### 5.3 Account Termination

**Triggers:**
- Employment termination
- Contract end
- Role no longer needed
- Security violation

**Process:**
1. **Immediate Actions** (within 1 hour of notification)
   - Disable account
   - Revoke all access
   - Reset password
   - Invalidate sessions/tokens
   - Collect company devices

2. **Documentation**
   - Termination logged
   - Access removal confirmed
   - Exit interview completed

3. **Data Transfer** (if applicable)
   - Transfer ownership of critical documents
   - Reassign responsibilities
   - Archive user data

**Timeline:**
- Voluntary termination: Effective on last day
- Involuntary termination: Immediate
- Security violation: Immediate

---

## 6. Authentication Requirements

### 6.1 Password Policy

**Minimum Requirements:**
- ✅ Minimum 8 characters
- ✅ At least 1 uppercase letter
- ✅ At least 1 lowercase letter
- ✅ At least 1 number
- ✅ At least 1 special character (!@#$%^&*)
- ❌ Cannot reuse last 5 passwords
- ❌ Cannot contain username or email
- ❌ Cannot be common passwords (dictionary check)

**Password Expiry:**
- **Employees/Admins:** Every 90 days
- **Customers:** Optional (recommend annual change)
- **Service Accounts:** Every 6 months

**Failed Login Attempts:**
- **Threshold:** 5 failed attempts within 15 minutes
- **Action:** Account locked for 15 minutes
- **Admin Notification:** After 3 failed attempts
- **Permanent Lock:** After 10 failed attempts (manual unlock required)

---

### 6.2 Multi-Factor Authentication (MFA)

**Required For:**
- ✅ All system administrators
- ✅ All developers with production access
- ✅ All employees accessing customer data
- ✅ Organization admins (customer accounts)
- ⚠️ Recommended for all users

**Supported Methods:**
1. **Authenticator App** (preferred)
   - Google Authenticator
   - Microsoft Authenticator
   - Authy

2. **SMS** (backup method)
   - Text message verification code
   - 6-digit code, expires in 10 minutes

3. **Backup Codes** (emergency access)
   - 10 single-use codes
   - Securely stored by user

**Enrollment:**
- Mandatory during first login for required users
- Self-service enrollment available
- Backup method required

---

### 6.3 Session Management

**Session Timeouts:**
- **Active Session:** 8 hours
- **Idle Timeout:** 30 minutes
- **Remember Me:** 30 days (optional, customer accounts only)

**Session Security:**
- HTTPS required (enforced)
- Secure and HttpOnly cookies
- CSRF protection enabled
- Session invalidation on logout
- Concurrent session limit: 3 devices

---

## 7. Authorization & Permissions

### 7.1 Document Access Control

**Permission Levels:**

| Level | View | Edit | Delete | Share | Download |
|-------|------|------|--------|-------|----------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Editor** | ✅ | ✅ | ❌ | ⚠️ * | ✅ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ⚠️ * |

*\* Configurable by owner*

**Sharing Rules:**
1. Only document owner can grant/revoke access
2. Editors can share if granted permission by owner
3. Time-limited shares automatically expire
4. Share expiration: Default 6 months, max 2 years
5. External shares require additional approval (organization admins)

---

### 7.2 API Access Control

**API Key Management:**
- ✅ Unique key per application
- ✅ Rate limiting enforced
- ✅ Scope-based permissions
- ✅ Key rotation every 6 months
- ✅ Audit logging of all API calls

**Rate Limits:**
| Tier | Requests/Min | Requests/Hour | Requests/Day |
|------|--------------|---------------|--------------|
| **Free** | 10 | 100 | 1,000 |
| **Personal** | 20 | 500 | 5,000 |
| **Premium** | 50 | 2,000 | 20,000 |
| **Business** | 100 | 5,000 | 50,000 |

---

## 8. Access Reviews

### 8.1 Periodic Access Reviews

**Quarterly Reviews:**
- All user access reviewed
- Inactive accounts identified
- Unused permissions removed
- Access appropriateness verified

**Review Process:**
1. IT generates access report
2. Managers review their team's access
3. Managers certify access is appropriate
4. Changes implemented within 1 week
5. Results documented

**Annual Comprehensive Review:**
- All system access reviewed
- All customer accounts audited
- Dormant accounts identified
- Shared documents reviewed

---

### 8.2 Automated Access Controls

**Automatic Actions:**
- **90 Days Inactive:** Warning email sent
- **120 Days Inactive:** Account disabled
- **180 Days Inactive:** Account archived
- **365 Days Inactive:** Account deleted (after data backup)

**Exceptions:**
- Service accounts (reviewed quarterly)
- Long-term projects (manager approval required)
- Customers (notification sent, account preserved)

---

## 9. Physical Access Control

### 9.1 Office Access

**Requirements:**
- Employee badge required
- Visitors must sign in
- Visitor badges expire daily
- After-hours access logged

**Server Room Access:**
- Restricted to System Administrators
- Key card + PIN required
- Access logged
- Video surveillance active

---

## 10. Remote Access

### 10.1 VPN Requirements

**Mandatory For:**
- Accessing internal systems
- Production environment access
- Customer data access

**VPN Configuration:**
- ✅ Multi-factor authentication required
- ✅ Split tunneling disabled
- ✅ Kill switch enabled
- ✅ Connection logs maintained

### 10.2 Device Security

**Requirements:**
- ✅ Company-approved devices only
- ✅ Endpoint protection installed
- ✅ Full disk encryption enabled
- ✅ Screen lock: 10 minutes
- ✅ Automatic updates enabled

---

## 11. Third-Party Access

### 11.1 Vendor Access

**Process:**
1. Vendor risk assessment completed
2. NDA signed
3. Minimum necessary access granted
4. Access time-limited (default: 30 days)
5. Activity monitored
6. Access revoked upon completion

**Vendor Categories:**
- **Critical Vendors:** Extended access, enhanced monitoring
- **Standard Vendors:** Limited access, standard monitoring
- **One-time Vendors:** Temporary access, supervisor present

---

## 12. Compliance & Enforcement

### 12.1 Policy Violations

**Examples:**
- Sharing credentials
- Accessing unauthorized data
- Bypassing security controls
- Failing to report security incidents

**Consequences:**
- **First Violation:** Written warning
- **Second Violation:** Suspension
- **Third Violation:** Termination
- **Severe Violation:** Immediate termination + legal action

---

### 12.2 Monitoring & Auditing

**Logged Activities:**
- ✅ Login attempts (success/failure)
- ✅ Document access/modifications
- ✅ Permission changes
- ✅ Administrative actions
- ✅ API calls
- ✅ File downloads
- ✅ Share operations

**Log Retention:**
- Audit logs: 7 years
- System logs: 1 year
- Access logs: 2 years

**Review Frequency:**
- Real-time: Critical alerts
- Daily: Admin actions
- Weekly: Access patterns
- Monthly: Comprehensive review

---

## 13. Exception Process

**When Exceptions Allowed:**
- Emergency situations
- Business-critical needs
- Temporary elevated access

**Process:**
1. Submit exception request with justification
2. Manager approval required
3. Security team approval required
4. Exception documented
5. Time-limited (max: 30 days)
6. Enhanced monitoring applied
7. Access revoked at expiration

---

## 14. Training & Awareness

**Required Training:**
- **New Hires:** Access control policy training within first week
- **Annual Refresh:** All employees complete refresher training
- **Role Change:** Training for new responsibilities
- **Policy Updates:** Training within 30 days of changes

**Topics Covered:**
- Password best practices
- MFA setup and usage
- Phishing awareness
- Data classification
- Incident reporting
- Social engineering

---

## 15. Policy Review & Updates

**Review Schedule:**
- Quarterly: Minor updates
- Annually: Comprehensive review
- As Needed: Security incidents, regulatory changes

**Approval Authority:**
- Chief Security Officer
- Chief Technology Officer
- Legal Counsel

---

## Appendix A: Access Request Form Template

```
ACCESS REQUEST FORM

Requestor Information:
- Name: ________________
- Department: ________________
- Manager: ________________

Request Details:
- User Name: ________________
- Requested Role: ________________
- Access Type: [ ] New [ ] Modify [ ] Remove
- Business Justification: ________________
- Duration: [ ] Permanent [ ] Temporary (_____ days)

Systems/Applications:
[ ] Production Database
[ ] Customer Data
[ ] Admin Panel
[ ] Other: ________________

Approvals:
- Manager Signature: ________________ Date: ______
- Security Approval: ________________ Date: ______
- CEO Approval (if required): ________________ Date: ______
```

---

## Appendix B: Access Matrix

See separate document: `ACCESS_MATRIX.xlsx`

---

**Document Control:**
- **Classification:** Internal - Confidential
- **Distribution:** All Employees, Management
- **Next Review Date:** January 11, 2026

---

*Failure to comply with this policy may result in disciplinary action up to and including termination of employment.*
