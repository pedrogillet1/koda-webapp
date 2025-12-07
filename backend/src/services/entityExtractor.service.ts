/**
 * Entity Extractor Service
 *
 * Extracts named entities from document text using regex patterns and LLM.
 * Supports dates, money, people, organizations, locations, and domain-specific entities.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Entity types supported by the extractor
 */
export enum EntityType {
  // Time-related
  DATE = 'DATE',
  TIME = 'TIME',
  DURATION = 'DURATION',
  DATE_RANGE = 'DATE_RANGE',

  // People and organizations
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  JOB_TITLE = 'JOB_TITLE',

  // Location
  LOCATION = 'LOCATION',
  ADDRESS = 'ADDRESS',
  CITY = 'CITY',
  STATE = 'STATE',
  COUNTRY = 'COUNTRY',
  ZIP_CODE = 'ZIP_CODE',

  // Numeric values
  MONEY = 'MONEY',
  PERCENTAGE = 'PERCENTAGE',
  QUANTITY = 'QUANTITY',
  NUMBER = 'NUMBER',

  // Contact information
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  URL = 'URL',
  FAX = 'FAX',

  // Identifiers
  CONTRACT_ID = 'CONTRACT_ID',
  CASE_NUMBER = 'CASE_NUMBER',
  INVOICE_NUMBER = 'INVOICE_NUMBER',
  ACCOUNT_NUMBER = 'ACCOUNT_NUMBER',
  SSN = 'SSN',
  TAX_ID = 'TAX_ID',

  // Medical
  DIAGNOSIS = 'DIAGNOSIS',
  MEDICATION = 'MEDICATION',
  PROCEDURE = 'PROCEDURE',
  DOSAGE = 'DOSAGE',
  ICD_CODE = 'ICD_CODE',
  CPT_CODE = 'CPT_CODE',

  // Legal
  STATUTE = 'STATUTE',
  CASE_CITATION = 'CASE_CITATION',
  REGULATION = 'REGULATION',

  // Technical
  VERSION = 'VERSION',
  LICENSE_NUMBER = 'LICENSE_NUMBER',
  PRODUCT_CODE = 'PRODUCT_CODE',

  // Other
  OTHER = 'OTHER'
}

/**
 * Extracted entity structure
 */
export interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalizedValue: string;
  context: string;
  textIndex: number;
  confidence: number;
  pageNumber?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Regex patterns for structured entity extraction
 */
const PATTERNS: Record<string, { pattern: RegExp; type: EntityType; normalizer?: (match: string) => string }> = {
  // Dates - various formats
  isoDate: {
    pattern: /\b\d{4}-\d{2}-\d{2}\b/g,
    type: EntityType.DATE,
    normalizer: (m) => m
  },
  usDate: {
    pattern: /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:\d{2}|\d{4})\b/g,
    type: EntityType.DATE,
    normalizer: normalizeUSDate
  },
  euDate: {
    pattern: /\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/(?:\d{2}|\d{4})\b/g,
    type: EntityType.DATE,
    normalizer: normalizeEUDate
  },
  monthDayYear: {
    pattern: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
    type: EntityType.DATE,
    normalizer: normalizeMonthDate
  },
  dayMonthYear: {
    pattern: /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    type: EntityType.DATE,
    normalizer: normalizeMonthDate
  },

  // Time
  time12: {
    pattern: /\b(?:0?[1-9]|1[0-2]):[0-5]\d(?::[0-5]\d)?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)\b/g,
    type: EntityType.TIME,
    normalizer: normalizeTime
  },
  time24: {
    pattern: /\b(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/g,
    type: EntityType.TIME,
    normalizer: (m) => m
  },

  // Duration
  duration: {
    pattern: /\b\d+\s*(?:years?|months?|weeks?|days?|hours?|minutes?|mins?|seconds?|secs?)\b/gi,
    type: EntityType.DURATION,
    normalizer: normalizeDuration
  },

  // Money
  usdMoney: {
    pattern: /\$\s*[\d,]+(?:\.\d{2})?\s*(?:USD|dollars?|million|billion|M|B|K)?/gi,
    type: EntityType.MONEY,
    normalizer: normalizeMoney
  },
  euroMoney: {
    pattern: /€\s*[\d,]+(?:\.\d{2})?\s*(?:EUR|euros?)?/gi,
    type: EntityType.MONEY,
    normalizer: normalizeMoney
  },
  gbpMoney: {
    pattern: /£\s*[\d,]+(?:\.\d{2})?\s*(?:GBP|pounds?)?/gi,
    type: EntityType.MONEY,
    normalizer: normalizeMoney
  },
  writtenMoney: {
    pattern: /\b[\d,]+(?:\.\d{2})?\s*(?:dollars?|euros?|pounds?|USD|EUR|GBP)\b/gi,
    type: EntityType.MONEY,
    normalizer: normalizeMoney
  },

  // Percentage
  percentage: {
    pattern: /\b\d+(?:\.\d+)?(?:\s*%|\s*percent(?:age)?)\b/gi,
    type: EntityType.PERCENTAGE,
    normalizer: normalizePercentage
  },

  // Email
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: EntityType.EMAIL,
    normalizer: (m) => m.toLowerCase()
  },

  // Phone
  usPhone: {
    pattern: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    type: EntityType.PHONE,
    normalizer: normalizePhone
  },
  intlPhone: {
    pattern: /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
    type: EntityType.PHONE,
    normalizer: normalizePhone
  },

  // URL
  url: {
    pattern: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    type: EntityType.URL,
    normalizer: (m) => m
  },

  // ZIP Code
  usZip: {
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    type: EntityType.ZIP_CODE,
    normalizer: (m) => m
  },

  // SSN (masked for privacy)
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    type: EntityType.SSN,
    normalizer: (m) => `XXX-XX-${m.slice(-4)}`
  },

  // Tax ID / EIN
  taxId: {
    pattern: /\b\d{2}-\d{7}\b/g,
    type: EntityType.TAX_ID,
    normalizer: (m) => m
  },

  // Invoice/Contract numbers
  invoiceNumber: {
    pattern: /\b(?:INV|INVOICE|inv)[-#]?\s*\d+[A-Z0-9-]*\b/gi,
    type: EntityType.INVOICE_NUMBER,
    normalizer: (m) => m.toUpperCase()
  },
  contractId: {
    pattern: /\b(?:CONTRACT|CNT|CTR)[-#]?\s*\d+[A-Z0-9-]*\b/gi,
    type: EntityType.CONTRACT_ID,
    normalizer: (m) => m.toUpperCase()
  },

  // Case numbers
  caseNumber: {
    pattern: /\b(?:Case|Docket|No\.|#)\s*[:.]?\s*\d{2,4}[-/]\d+[-/]?[A-Z0-9-]*\b/gi,
    type: EntityType.CASE_NUMBER,
    normalizer: (m) => m.toUpperCase()
  },

  // Medical codes
  icdCode: {
    pattern: /\b[A-TV-Z]\d{2}(?:\.\d{1,4})?\b/g,
    type: EntityType.ICD_CODE,
    normalizer: (m) => m.toUpperCase()
  },
  cptCode: {
    pattern: /\b\d{5}(?:-\d{2})?\b/g,
    type: EntityType.CPT_CODE,
    normalizer: (m) => m
  },

  // Version numbers
  version: {
    pattern: /\bv(?:ersion)?\.?\s*\d+(?:\.\d+)*\b/gi,
    type: EntityType.VERSION,
    normalizer: (m) => m.toLowerCase().replace(/version\.?\s*/i, 'v')
  },

  // Quantity with units
  quantity: {
    pattern: /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:kg|lb|lbs|oz|g|mg|ml|L|units?|pieces?|items?|each|ea)\b/gi,
    type: EntityType.QUANTITY,
    normalizer: normalizeQuantity
  }
};

/**
 * Main entity extraction function
 */
export async function extractEntities(
  text: string,
  options: {
    useLLM?: boolean;
    domain?: string;
    maxEntities?: number;
  } = {}
): Promise<ExtractedEntity[]> {
  const { useLLM = true, domain, maxEntities = 500 } = options;

  // Step 1: Extract structured entities using regex
  const structuredEntities = extractStructuredEntities(text);

  // Step 2: Extract complex entities using LLM (if enabled)
  let complexEntities: ExtractedEntity[] = [];
  if (useLLM && text.length > 100) {
    complexEntities = await extractComplexEntities(text, domain);
  }

  // Combine and deduplicate
  const allEntities = [...structuredEntities, ...complexEntities];
  const deduped = deduplicateEntities(allEntities);

  // Sort by position and limit
  return deduped
    .sort((a, b) => a.textIndex - b.textIndex)
    .slice(0, maxEntities);
}

/**
 * Extract entities using regex patterns
 */
function extractStructuredEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const [, config] of Object.entries(PATTERNS)) {
    const { pattern, type, normalizer } = config;

    // Reset regex lastIndex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];
      const normalizedValue = normalizer ? normalizer(value) : value;
      const textIndex = match.index;
      const context = getContext(text, textIndex, value.length);

      entities.push({
        type,
        value,
        normalizedValue,
        context,
        textIndex,
        confidence: 0.95 // High confidence for regex matches
      });
    }
  }

  return entities;
}

/**
 * Extract complex entities using LLM
 */
async function extractComplexEntities(
  text: string,
  domain?: string
): Promise<ExtractedEntity[]> {
  try {
    // Use first 6000 characters
    const truncatedText = text.slice(0, 6000);

    const prompt = `Extract named entities from this text. Focus on:
- People names (PERSON)
- Organization names (ORGANIZATION)
- Job titles (JOB_TITLE)
- Locations, cities, countries (LOCATION, CITY, COUNTRY)
- Addresses (ADDRESS)
${domain === 'medical' ? '- Medical diagnoses (DIAGNOSIS)\n- Medications (MEDICATION)\n- Medical procedures (PROCEDURE)' : ''}
${domain === 'legal' ? '- Legal statutes (STATUTE)\n- Case citations (CASE_CITATION)' : ''}

TEXT:
${truncatedText}

Return a JSON array of entities:
[
  {"type": "PERSON", "value": "John Smith", "textIndex": 45},
  {"type": "ORGANIZATION", "value": "Acme Corp", "textIndex": 102}
]

Only include entities you're confident about. Return only the JSON array, no other text.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return parsed.map((entity: { type: string; value: string; textIndex?: number }) => ({
      type: normalizeEntityType(entity.type),
      value: entity.value,
      normalizedValue: entity.value,
      context: getContext(text, entity.textIndex || 0, entity.value.length),
      textIndex: entity.textIndex || text.indexOf(entity.value),
      confidence: 0.8 // Lower confidence for LLM extractions
    }));
  } catch (error) {
    console.error('[EntityExtractor] LLM extraction failed:', error);
    return [];
  }
}

/**
 * Get surrounding context for an entity
 */
function getContext(text: string, index: number, length: number, contextSize: number = 50): string {
  const start = Math.max(0, index - contextSize);
  const end = Math.min(text.length, index + length + contextSize);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Normalize US date to ISO format
 */
function normalizeUSDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;

  const [month, day, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Normalize EU date to ISO format
 */
function normalizeEUDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;

  const [day, month, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Normalize month name date to ISO format
 */
function normalizeMonthDate(dateStr: string): string {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
  };

  const match = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})|(\d{4})/i);
  const monthMatch = dateStr.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)/i);

  if (!monthMatch) return dateStr;

  const month = months[monthMatch[0].toLowerCase()];
  const dayMatch = dateStr.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  const yearMatch = dateStr.match(/\b(\d{4})\b/);

  if (!month || !dayMatch || !yearMatch) return dateStr;

  return `${yearMatch[1]}-${month}-${dayMatch[1].padStart(2, '0')}`;
}

/**
 * Normalize time to 24-hour format
 */
function normalizeTime(timeStr: string): string {
  const isPM = /pm|p\.m\./i.test(timeStr);
  const isAM = /am|a\.m\./i.test(timeStr);

  const timePart = timeStr.replace(/\s*(am|pm|a\.m\.|p\.m\.)\s*/gi, '');
  const [hours, minutes, seconds = '00'] = timePart.split(':');

  let hour = parseInt(hours, 10);
  if (isPM && hour !== 12) hour += 12;
  if (isAM && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, '0')}:${minutes}:${seconds}`;
}

/**
 * Normalize duration to standard format
 */
function normalizeDuration(durationStr: string): string {
  const value = durationStr.match(/\d+/)?.[0] || '0';
  const unit = durationStr.match(/(?:years?|months?|weeks?|days?|hours?|minutes?|mins?|seconds?|secs?)/i)?.[0]?.toLowerCase() || '';

  const unitMap: Record<string, string> = {
    year: 'years', years: 'years',
    month: 'months', months: 'months',
    week: 'weeks', weeks: 'weeks',
    day: 'days', days: 'days',
    hour: 'hours', hours: 'hours',
    minute: 'minutes', minutes: 'minutes', min: 'minutes', mins: 'minutes',
    second: 'seconds', seconds: 'seconds', sec: 'seconds', secs: 'seconds'
  };

  return `${value} ${unitMap[unit] || unit}`;
}

/**
 * Normalize money value
 */
function normalizeMoney(moneyStr: string): string {
  // Extract numeric value
  const numericMatch = moneyStr.match(/[\d,]+(?:\.\d{2})?/);
  if (!numericMatch) return moneyStr;

  const numericValue = parseFloat(numericMatch[0].replace(/,/g, ''));

  // Check for multipliers
  let multiplier = 1;
  if (/million|M\b/i.test(moneyStr)) multiplier = 1000000;
  if (/billion|B\b/i.test(moneyStr)) multiplier = 1000000000;
  if (/K\b/i.test(moneyStr)) multiplier = 1000;

  // Determine currency
  let currency = 'USD';
  if (/€|EUR|euro/i.test(moneyStr)) currency = 'EUR';
  if (/£|GBP|pound/i.test(moneyStr)) currency = 'GBP';

  return `${currency} ${(numericValue * multiplier).toFixed(2)}`;
}

/**
 * Normalize percentage
 */
function normalizePercentage(percentStr: string): string {
  const value = percentStr.match(/[\d.]+/)?.[0] || '0';
  return `${value}%`;
}

/**
 * Normalize phone number (digits only)
 */
function normalizePhone(phoneStr: string): string {
  return phoneStr.replace(/[^\d+]/g, '');
}

/**
 * Normalize quantity
 */
function normalizeQuantity(quantityStr: string): string {
  const value = quantityStr.match(/[\d,.]+/)?.[0]?.replace(/,/g, '') || '0';
  const unit = quantityStr.match(/(?:kg|lb|lbs|oz|g|mg|ml|L|units?|pieces?|items?|each|ea)/i)?.[0]?.toLowerCase() || '';

  const unitMap: Record<string, string> = {
    lb: 'lbs', lbs: 'lbs',
    unit: 'units', units: 'units',
    piece: 'pieces', pieces: 'pieces',
    item: 'items', items: 'items',
    each: 'units', ea: 'units'
  };

  return `${value} ${unitMap[unit] || unit}`;
}

/**
 * Normalize entity type string to enum
 */
function normalizeEntityType(type: string): EntityType {
  const normalized = type.toUpperCase().replace(/[^A-Z_]/g, '');

  if (Object.values(EntityType).includes(normalized as EntityType)) {
    return normalized as EntityType;
  }

  // Map common variations
  const typeMap: Record<string, EntityType> = {
    'NAME': EntityType.PERSON,
    'COMPANY': EntityType.ORGANIZATION,
    'ORG': EntityType.ORGANIZATION,
    'PLACE': EntityType.LOCATION,
    'LOC': EntityType.LOCATION,
    'ADDR': EntityType.ADDRESS,
    'DOLLAR': EntityType.MONEY,
    'CURRENCY': EntityType.MONEY,
    'PERCENT': EntityType.PERCENTAGE,
    'TEL': EntityType.PHONE,
    'TELEPHONE': EntityType.PHONE,
    'DRUG': EntityType.MEDICATION,
    'MED': EntityType.MEDICATION,
    'DX': EntityType.DIAGNOSIS
  };

  return typeMap[normalized] || EntityType.OTHER;
}

/**
 * Deduplicate entities by value and type
 */
function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = `${entity.type}:${entity.normalizedValue}`;

    if (!seen.has(key) || entity.confidence > seen.get(key)!.confidence) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

/**
 * Batch extract entities from multiple texts
 */
export async function extractEntitiesBatch(
  texts: Array<{ id: string; text: string; domain?: string }>
): Promise<Map<string, ExtractedEntity[]>> {
  const results = new Map<string, ExtractedEntity[]>();

  for (const { id, text, domain } of texts) {
    const entities = await extractEntities(text, { domain });
    results.set(id, entities);
  }

  return results;
}

export default {
  extractEntities,
  extractEntitiesBatch,
  EntityType
};
