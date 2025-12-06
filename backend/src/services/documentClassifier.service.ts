/**
 * Document Classifier Service
 *
 * Classifies documents into types and domains using LLM-based analysis.
 * Provides document-level intelligence for routing and search optimization.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Document Taxonomy - 100+ document types organized by domain
 */
export const DOCUMENT_TAXONOMY = {
  legal: [
    'contract', 'employment_contract', 'lease_agreement', 'service_agreement',
    'nda', 'license_agreement', 'settlement_agreement', 'partnership_agreement',
    'memorandum_of_understanding', 'power_of_attorney', 'will_testament',
    'trust_document', 'court_filing', 'legal_brief', 'motion', 'affidavit',
    'deposition', 'subpoena', 'warrant', 'judgment', 'patent', 'trademark',
    'copyright', 'terms_of_service', 'privacy_policy', 'compliance_document',
    'regulatory_filing', 'corporate_bylaws', 'articles_of_incorporation',
    'shareholder_agreement', 'merger_agreement', 'acquisition_agreement'
  ],
  medical: [
    'medical_record', 'patient_history', 'progress_note', 'discharge_summary',
    'operative_report', 'pathology_report', 'radiology_report', 'lab_results',
    'prescription', 'medication_list', 'insurance_claim', 'prior_authorization',
    'referral', 'consultation_note', 'physical_exam', 'treatment_plan',
    'care_plan', 'nursing_assessment', 'mental_health_evaluation',
    'vaccination_record', 'immunization_history', 'allergy_list',
    'informed_consent', 'hipaa_authorization', 'medical_certificate',
    'death_certificate', 'autopsy_report', 'clinical_trial_document'
  ],
  financial: [
    'invoice', 'receipt', 'purchase_order', 'sales_order', 'quote_estimate',
    'bank_statement', 'credit_card_statement', 'loan_document', 'mortgage',
    'promissory_note', 'financial_statement', 'income_statement',
    'balance_sheet', 'cash_flow_statement', 'budget', 'forecast',
    'tax_return', 'w2_form', '1099_form', 'audit_report', 'expense_report',
    'payroll_document', 'investment_prospectus', 'mutual_fund_report',
    'stock_certificate', 'bond_document', 'insurance_policy',
    'insurance_claim', 'appraisal', 'valuation_report'
  ],
  scientific: [
    'research_paper', 'journal_article', 'thesis', 'dissertation',
    'conference_paper', 'technical_report', 'white_paper', 'case_study',
    'literature_review', 'meta_analysis', 'systematic_review',
    'lab_notebook', 'experiment_protocol', 'data_sheet', 'specification',
    'patent_application', 'grant_proposal', 'grant_report',
    'peer_review', 'abstract', 'poster', 'presentation_slides'
  ],
  business: [
    'business_plan', 'proposal', 'project_plan', 'project_charter',
    'requirements_document', 'functional_specification', 'technical_specification',
    'user_manual', 'training_manual', 'standard_operating_procedure',
    'policy_document', 'handbook', 'meeting_minutes', 'agenda',
    'memorandum', 'email', 'newsletter', 'press_release',
    'marketing_material', 'brochure', 'catalog', 'product_sheet',
    'case_study', 'testimonial', 'survey', 'questionnaire',
    'report', 'analysis', 'recommendation', 'executive_summary'
  ],
  hr: [
    'resume', 'cv', 'cover_letter', 'job_description', 'job_posting',
    'offer_letter', 'employment_agreement', 'employee_handbook',
    'performance_review', 'disciplinary_notice', 'termination_letter',
    'resignation_letter', 'reference_letter', 'recommendation_letter',
    'background_check', 'i9_form', 'w4_form', 'benefits_enrollment',
    'leave_request', 'timesheet', 'expense_report', 'travel_request',
    'training_record', 'certification', 'professional_development_plan'
  ],
  government: [
    'legislation', 'regulation', 'ordinance', 'executive_order',
    'government_report', 'census_data', 'public_record', 'foia_response',
    'permit', 'license', 'registration', 'filing', 'tax_document',
    'court_record', 'police_report', 'incident_report', 'inspection_report',
    'environmental_assessment', 'impact_study', 'public_notice',
    'request_for_proposal', 'government_contract', 'grant_application'
  ],
  education: [
    'syllabus', 'curriculum', 'lesson_plan', 'assignment', 'exam',
    'quiz', 'grading_rubric', 'report_card', 'transcript', 'diploma',
    'degree', 'certificate', 'accreditation', 'enrollment_form',
    'financial_aid', 'scholarship', 'student_record', 'iep',
    'research_paper', 'essay', 'thesis', 'dissertation', 'textbook'
  ],
  real_estate: [
    'deed', 'title', 'mortgage', 'lease', 'rental_agreement',
    'purchase_agreement', 'listing_agreement', 'disclosure', 'inspection_report',
    'appraisal', 'survey', 'plat', 'zoning', 'hoa_document',
    'property_tax', 'title_insurance', 'closing_statement', 'escrow'
  ],
  general: [
    'letter', 'memo', 'note', 'list', 'checklist', 'form',
    'application', 'registration', 'certificate', 'document',
    'file', 'record', 'report', 'summary', 'overview', 'guide',
    'instructions', 'manual', 'handbook', 'reference', 'other'
  ]
};

/**
 * Flatten all document types for validation
 */
export const ALL_DOCUMENT_TYPES = Object.values(DOCUMENT_TAXONOMY).flat();

/**
 * All domains
 */
export const ALL_DOMAINS = Object.keys(DOCUMENT_TAXONOMY);

/**
 * Document classification result
 */
export interface DocumentClassification {
  documentType: string;
  typeConfidence: number;
  domain: string;
  domainConfidence: number;
  subTypes?: string[];
  keywords?: string[];
  summary?: string;
}

/**
 * Classify a document based on its content, filename, and mime type
 */
export async function classifyDocument(
  textContent: string,
  filename: string,
  mimeType: string
): Promise<DocumentClassification> {
  try {
    // Use first 8000 characters for classification (to stay within token limits)
    const truncatedContent = textContent.slice(0, 8000);

    const prompt = `You are a document classification expert. Analyze this document and classify it.

DOCUMENT FILENAME: ${filename}
DOCUMENT MIME TYPE: ${mimeType}

DOCUMENT CONTENT (first 8000 chars):
${truncatedContent}

AVAILABLE DOCUMENT TYPES BY DOMAIN:
${Object.entries(DOCUMENT_TAXONOMY).map(([domain, types]) =>
  `${domain.toUpperCase()}: ${types.join(', ')}`
).join('\n\n')}

Analyze the document and respond with a JSON object containing:
{
  "documentType": "the most specific document type from the list above",
  "typeConfidence": 0.0-1.0,
  "domain": "the domain (legal, medical, financial, scientific, business, hr, government, education, real_estate, general)",
  "domainConfidence": 0.0-1.0,
  "subTypes": ["optional array of secondary types if applicable"],
  "keywords": ["5-10 key terms from the document"],
  "summary": "1-2 sentence summary of what this document is"
}

IMPORTANT:
- Choose the MOST SPECIFIC type that applies
- If unsure between types, choose the one with broader applicability
- Confidence should reflect how certain you are (0.5 = guess, 0.9+ = very certain)
- Only respond with valid JSON, no other text`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[DocumentClassifier] Could not extract JSON from response, using fallback');
      return fallbackClassification(filename, mimeType, textContent);
    }

    const classification = JSON.parse(jsonMatch[0]) as DocumentClassification;

    // Validate and normalize
    classification.documentType = normalizeType(classification.documentType);
    classification.domain = normalizeDomain(classification.domain);

    // Ensure confidence values are in range
    classification.typeConfidence = Math.max(0, Math.min(1, classification.typeConfidence || 0.5));
    classification.domainConfidence = Math.max(0, Math.min(1, classification.domainConfidence || 0.5));

    console.log(`[DocumentClassifier] Classified "${filename}" as ${classification.documentType} (${classification.domain}) with confidence ${classification.typeConfidence.toFixed(2)}`);

    return classification;
  } catch (error) {
    console.error('[DocumentClassifier] Classification failed:', error);
    return fallbackClassification(filename, mimeType, textContent);
  }
}

/**
 * Fallback classification when LLM fails
 */
export function fallbackClassification(
  filename: string,
  mimeType: string,
  textContent: string
): DocumentClassification {
  const lowerFilename = filename.toLowerCase();
  const lowerContent = textContent.toLowerCase().slice(0, 2000);

  // Check filename patterns
  const filenamePatterns: Array<{ pattern: RegExp; type: string; domain: string }> = [
    { pattern: /contract|agreement|nda/i, type: 'contract', domain: 'legal' },
    { pattern: /invoice|receipt/i, type: 'invoice', domain: 'financial' },
    { pattern: /resume|cv/i, type: 'resume', domain: 'hr' },
    { pattern: /report/i, type: 'report', domain: 'business' },
    { pattern: /medical|patient|diagnosis/i, type: 'medical_record', domain: 'medical' },
    { pattern: /tax|1099|w2/i, type: 'tax_return', domain: 'financial' },
    { pattern: /policy|handbook/i, type: 'policy_document', domain: 'business' },
    { pattern: /proposal/i, type: 'proposal', domain: 'business' },
    { pattern: /research|paper|study/i, type: 'research_paper', domain: 'scientific' },
    { pattern: /manual|guide/i, type: 'user_manual', domain: 'business' },
  ];

  for (const { pattern, type, domain } of filenamePatterns) {
    if (pattern.test(lowerFilename)) {
      return {
        documentType: type,
        typeConfidence: 0.6,
        domain: domain,
        domainConfidence: 0.6,
        keywords: [],
        summary: `Document classified by filename pattern`
      };
    }
  }

  // Check content patterns
  const contentPatterns: Array<{ pattern: RegExp; type: string; domain: string }> = [
    { pattern: /hereby agree|parties agree|terms and conditions/i, type: 'contract', domain: 'legal' },
    { pattern: /invoice number|bill to|amount due/i, type: 'invoice', domain: 'financial' },
    { pattern: /patient name|diagnosis|treatment/i, type: 'medical_record', domain: 'medical' },
    { pattern: /education|experience|skills|references/i, type: 'resume', domain: 'hr' },
    { pattern: /abstract|methodology|conclusion|references/i, type: 'research_paper', domain: 'scientific' },
    { pattern: /revenue|expenses|profit|loss|balance/i, type: 'financial_statement', domain: 'financial' },
  ];

  for (const { pattern, type, domain } of contentPatterns) {
    if (pattern.test(lowerContent)) {
      return {
        documentType: type,
        typeConfidence: 0.5,
        domain: domain,
        domainConfidence: 0.5,
        keywords: [],
        summary: `Document classified by content pattern`
      };
    }
  }

  // Default classification
  return {
    documentType: 'document',
    typeConfidence: 0.3,
    domain: 'general',
    domainConfidence: 0.3,
    keywords: [],
    summary: 'Unable to determine specific document type'
  };
}

/**
 * Normalize document type to match taxonomy
 */
function normalizeType(type: string): string {
  if (!type) return 'document';

  const normalized = type.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');

  // Check if type exists in taxonomy
  if (ALL_DOCUMENT_TYPES.includes(normalized)) {
    return normalized;
  }

  // Try to find a close match
  const closeMatch = ALL_DOCUMENT_TYPES.find(t =>
    t.includes(normalized) || normalized.includes(t)
  );

  return closeMatch || 'document';
}

/**
 * Normalize domain to match taxonomy
 */
function normalizeDomain(domain: string): string {
  if (!domain) return 'general';

  const normalized = domain.toLowerCase().replace(/[^a-z_]/g, '');

  if (ALL_DOMAINS.includes(normalized)) {
    return normalized;
  }

  // Map common variations
  const domainMap: Record<string, string> = {
    'law': 'legal',
    'healthcare': 'medical',
    'health': 'medical',
    'finance': 'financial',
    'accounting': 'financial',
    'science': 'scientific',
    'tech': 'scientific',
    'technology': 'scientific',
    'corp': 'business',
    'corporate': 'business',
    'human_resources': 'hr',
    'personnel': 'hr',
    'gov': 'government',
    'public': 'government',
    'academic': 'education',
    'school': 'education',
    'property': 'real_estate',
    'realestate': 'real_estate',
  };

  return domainMap[normalized] || 'general';
}

/**
 * Batch classify multiple documents
 */
export async function classifyDocumentsBatch(
  documents: Array<{ id: string; textContent: string; filename: string; mimeType: string }>
): Promise<Map<string, DocumentClassification>> {
  const results = new Map<string, DocumentClassification>();

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    const promises = batch.map(async (doc) => {
      const classification = await classifyDocument(doc.textContent, doc.filename, doc.mimeType);
      results.set(doc.id, classification);
    });

    await Promise.all(promises);

    // Small delay between batches
    if (i + batchSize < documents.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

export default {
  classifyDocument,
  classifyDocumentsBatch,
  fallbackClassification,
  DOCUMENT_TAXONOMY,
  ALL_DOCUMENT_TYPES,
  ALL_DOMAINS
};
