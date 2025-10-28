/**
 * Privacy-Aware Field Extraction Service
 * Extracts ONLY the requested field from sensitive identification documents
 * Supports: Passports, Driver's Licenses, National IDs
 * Prevents over-sharing of personal information
 */

type DocumentType = 'passport' | 'drivers_license' | 'national_id' | 'unknown';

type FieldType = 'issue_date' | 'expiry_date' | 'document_number' | 'full_name' | 'dob' |
                 'nationality' | 'license_class' | 'address' | 'unknown';

interface IdentificationField {
  type: FieldType;
  value: string | null;
}

export class PrivacyAwareExtractor {

  /**
   * Main entry point: Extract only the requested field from any identification document
   */
  async extractIdentificationField(query: string, ocrText: string, filename: string = ''): Promise<string> {
    const docType = this.detectDocumentType(ocrText, filename);
    const requestedField = this.classifyFieldQuery(query);

    // Get the appropriate document type name for user-facing messages
    const docTypeName = this.getDocumentTypeName(docType);

    switch (requestedField) {
      case 'issue_date':
        const issueDate = this.extractIssueDate(ocrText, docType);
        return issueDate
          ? `Your ${docTypeName} was issued on ${issueDate}.`
          : `I couldn't find the issue date in your ${docTypeName}.`;

      case 'expiry_date':
        const expiryDate = this.extractExpiryDate(ocrText, docType);
        return expiryDate
          ? `Your ${docTypeName} expires on ${expiryDate}.`
          : `I couldn't find the expiration date in your ${docTypeName}.`;

      case 'document_number':
        const number = this.extractDocumentNumber(ocrText, docType);
        return number
          ? `Your ${this.getNumberFieldName(docType)} is ${number}.`
          : `I couldn't find the ${this.getNumberFieldName(docType)}.`;

      case 'full_name':
        const name = this.extractFullName(ocrText);
        return name
          ? `Your full name on the ${docTypeName} is ${name}.`
          : `I couldn't find the name.`;

      case 'dob':
        const dob = this.extractDateOfBirth(ocrText);
        return dob
          ? `Your date of birth is ${dob}.`
          : `I couldn't find the date of birth.`;

      case 'nationality':
        const nationality = this.extractNationality(ocrText);
        return nationality
          ? `Your nationality is ${nationality}.`
          : `I couldn't find the nationality.`;

      case 'license_class':
        const licenseClass = this.extractLicenseClass(ocrText);
        return licenseClass
          ? `Your license class is ${licenseClass}.`
          : `I couldn't find the license class.`;

      case 'address':
        const address = this.extractAddress(ocrText);
        return address
          ? `Your address is ${address}.`
          : `I couldn't find the address.`;

      default:
        return this.getDefaultPrompt(docType);
    }
  }

  /**
   * Detect what type of identification document this is
   */
  private detectDocumentType(ocrText: string, filename: string = ''): DocumentType {
    const lowerText = ocrText.toLowerCase();
    const lowerFilename = filename.toLowerCase();

    // Passport detection
    if (lowerText.includes('passport') ||
        lowerText.includes('passaporte') ||
        lowerFilename.includes('passport')) {
      return 'passport';
    }

    // Driver's License detection
    if (lowerText.includes('driver') ||
        lowerText.includes('driving') ||
        lowerText.includes('carteira nacional de habilitação') ||
        lowerText.includes('cnh') ||
        lowerText.includes('license class') ||
        lowerFilename.includes('license') ||
        lowerFilename.includes('driver')) {
      return 'drivers_license';
    }

    // National ID detection
    if (lowerText.includes('identity card') ||
        lowerText.includes('national id') ||
        lowerText.includes('rg') ||
        lowerText.includes('registro geral') ||
        lowerText.includes('cpf') ||
        lowerFilename.includes('id') ||
        lowerFilename.includes('rg')) {
      return 'national_id';
    }

    return 'unknown';
  }

  /**
   * Get user-facing document type name
   */
  private getDocumentTypeName(docType: DocumentType): string {
    switch (docType) {
      case 'passport': return 'passport';
      case 'drivers_license': return "driver's license";
      case 'national_id': return 'ID';
      default: return 'document';
    }
  }

  /**
   * Get the appropriate field name for document number
   */
  private getNumberFieldName(docType: DocumentType): string {
    switch (docType) {
      case 'passport': return 'passport number';
      case 'drivers_license': return 'license number';
      case 'national_id': return 'ID number';
      default: return 'document number';
    }
  }

  /**
   * Get default prompt for unknown field queries
   */
  private getDefaultPrompt(docType: DocumentType): string {
    switch (docType) {
      case 'passport':
        return "I found your passport. Which field would you like to know: issue date, expiry date, passport number, name, date of birth, or nationality?";
      case 'drivers_license':
        return "I found your driver's license. Which field would you like to know: issue date, expiry date, license number, name, date of birth, license class, or address?";
      case 'national_id':
        return "I found your ID. Which field would you like to know: issue date, expiry date, ID number, name, date of birth, or address?";
      default:
        return "I found your identification document. Which field would you like to know?";
    }
  }

  /**
   * Determine what field the user is asking for
   */
  private classifyFieldQuery(query: string): FieldType {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('issue') || lowerQuery.includes('issued')) {
      return 'issue_date';
    }
    if (lowerQuery.includes('expir') || lowerQuery.includes('valid') || lowerQuery.includes('expiration')) {
      return 'expiry_date';
    }
    if (lowerQuery.includes('number') || lowerQuery.includes('número')) {
      return 'document_number';
    }
    if (lowerQuery.includes('name') || lowerQuery.includes('nome')) {
      return 'full_name';
    }
    if (lowerQuery.includes('birth') || lowerQuery.includes('born') || lowerQuery.includes('dob') || lowerQuery.includes('nascimento')) {
      return 'dob';
    }
    if (lowerQuery.includes('national') || lowerQuery.includes('nacionalidade')) {
      return 'nationality';
    }
    if (lowerQuery.includes('class') || lowerQuery.includes('categoria')) {
      return 'license_class';
    }
    if (lowerQuery.includes('address') || lowerQuery.includes('endereço')) {
      return 'address';
    }

    return 'unknown';
  }

  /**
   * Extract issue date from OCR text (supports all ID document types)
   */
  private extractIssueDate(ocrText: string, docType: DocumentType): string | null {
    const patterns = [
      // Passport patterns
      /(?:data\s+de\s+emiss[aã]o|date\s+of\s+issue)[:\s]*(\d{2}[\s\/\-][A-Z]{3}[\s\/\-]\d{4})/gi,
      /(?:emiss[aã]o|issue)[:\s]*(\d{2}[\s\/\-][A-Z]{3}[\s\/\-]\d{4})/gi,
      /(?:data\s+de\s+emiss[aã]o|date\s+of\s+issue)[:\s]*(\d{2}[\s\/\-]\d{2}[\s\/\-]\d{4})/gi,

      // Driver's License patterns
      /(?:data\s+de\s+emiss[aã]o|issue\s+date|issued)[:\s]*(\d{2}[\s\/\-]\d{2}[\s\/\-]\d{4})/gi,

      // National ID patterns
      /(?:data\s+de\s+emiss[aã]o|emiss[aã]o)[:\s]*(\d{2}[\s\/\-]\d{2}[\s\/\-]\d{4})/gi
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }

  /**
   * Extract expiry date from OCR text (supports all ID document types)
   */
  private extractExpiryDate(ocrText: string, docType: DocumentType): string | null {
    const patterns = [
      // Passport patterns
      /(?:data\s+de\s+validade|date\s+of\s+expiry)[:\s]*(\d{2}[\s\/\-][A-Z]{3}[\s\/\-]\d{4})/gi,
      /(?:validade|expiry|expires)[:\s]*(\d{2}[\s\/\-][A-Z]{3}[\s\/\-]\d{4})/gi,
      /(?:data\s+de\s+validade|date\s+of\s+expiry)[:\s]*(\d{2}[\s\/\-]\d{2}[\s\/\-]\d{4})/gi,

      // Driver's License patterns
      /(?:validade|valid\s+until|expiration)[:\s]*(\d{2}[\s\/\-]\d{2}[\s\/\-]\d{4})/gi,

      // National ID patterns (some IDs don't expire)
      /(?:data\s+de\s+validade|validade)[:\s]*(\d{2}[\s\/\-]\d{2}[\s\/\-]\d{4})/gi
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }

  /**
   * Extract document number based on document type
   */
  private extractDocumentNumber(ocrText: string, docType: DocumentType): string | null {
    switch (docType) {
      case 'passport':
        return this.extractPassportNumber(ocrText);
      case 'drivers_license':
        return this.extractLicenseNumber(ocrText);
      case 'national_id':
        return this.extractIdNumber(ocrText);
      default:
        return null;
    }
  }

  /**
   * Extract passport number (Brazilian format: 2 letters + 6-7 digits, or international formats)
   */
  private extractPassportNumber(ocrText: string): string | null {
    const patterns = [
      /\b[A-Z]{2}\d{6,7}\b/,  // Brazilian passport (e.g., AB1234567)
      /(?:passport\s+no|passaporte|n[oº])[:\s]*([A-Z]{1,2}\d{6,9})/gi,  // Generic passport number
      /\b[A-Z]\d{8}\b/  // Some countries use 1 letter + 8 digits
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return match[0].trim();
    }

    return null;
  }

  /**
   * Extract driver's license number
   */
  private extractLicenseNumber(ocrText: string): string | null {
    const patterns = [
      /(?:registro|n[oº]|number)[:\s]*(\d{11})/gi,  // Brazilian CNH (11 digits)
      /(?:license\s+no|driver\s+license)[:\s]*([A-Z0-9]{6,12})/gi,  // International formats
      /\b\d{11}\b/  // 11-digit number (common in Brazilian CNH)
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return match[1] ? match[1].trim() : match[0].trim();
    }

    return null;
  }

  /**
   * Extract national ID number
   */
  private extractIdNumber(ocrText: string): string | null {
    const patterns = [
      /(?:rg|registro\s+geral)[:\s]*([\d\.\-]+)/gi,  // Brazilian RG
      /(?:cpf)[:\s]*([\d\.\-]+)/gi,  // Brazilian CPF
      /(?:id\s+no|identity\s+no)[:\s]*([A-Z0-9\.\-]+)/gi,  // Generic ID number
      /\b\d{1,2}\.\d{3}\.\d{3}\-[0-9X]\b/  // RG format (e.g., 12.345.678-9)
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return match[1] ? match[1].trim() : match[0].trim();
    }

    return null;
  }

  /**
   * Extract full name from OCR text
   */
  private extractFullName(ocrText: string): string | null {
    const patterns = [
      /(?:nome|name)[:\s]*([A-Z][A-Z\s]+)/i,
      /\n([A-Z]{2,}\s+[A-Z]{2,}\s+[A-Z]{2,})/  // Full caps name
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) {
        const name = match[1].trim();
        // Filter out common passport keywords
        if (!name.match(/PASSPORT|BRASILEIRO|REPUBLIC|FEDERAL/i) && name.length > 10) {
          return name;
        }
      }
    }

    return null;
  }

  /**
   * Extract date of birth from OCR text
   */
  private extractDateOfBirth(ocrText: string): string | null {
    const patterns = [
      /(?:data\s+de\s+nascimento|date\s+of\s+birth)[:\s]*(\d{2}[\s\/\-][A-Z]{3}[\s\/\-]\d{4})/gi,
      /(?:nascimento|birth)[:\s]*(\d{2}[\s\/\-][A-Z]{3}[\s\/\-]\d{4})/gi,
      /(?:data\s+de\s+nascimento|date\s+of\s+birth)[:\s]*(\d{2}[\s\/\-]\d{2}[\s\/\-]\d{4})/gi
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }

  /**
   * Extract nationality from OCR text
   */
  private extractNationality(ocrText: string): string | null {
    const pattern = /(?:nacionalidade|nationality)[:\s]*([A-Z]+(?:\([A-Z]\))?)/i;
    const match = ocrText.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract license class (for driver's licenses)
   */
  private extractLicenseClass(ocrText: string): string | null {
    const patterns = [
      /(?:categoria|class|type)[:\s]*([A-Z]{1,3}(?:,\s*[A-Z]{1,3})*)/gi,  // e.g., "Class: AB" or "Categoria: A, B"
      /\b(A|B|C|D|E|AB|AC|AD|AE|ABC|ABD|ABE)\b/  // Direct class matches (common in Brazilian CNH)
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) return match[1] ? match[1].trim() : match[0].trim();
    }

    return null;
  }

  /**
   * Extract address from OCR text
   */
  private extractAddress(ocrText: string): string | null {
    const patterns = [
      /(?:endereço|address)[:\s]*([A-Za-z0-9\s,\.\-]+(?:\d{5}[\-\s]?\d{3})?)/gi,  // General address pattern
      /(?:rua|av|avenida|street|road)[:\s]*([A-Za-z0-9\s,\.\-]+)/gi  // Street-specific pattern
    ];

    for (const pattern of patterns) {
      const match = ocrText.match(pattern);
      if (match) {
        const address = match[1] ? match[1].trim() : match[0].trim();
        // Filter out very short matches (likely noise)
        if (address.length > 10) {
          return address;
        }
      }
    }

    return null;
  }

  /**
   * Check if query is asking for a specific identification document field
   */
  isIdentificationFieldQuery(query: string): boolean {
    const fieldKeywords = [
      'passport number', 'passport issue', 'passport expir', 'passport name', 'passport birth', 'passport national',
      'when does my passport', 'what is my passport', 'passport valid',
      'license number', 'license class', 'license issue', 'license expir', 'driver license',
      'when does my license', 'what is my license', 'license valid',
      'id number', 'national id', 'id card', 'rg', 'cpf',
      'when does my id', 'what is my id', 'id expir'
    ];

    const lowerQuery = query.toLowerCase();
    return fieldKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Legacy method for backward compatibility - redirects to extractIdentificationField
   */
  async extractPassportField(query: string, ocrText: string): Promise<string> {
    return this.extractIdentificationField(query, ocrText, '');
  }

  /**
   * Legacy method for backward compatibility
   */
  isPassportFieldQuery(query: string): boolean {
    return this.isIdentificationFieldQuery(query);
  }
}

export default new PrivacyAwareExtractor();
