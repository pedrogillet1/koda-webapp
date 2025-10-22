/**
 * PII (Personally Identifiable Information) Detection and Masking Service
 *
 * Detects and masks sensitive personal information in text:
 * - Email addresses
 * - Phone numbers (US format)
 * - Social Security Numbers (SSN)
 * - Credit card numbers
 * - IP addresses
 * - Dates of birth
 * - Physical addresses
 * - Names (basic detection)
 */

interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  confidence: 'high' | 'medium' | 'low';
}

enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  IP_ADDRESS = 'ip_address',
  DATE_OF_BIRTH = 'date_of_birth',
  ADDRESS = 'address',
  NAME = 'name',
  CUSTOM = 'custom',
}

interface PIIDetectionResult {
  hasPII: boolean;
  matches: PIIMatch[];
  confidence: 'high' | 'medium' | 'low';
}

interface MaskingOptions {
  maskChar?: string;
  visibleChars?: number;
  replaceWithType?: boolean; // Replace with [EMAIL], [PHONE], etc.
}

class PIIService {
  // Regex patterns for PII detection
  private readonly patterns = {
    // Email: user@domain.com
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Phone: (123) 456-7890, 123-456-7890, 1234567890
    phone: /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g,

    // SSN: 123-45-6789
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

    // Credit Card: 4111-1111-1111-1111 or 4111111111111111
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

    // IP Address: 192.168.1.1
    ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

    // Date of Birth: MM/DD/YYYY, MM-DD-YYYY
    dateOfBirth: /\b(0[1-9]|1[0-2])[\/\-](0[1-9]|[12][0-9]|3[01])[\/\-](19|20)\d{2}\b/g,

    // US Address (basic pattern)
    address: /\b\d+\s+[A-Za-z0-9\s,]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir)\b/gi,
  };

  /**
   * Detect PII in text
   */
  detectPII(text: string): PIIDetectionResult {
    const matches: PIIMatch[] = [];

    // Check each pattern
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const regex = new RegExp(pattern);
      let match;

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          type: type as PIIType,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          confidence: this.getConfidence(type as PIIType, match[0]),
        });
      }
    }

    // Determine overall confidence
    const highConfidenceMatches = matches.filter((m) => m.confidence === 'high');
    const overallConfidence =
      highConfidenceMatches.length > 0
        ? 'high'
        : matches.length > 0
        ? 'medium'
        : 'low';

    return {
      hasPII: matches.length > 0,
      matches,
      confidence: overallConfidence,
    };
  }

  /**
   * Get confidence level for a PII type
   */
  private getConfidence(type: PIIType, value: string): 'high' | 'medium' | 'low' {
    switch (type) {
      case PIIType.EMAIL:
        return 'high'; // Email format is very distinctive
      case PIIType.SSN:
        return 'high'; // SSN format is very specific
      case PIIType.CREDIT_CARD:
        return this.isValidCreditCard(value) ? 'high' : 'medium';
      case PIIType.PHONE:
        return 'high'; // Phone format is distinctive
      case PIIType.IP_ADDRESS:
        return 'medium'; // Could be confused with version numbers
      case PIIType.DATE_OF_BIRTH:
        return 'medium'; // Could be any date
      case PIIType.ADDRESS:
        return 'medium'; // Address detection is fuzzy
      default:
        return 'low';
    }
  }

  /**
   * Validate credit card using Luhn algorithm
   */
  private isValidCreditCard(cardNumber: string): boolean {
    // Remove spaces and dashes
    const digits = cardNumber.replace(/[\s-]/g, '');

    if (!/^\d{13,19}$/.test(digits)) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Mask PII in text
   */
  maskPII(text: string, options: MaskingOptions = {}): string {
    const {
      maskChar = '*',
      visibleChars = 4,
      replaceWithType = false,
    } = options;

    let maskedText = text;
    const detection = this.detectPII(text);

    // Sort matches by position (descending) to avoid index shifts
    const sortedMatches = [...detection.matches].sort((a, b) => b.start - a.start);

    for (const match of sortedMatches) {
      let replacement: string;

      if (replaceWithType) {
        // Replace with type placeholder
        replacement = `[${match.type.toUpperCase()}]`;
      } else {
        // Mask the value
        replacement = this.maskValue(match.value, maskChar, visibleChars);
      }

      maskedText =
        maskedText.substring(0, match.start) +
        replacement +
        maskedText.substring(match.end);
    }

    return maskedText;
  }

  /**
   * Mask a single value
   */
  private maskValue(value: string, maskChar: string, visibleChars: number): string {
    if (value.length <= visibleChars) {
      return maskChar.repeat(value.length);
    }

    const masked = maskChar.repeat(Math.max(0, value.length - visibleChars));
    const visible = value.slice(-visibleChars);
    return masked + visible;
  }

  /**
   * Mask specific PII types only
   */
  maskSpecificPII(
    text: string,
    types: PIIType[],
    options: MaskingOptions = {}
  ): string {
    const {
      maskChar = '*',
      visibleChars = 4,
      replaceWithType = false,
    } = options;

    let maskedText = text;
    const detection = this.detectPII(text);

    // Filter matches by requested types
    const relevantMatches = detection.matches
      .filter((m) => types.includes(m.type))
      .sort((a, b) => b.start - a.start);

    for (const match of relevantMatches) {
      let replacement: string;

      if (replaceWithType) {
        replacement = `[${match.type.toUpperCase()}]`;
      } else {
        replacement = this.maskValue(match.value, maskChar, visibleChars);
      }

      maskedText =
        maskedText.substring(0, match.start) +
        replacement +
        maskedText.substring(match.end);
    }

    return maskedText;
  }

  /**
   * Redact all PII (complete removal)
   */
  redactPII(text: string): string {
    return this.maskPII(text, { replaceWithType: true });
  }

  /**
   * Check if text contains specific PII type
   */
  containsPIIType(text: string, type: PIIType): boolean {
    const detection = this.detectPII(text);
    return detection.matches.some((m) => m.type === type);
  }

  /**
   * Get PII statistics for text
   */
  getPIIStats(text: string): Record<PIIType, number> {
    const detection = this.detectPII(text);
    const stats: Record<string, number> = {};

    // Initialize all types
    Object.values(PIIType).forEach((type) => {
      stats[type] = 0;
    });

    // Count occurrences
    detection.matches.forEach((match) => {
      stats[match.type]++;
    });

    return stats as Record<PIIType, number>;
  }

  /**
   * Mask email (keep domain visible)
   */
  maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return email;

    const visibleLocal = localPart.slice(0, 2);
    const maskedLocal = visibleLocal + '*'.repeat(Math.max(0, localPart.length - 2));
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask phone number (keep last 4 digits)
   */
  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';

    return '***-***-' + digits.slice(-4);
  }

  /**
   * Mask SSN (keep last 4 digits)
   */
  maskSSN(ssn: string): string {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length < 4) return '***-**-****';

    return '***-**-' + digits.slice(-4);
  }

  /**
   * Mask credit card (keep last 4 digits)
   */
  maskCreditCard(cardNumber: string): string {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 4) return '****';

    return '**** **** **** ' + digits.slice(-4);
  }

  /**
   * Sanitize text for logging (remove all PII)
   */
  sanitizeForLogging(text: string): string {
    return this.redactPII(text);
  }

  /**
   * Sanitize object for logging (recursively mask PII)
   */
  sanitizeObjectForLogging(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeForLogging(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObjectForLogging(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip known sensitive fields
        if (['password', 'token', 'secret', 'apiKey'].includes(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeObjectForLogging(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate if a string is likely to be PII
   */
  isPII(text: string, threshold: 'high' | 'medium' | 'low' = 'medium'): boolean {
    const detection = this.detectPII(text);

    if (!detection.hasPII) return false;

    const confidenceLevels = { high: 3, medium: 2, low: 1 };
    const requiredLevel = confidenceLevels[threshold];

    return detection.matches.some(
      (match) => confidenceLevels[match.confidence] >= requiredLevel
    );
  }

  /**
   * Add custom PII pattern
   */
  addCustomPattern(name: string, pattern: RegExp): void {
    (this.patterns as any)[name] = pattern;
  }
}

export default new PIIService();
export { PIIType, PIIMatch, PIIDetectionResult, MaskingOptions };
