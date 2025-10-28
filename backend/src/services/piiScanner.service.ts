/**
 * PII (Personally Identifiable Information) Scanner Service
 * Scans OCR text from images to detect and categorize personal information
 * Handles queries like "What personal information can you find in this image?"
 */

export type PIIType =
  | 'NAME'
  | 'EMAIL'
  | 'PHONE'
  | 'ADDRESS'
  | 'SSN'
  | 'PASSPORT_NUMBER'
  | 'DRIVERS_LICENSE'
  | 'CREDIT_CARD'
  | 'DATE_OF_BIRTH'
  | 'NATIONAL_ID';

interface PIIMatch {
  type: PIIType;
  value: string;
  confidence: number;
  context: string;
}

interface PIIScanResult {
  hasPII: boolean;
  piiFound: PIIMatch[];
  summary: string;
}

export class PIIScanner {

  /**
   * Main entry point: scan OCR text for PII
   */
  scanForPII(ocrText: string, filename: string = ''): PIIScanResult {
    const piiFound: PIIMatch[] = [];

    // Scan for different types of PII
    piiFound.push(...this.scanForEmails(ocrText));
    piiFound.push(...this.scanForPhoneNumbers(ocrText));
    piiFound.push(...this.scanForSSN(ocrText));
    piiFound.push(...this.scanForCreditCards(ocrText));
    piiFound.push(...this.scanForPassportNumbers(ocrText));
    piiFound.push(...this.scanForDriversLicense(ocrText));
    piiFound.push(...this.scanForNationalID(ocrText));
    piiFound.push(...this.scanForDateOfBirth(ocrText));
    piiFound.push(...this.scanForNames(ocrText));
    piiFound.push(...this.scanForAddresses(ocrText));

    // Generate summary
    const summary = this.generateSummary(piiFound, filename);

    return {
      hasPII: piiFound.length > 0,
      piiFound,
      summary
    };
  }

  /**
   * Check if query is asking about PII
   */
  isPIIQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    const piiKeywords = [
      'personal information',
      'personal data',
      'pii',
      'sensitive information',
      'what information',
      'what data',
      'what can you find',
      'what\'s in',
      'informação pessoal',
      'dados pessoais'
    ];

    return piiKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Scan for email addresses
   */
  private scanForEmails(text: string): PIIMatch[] {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches: PIIMatch[] = [];

    let match;
    while ((match = emailPattern.exec(text)) !== null) {
      matches.push({
        type: 'EMAIL',
        value: match[0],
        confidence: 0.95,
        context: this.getContext(text, match.index, 30)
      });
    }

    return matches;
  }

  /**
   * Scan for phone numbers
   */
  private scanForPhoneNumbers(text: string): PIIMatch[] {
    const phonePatterns = [
      // US format: (123) 456-7890, 123-456-7890
      /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      // International format: +1 234 567 8900
      /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
      // Brazilian format: (11) 98765-4321
      /\b\(?\d{2}\)?[-.\s]?9?\d{4}[-.\s]?\d{4}\b/g
    ];

    const matches: PIIMatch[] = [];

    for (const pattern of phonePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          type: 'PHONE',
          value: match[0],
          confidence: 0.85,
          context: this.getContext(text, match.index, 30)
        });
      }
    }

    return this.deduplicateMatches(matches);
  }

  /**
   * Scan for Social Security Numbers (US)
   */
  private scanForSSN(text: string): PIIMatch[] {
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
    const matches: PIIMatch[] = [];

    let match;
    while ((match = ssnPattern.exec(text)) !== null) {
      matches.push({
        type: 'SSN',
        value: match[0],
        confidence: 0.9,
        context: this.getContext(text, match.index, 30)
      });
    }

    return matches;
  }

  /**
   * Scan for credit card numbers
   */
  private scanForCreditCards(text: string): PIIMatch[] {
    // Match 13-19 digit numbers (with optional spaces/dashes)
    const cardPattern = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4,7}\b/g;
    const matches: PIIMatch[] = [];

    let match;
    while ((match = cardPattern.exec(text)) !== null) {
      const digits = match[0].replace(/[-\s]/g, '');

      // Basic Luhn algorithm check
      if (this.passesLuhnCheck(digits)) {
        matches.push({
          type: 'CREDIT_CARD',
          value: match[0],
          confidence: 0.8,
          context: this.getContext(text, match.index, 30)
        });
      }
    }

    return matches;
  }

  /**
   * Scan for passport numbers
   */
  private scanForPassportNumbers(text: string): PIIMatch[] {
    const passportPatterns = [
      // Brazilian passport: 2 letters + 6-7 digits
      /\b[A-Z]{2}\d{6,7}\b/g,
      // Generic passport patterns
      /(?:passport|passaporte)[\s:]+([A-Z]{1,2}\d{6,9})/gi
    ];

    const matches: PIIMatch[] = [];

    for (const pattern of passportPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = match[1] || match[0];
        matches.push({
          type: 'PASSPORT_NUMBER',
          value,
          confidence: 0.75,
          context: this.getContext(text, match.index, 40)
        });
      }
    }

    return this.deduplicateMatches(matches);
  }

  /**
   * Scan for driver's license numbers
   */
  private scanForDriversLicense(text: string): PIIMatch[] {
    const licensePatterns = [
      // Brazilian CNH: 11 digits
      /\b\d{11}\b/g,
      // US DL patterns (varies by state)
      /(?:license|driver|cnh)[\s:]+([A-Z0-9]{6,12})/gi
    ];

    const matches: PIIMatch[] = [];
    const lowerText = text.toLowerCase();

    // Only look for license numbers if document context suggests it's a license
    if (lowerText.includes('license') || lowerText.includes('driver') || lowerText.includes('cnh')) {
      for (const pattern of licensePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const value = match[1] || match[0];
          matches.push({
            type: 'DRIVERS_LICENSE',
            value,
            confidence: 0.7,
            context: this.getContext(text, match.index, 40)
          });
        }
      }
    }

    return this.deduplicateMatches(matches);
  }

  /**
   * Scan for national ID numbers (RG, CPF, etc.)
   */
  private scanForNationalID(text: string): PIIMatch[] {
    const idPatterns = [
      // Brazilian CPF: XXX.XXX.XXX-XX
      /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
      // Brazilian RG: XX.XXX.XXX-X
      /\b\d{1,2}\.\d{3}\.\d{3}-[0-9X]\b/g,
      // Generic ID patterns
      /(?:rg|cpf|id)[\s:]+([0-9.\-]+)/gi
    ];

    const matches: PIIMatch[] = [];

    for (const pattern of idPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = match[1] || match[0];
        matches.push({
          type: 'NATIONAL_ID',
          value,
          confidence: 0.8,
          context: this.getContext(text, match.index, 40)
        });
      }
    }

    return this.deduplicateMatches(matches);
  }

  /**
   * Scan for dates of birth
   */
  private scanForDateOfBirth(text: string): PIIMatch[] {
    const dobPatterns = [
      // "Date of Birth: MM/DD/YYYY"
      /(?:date of birth|dob|born|nascimento)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      // "Date of Birth: DD MMM YYYY"
      /(?:date of birth|dob|born|nascimento)[\s:]+(\d{1,2}\s+[A-Z]{3}\s+\d{4})/gi
    ];

    const matches: PIIMatch[] = [];

    for (const pattern of dobPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          type: 'DATE_OF_BIRTH',
          value: match[1],
          confidence: 0.85,
          context: this.getContext(text, match.index, 50)
        });
      }
    }

    return matches;
  }

  /**
   * Scan for names (basic heuristic)
   */
  private scanForNames(text: string): PIIMatch[] {
    const namePatterns = [
      // "Name: John Doe"
      /(?:name|nome)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
      // Full caps names (common in ID documents)
      /\b([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)\b/g
    ];

    const matches: PIIMatch[] = [];
    const blacklist = ['PASSPORT', 'REPUBLIC', 'FEDERAL', 'BRASIL', 'UNITED STATES', 'DRIVER LICENSE'];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1];

        // Filter out false positives
        if (!blacklist.some(b => name.includes(b)) && name.length > 5 && name.length < 50) {
          matches.push({
            type: 'NAME',
            value: name,
            confidence: 0.6,
            context: this.getContext(text, match.index, 40)
          });
        }
      }
    }

    return this.deduplicateMatches(matches);
  }

  /**
   * Scan for addresses
   */
  private scanForAddresses(text: string): PIIMatch[] {
    const addressPatterns = [
      // Street address with number
      /(?:address|endereço)[\s:]+([0-9]+\s+[A-Za-z\s,]+(?:\d{5})?)/gi,
      // Brazilian CEP: XXXXX-XXX
      /\b\d{5}-\d{3}\b/g
    ];

    const matches: PIIMatch[] = [];

    for (const pattern of addressPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = match[1] || match[0];
        if (value.length > 10 && value.length < 150) {
          matches.push({
            type: 'ADDRESS',
            value,
            confidence: 0.65,
            context: this.getContext(text, match.index, 50)
          });
        }
      }
    }

    return this.deduplicateMatches(matches);
  }

  /**
   * Luhn algorithm for credit card validation
   */
  private passesLuhnCheck(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber[i]);

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
   * Get context around a match
   */
  private getContext(text: string, index: number, contextLength: number): string {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + contextLength);
    return '...' + text.substring(start, end).trim() + '...';
  }

  /**
   * Deduplicate matches by value
   */
  private deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
    const seen = new Set<string>();
    return matches.filter(match => {
      const key = `${match.type}:${match.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(piiFound: PIIMatch[], filename: string): string {
    if (piiFound.length === 0) {
      return `No personal information detected in ${filename || 'this document'}.`;
    }

    // Group by type
    const byType: Record<string, number> = {};
    for (const pii of piiFound) {
      byType[pii.type] = (byType[pii.type] || 0) + 1;
    }

    const typeNames: Record<PIIType, string> = {
      NAME: 'name(s)',
      EMAIL: 'email address(es)',
      PHONE: 'phone number(s)',
      ADDRESS: 'address(es)',
      SSN: 'Social Security Number(s)',
      PASSPORT_NUMBER: 'passport number(s)',
      DRIVERS_LICENSE: 'driver\'s license number(s)',
      CREDIT_CARD: 'credit card number(s)',
      DATE_OF_BIRTH: 'date(s) of birth',
      NATIONAL_ID: 'national ID number(s)'
    };

    const findings: string[] = [];
    for (const [type, count] of Object.entries(byType)) {
      const typeName = typeNames[type as PIIType] || type;
      findings.push(`${count} ${typeName}`);
    }

    const docRef = filename ? ` in "${filename}"` : '';
    return `Found ${piiFound.length} pieces of personal information${docRef}:\n- ${findings.join('\n- ')}`;
  }

  /**
   * Get detailed PII report for user
   */
  getDetailedReport(scanResult: PIIScanResult): string {
    if (!scanResult.hasPII) {
      return scanResult.summary;
    }

    let report = scanResult.summary + '\n\nDetails:\n';

    // Sort by confidence (highest first)
    const sorted = [...scanResult.piiFound].sort((a, b) => b.confidence - a.confidence);

    for (const pii of sorted) {
      const confidencePercent = Math.round(pii.confidence * 100);
      report += `\n${pii.type}: ${pii.value} (${confidencePercent}% confidence)`;
    }

    return report;
  }
}

export default new PIIScanner();
