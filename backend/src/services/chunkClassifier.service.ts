/**
 * Chunk Classifier Service
 *
 * Classifies document chunks into semantic types for improved retrieval.
 * Supports 100+ chunk types across multiple domains.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Chunk Taxonomy - 100+ chunk types organized by category
 */
export const CHUNK_TAXONOMY = {
  identity: [
    'document_title', 'document_header', 'document_footer',
    'author_info', 'date_info', 'version_info',
    'document_id', 'reference_number'
  ],

  structural: [
    'table_of_contents', 'section_header', 'subsection_header',
    'chapter_title', 'appendix_title', 'index_entry',
    'footnote', 'endnote', 'sidebar', 'callout',
    'page_number', 'page_break', 'divider', 'separator',
    'list_header'
  ],

  content_universal: [
    'paragraph', 'introduction', 'conclusion', 'summary',
    'executive_summary', 'abstract', 'overview', 'background',
    'purpose', 'scope', 'objectives', 'methodology',
    'findings', 'results', 'analysis', 'discussion',
    'recommendation', 'action_item', 'next_steps',
    'definition', 'explanation', 'description', 'example',
    'quote', 'citation', 'reference', 'bibliography',
    'bullet_list', 'numbered_list', 'checklist',
    'table', 'table_header', 'table_row', 'table_cell',
    'figure', 'chart', 'graph', 'diagram', 'image_caption'
  ],

  legal: [
    'parties_clause', 'recitals', 'definitions_clause',
    'obligations_clause', 'rights_clause', 'payment_terms_clause',
    'termination_clause', 'breach_clause', 'remedy_clause',
    'liability_clause', 'indemnification_clause', 'warranty_clause',
    'confidentiality_clause', 'non_compete_clause', 'governing_law_clause',
    'dispute_resolution_clause', 'force_majeure_clause', 'amendment_clause',
    'assignment_clause', 'signature_block', 'witness_block',
    'notarization', 'exhibit', 'schedule', 'attachment'
  ],

  medical: [
    'patient_info', 'chief_complaint', 'history_present_illness',
    'past_medical_history', 'family_history', 'social_history',
    'review_of_systems', 'physical_examination', 'vital_signs',
    'laboratory_results', 'imaging_findings', 'assessment',
    'diagnosis', 'differential_diagnosis', 'plan',
    'medications', 'prescriptions', 'allergies',
    'instructions', 'follow_up', 'referral',
    'procedure_note', 'operative_note', 'discharge_instructions'
  ],

  accounting: [
    'account_header', 'account_summary', 'account_detail',
    'transaction_record', 'journal_entry', 'ledger_entry',
    'debit_entry', 'credit_entry', 'balance_line',
    'subtotal', 'total', 'grand_total',
    'tax_calculation', 'discount_calculation',
    'payment_record', 'invoice_line_item'
  ],

  finance: [
    'financial_header', 'period_info', 'comparative_period',
    'revenue_section', 'expense_section', 'profit_loss',
    'asset_section', 'liability_section', 'equity_section',
    'cash_flow_operating', 'cash_flow_investing', 'cash_flow_financing',
    'ratio_analysis', 'variance_analysis', 'trend_analysis',
    'footnote_disclosure', 'auditor_opinion'
  ],

  scientific: [
    'hypothesis', 'research_question', 'literature_review',
    'theoretical_framework', 'data_collection', 'data_analysis',
    'statistical_results', 'experiment_description', 'materials_methods',
    'sample_description', 'control_group', 'limitations',
    'future_research', 'acknowledgments'
  ],

  business: [
    'company_overview', 'mission_statement', 'vision_statement',
    'value_proposition', 'market_analysis', 'competitive_analysis',
    'swot_analysis', 'risk_assessment', 'mitigation_strategy',
    'project_timeline', 'milestone', 'deliverable',
    'resource_allocation', 'budget_breakdown', 'roi_analysis',
    'kpi_metric', 'performance_indicator'
  ],

  personal: [
    'contact_info', 'biographical_info', 'work_experience',
    'education_history', 'skills_section', 'certification',
    'personal_statement', 'objective_statement'
  ]
};

/**
 * Flatten all chunk types for validation
 */
export const ALL_CHUNK_TYPES = Object.values(CHUNK_TAXONOMY).flat();

/**
 * All categories
 */
export const ALL_CATEGORIES = Object.keys(CHUNK_TAXONOMY);

/**
 * Chunk classification result
 */
export interface ChunkClassification {
  chunkType: string;
  category: string;
  confidence: number;
  secondaryTypes?: string[];
  reasoning?: string;
}

/**
 * Classify a chunk based on its content
 */
export async function classifyChunk(
  chunkText: string,
  context: {
    documentType?: string;
    domain?: string;
    previousChunkType?: string;
    nextChunkPreview?: string;
  } = {}
): Promise<ChunkClassification> {
  const { documentType, domain, previousChunkType, nextChunkPreview } = context;

  // For very short chunks, use rule-based classification
  const wordCount = chunkText.split(/\s+/).length;
  if (wordCount < 10) {
    return ruleBasedClassification(chunkText);
  }

  try {
    const prompt = `You are a document chunk classifier. Classify this chunk of text.

CHUNK TEXT:
${chunkText.slice(0, 2000)}

CONTEXT:
- Document Type: ${documentType || 'unknown'}
- Domain: ${domain || 'general'}
- Previous Chunk Type: ${previousChunkType || 'unknown'}
${nextChunkPreview ? `- Next Chunk Preview: ${nextChunkPreview.slice(0, 200)}` : ''}

AVAILABLE CHUNK TYPES BY CATEGORY:
${Object.entries(CHUNK_TAXONOMY).map(([category, types]) =>
  `${category.toUpperCase()}: ${types.join(', ')}`
).join('\n\n')}

Respond with a JSON object:
{
  "chunkType": "the most specific chunk type from above",
  "category": "the category (identity, structural, content_universal, legal, medical, etc.)",
  "confidence": 0.0-1.0,
  "secondaryTypes": ["optional secondary types if applicable"],
  "reasoning": "brief explanation of why this type was chosen"
}

IMPORTANT:
- Choose the MOST SPECIFIC type that accurately describes the content
- Consider the document context when classifying
- If no specific type fits, use "paragraph" as default
- Only respond with valid JSON`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return ruleBasedClassification(chunkText);
    }

    const classification = JSON.parse(jsonMatch[0]) as ChunkClassification;

    // Validate and normalize
    classification.chunkType = normalizeChunkType(classification.chunkType);
    classification.category = normalizeCategory(classification.category);
    classification.confidence = Math.max(0, Math.min(1, classification.confidence || 0.5));

    return classification;
  } catch (error) {
    console.error('[ChunkClassifier] Classification failed:', error);
    return ruleBasedClassification(chunkText);
  }
}

/**
 * Rule-based classification for short or simple chunks
 */
function ruleBasedClassification(text: string): ChunkClassification {
  const lowerText = text.toLowerCase().trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Check for page numbers
  if (/^page\s*\d+$|^\d+$|^-\s*\d+\s*-$/i.test(lowerText)) {
    return { chunkType: 'page_number', category: 'structural', confidence: 0.95 };
  }

  // Check for section headers (short, no punctuation at end)
  if (lines.length === 1 && text.length < 100 && !/[.!?]$/.test(text)) {
    if (/^(chapter|section|part|article)\s+\d+/i.test(lowerText)) {
      return { chunkType: 'section_header', category: 'structural', confidence: 0.9 };
    }
    if (/^(introduction|conclusion|summary|abstract|overview|background)/i.test(lowerText)) {
      return { chunkType: 'section_header', category: 'structural', confidence: 0.85 };
    }
    if (/^(table of contents|contents|index)/i.test(lowerText)) {
      return { chunkType: 'table_of_contents', category: 'structural', confidence: 0.95 };
    }
  }

  // Check for numbered list
  if (/^\d+\.\s/.test(text) || /^[ivxIVX]+\.\s/.test(text)) {
    return { chunkType: 'numbered_list', category: 'content_universal', confidence: 0.85 };
  }

  // Check for bullet list
  if (/^[-•*]\s/.test(text) || /^[a-z]\)\s/i.test(text)) {
    return { chunkType: 'bullet_list', category: 'content_universal', confidence: 0.85 };
  }

  // Check for table patterns
  if (text.includes('|') && (text.match(/\|/g) || []).length >= 4) {
    return { chunkType: 'table', category: 'content_universal', confidence: 0.8 };
  }

  // Check for signature blocks
  if (/signature|signed|witness|notary/i.test(lowerText) && text.length < 200) {
    return { chunkType: 'signature_block', category: 'legal', confidence: 0.8 };
  }

  // Medical-specific patterns
  if (/patient\s*name|dob|date of birth|mrn|medical record/i.test(lowerText)) {
    return { chunkType: 'patient_info', category: 'medical', confidence: 0.85 };
  }
  if (/chief complaint|cc:|presenting complaint/i.test(lowerText)) {
    return { chunkType: 'chief_complaint', category: 'medical', confidence: 0.9 };
  }
  if (/assessment|diagnosis|dx:|impression/i.test(lowerText)) {
    return { chunkType: 'assessment', category: 'medical', confidence: 0.85 };
  }
  if (/plan:|treatment plan|plan of care/i.test(lowerText)) {
    return { chunkType: 'plan', category: 'medical', confidence: 0.85 };
  }

  // Legal-specific patterns
  if (/whereas|recital|preamble/i.test(lowerText)) {
    return { chunkType: 'recitals', category: 'legal', confidence: 0.85 };
  }
  if (/definitions:|defined terms|the following definitions/i.test(lowerText)) {
    return { chunkType: 'definitions_clause', category: 'legal', confidence: 0.9 };
  }
  if (/termination|shall terminate|may terminate/i.test(lowerText) && text.length < 500) {
    return { chunkType: 'termination_clause', category: 'legal', confidence: 0.75 };
  }
  if (/governing law|governed by the laws/i.test(lowerText)) {
    return { chunkType: 'governing_law_clause', category: 'legal', confidence: 0.9 };
  }
  if (/indemnif|hold harmless/i.test(lowerText)) {
    return { chunkType: 'indemnification_clause', category: 'legal', confidence: 0.85 };
  }

  // Financial patterns
  if (/total\s*(revenue|income|expenses|assets|liabilities)/i.test(lowerText)) {
    return { chunkType: 'total', category: 'accounting', confidence: 0.8 };
  }
  if (/balance sheet|statement of financial position/i.test(lowerText)) {
    return { chunkType: 'asset_section', category: 'finance', confidence: 0.8 };
  }

  // Default to paragraph
  return { chunkType: 'paragraph', category: 'content_universal', confidence: 0.5 };
}

/**
 * Normalize chunk type to match taxonomy
 */
function normalizeChunkType(type: string): string {
  if (!type) return 'paragraph';

  const normalized = type.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');

  if (ALL_CHUNK_TYPES.includes(normalized)) {
    return normalized;
  }

  // Try to find a close match
  const closeMatch = ALL_CHUNK_TYPES.find(t =>
    t.includes(normalized) || normalized.includes(t)
  );

  return closeMatch || 'paragraph';
}

/**
 * Normalize category to match taxonomy
 */
function normalizeCategory(category: string): string {
  if (!category) return 'content_universal';

  const normalized = category.toLowerCase().replace(/[^a-z_]/g, '');

  if (ALL_CATEGORIES.includes(normalized)) {
    return normalized;
  }

  // Map common variations
  const categoryMap: Record<string, string> = {
    'universal': 'content_universal',
    'content': 'content_universal',
    'general': 'content_universal',
    'structure': 'structural',
    'law': 'legal',
    'contract': 'legal',
    'health': 'medical',
    'healthcare': 'medical',
    'clinical': 'medical',
    'money': 'finance',
    'financial': 'finance',
    'account': 'accounting',
    'science': 'scientific',
    'research': 'scientific',
    'corporate': 'business',
    'company': 'business',
    'hr': 'personal',
    'resume': 'personal'
  };

  return categoryMap[normalized] || 'content_universal';
}

/**
 * Batch classify multiple chunks
 */
export async function classifyChunksBatch(
  chunks: Array<{
    id: string;
    text: string;
    documentType?: string;
    domain?: string;
  }>,
  options: {
    rateLimit?: number; // ms between requests
  } = {}
): Promise<Map<string, ChunkClassification>> {
  const { rateLimit = 100 } = options;
  const results = new Map<string, ChunkClassification>();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const previousChunkType = i > 0 ? results.get(chunks[i - 1].id)?.chunkType : undefined;
    const nextChunkPreview = i < chunks.length - 1 ? chunks[i + 1].text : undefined;

    const classification = await classifyChunk(chunk.text, {
      documentType: chunk.documentType,
      domain: chunk.domain,
      previousChunkType,
      nextChunkPreview
    });

    results.set(chunk.id, classification);

    // Rate limiting
    if (i < chunks.length - 1 && rateLimit > 0) {
      await new Promise(resolve => setTimeout(resolve, rateLimit));
    }
  }

  return results;
}

/**
 * Get chunk types for a specific category
 */
export function getChunkTypesForCategory(category: string): string[] {
  return CHUNK_TAXONOMY[category as keyof typeof CHUNK_TAXONOMY] || [];
}

/**
 * Get category for a chunk type
 */
export function getCategoryForChunkType(chunkType: string): string | undefined {
  for (const [category, types] of Object.entries(CHUNK_TAXONOMY)) {
    if (types.includes(chunkType)) {
      return category;
    }
  }
  return undefined;
}

/**
 * Check if chunk type is domain-specific
 */
export function isDomainSpecificChunkType(chunkType: string): boolean {
  const domainCategories = ['legal', 'medical', 'accounting', 'finance', 'scientific', 'business', 'personal'];

  for (const category of domainCategories) {
    const types = CHUNK_TAXONOMY[category as keyof typeof CHUNK_TAXONOMY];
    if (types && types.includes(chunkType)) {
      return true;
    }
  }

  return false;
}

export default {
  classifyChunk,
  classifyChunksBatch,
  ruleBasedClassification,
  getChunkTypesForCategory,
  getCategoryForChunkType,
  isDomainSpecificChunkType,
  CHUNK_TAXONOMY,
  ALL_CHUNK_TYPES,
  ALL_CATEGORIES
};
