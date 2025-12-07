/**
 * Keyword Extractor Service
 *
 * Extracts keywords from document text using TF-IDF scoring.
 * Supports domain-specific keyword boosting for improved relevance.
 */

/**
 * Common English stop words to filter out
 */
export const STOP_WORDS = new Set([
  // Articles
  'a', 'an', 'the',
  // Pronouns
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  // Verbs (common)
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'would', 'should', 'could', 'ought',
  'will', 'shall', 'can', 'may', 'might', 'must', 'need',
  // Prepositions
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond',
  'but', 'by', 'despite', 'down', 'during', 'except', 'for', 'from', 'in',
  'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside',
  'over', 'past', 'since', 'through', 'throughout', 'till', 'to', 'toward',
  'towards', 'under', 'underneath', 'until', 'up', 'upon', 'with', 'within', 'without',
  // Conjunctions
  'and', 'or', 'nor', 'but', 'yet', 'so', 'for', 'because', 'although', 'while',
  'if', 'unless', 'until', 'when', 'where', 'whether', 'though', 'as', 'than',
  // Other common words
  'all', 'also', 'any', 'both', 'each', 'either', 'every', 'few', 'more', 'most',
  'much', 'neither', 'no', 'none', 'not', 'only', 'other', 'same', 'several',
  'some', 'such', 'then', 'there', 'here', 'now', 'just', 'very', 'too', 'well',
  'even', 'still', 'already', 'always', 'never', 'ever', 'often', 'once', 'again',
  'also', 'back', 'being', 'how', 'however', 'therefore', 'thus', 'hence', 'whereby',
  // Common document words
  'page', 'section', 'document', 'file', 'item', 'number', 'date', 'etc', 'including'
]);

/**
 * Domain-specific keywords for boosting
 */
export const DOMAIN_KEYWORDS: Record<string, Set<string>> = {
  legal: new Set([
    'agreement', 'contract', 'clause', 'party', 'parties', 'liability', 'indemnify',
    'indemnification', 'warrant', 'warranty', 'termination', 'breach', 'remedy',
    'remedies', 'jurisdiction', 'arbitration', 'dispute', 'confidential', 'confidentiality',
    'intellectual', 'property', 'rights', 'obligations', 'covenant', 'represent',
    'representation', 'waiver', 'amendment', 'assignment', 'governing', 'law',
    'enforceable', 'binding', 'execute', 'execution', 'witness', 'notary',
    'plaintiff', 'defendant', 'court', 'judge', 'verdict', 'damages', 'injunction',
    'subpoena', 'deposition', 'testimony', 'evidence', 'statute', 'regulation',
    'compliance', 'violation', 'penalty', 'fine', 'settlement', 'mediation'
  ]),

  medical: new Set([
    'patient', 'diagnosis', 'treatment', 'medication', 'prescription', 'dosage',
    'symptom', 'symptoms', 'condition', 'disease', 'disorder', 'chronic', 'acute',
    'prognosis', 'therapy', 'procedure', 'surgery', 'surgical', 'hospital',
    'physician', 'doctor', 'nurse', 'specialist', 'referral', 'consultation',
    'examination', 'assessment', 'evaluation', 'lab', 'laboratory', 'test', 'results',
    'imaging', 'radiology', 'xray', 'mri', 'ct', 'scan', 'ultrasound', 'biopsy',
    'pathology', 'histology', 'vital', 'vitals', 'blood', 'pressure', 'pulse',
    'temperature', 'allergy', 'allergies', 'vaccine', 'vaccination', 'immunization',
    'insurance', 'claim', 'authorization', 'hipaa', 'medical', 'clinical', 'healthcare'
  ]),

  financial: new Set([
    'revenue', 'expense', 'income', 'profit', 'loss', 'asset', 'liability',
    'equity', 'balance', 'sheet', 'statement', 'cash', 'flow', 'budget',
    'forecast', 'audit', 'tax', 'deduction', 'credit', 'debit', 'account',
    'receivable', 'payable', 'invoice', 'payment', 'transaction', 'transfer',
    'deposit', 'withdrawal', 'interest', 'rate', 'loan', 'mortgage', 'debt',
    'principal', 'amortization', 'depreciation', 'appreciation', 'investment',
    'portfolio', 'stock', 'bond', 'dividend', 'yield', 'return', 'capital',
    'valuation', 'appraisal', 'margin', 'leverage', 'liquidity', 'solvency',
    'bankruptcy', 'insolvency', 'fiscal', 'quarter', 'annual', 'monthly'
  ]),

  scientific: new Set([
    'research', 'study', 'experiment', 'hypothesis', 'theory', 'methodology',
    'method', 'data', 'analysis', 'results', 'conclusion', 'findings', 'evidence',
    'sample', 'population', 'variable', 'control', 'statistical', 'significant',
    'significance', 'correlation', 'causation', 'regression', 'model', 'simulation',
    'observation', 'measurement', 'quantitative', 'qualitative', 'empirical',
    'peer', 'review', 'journal', 'publication', 'citation', 'reference', 'abstract',
    'introduction', 'literature', 'discussion', 'limitation', 'future', 'work',
    'laboratory', 'protocol', 'specimen', 'reagent', 'equipment', 'calibration'
  ]),

  business: new Set([
    'strategy', 'objective', 'goal', 'target', 'milestone', 'deliverable',
    'project', 'initiative', 'program', 'portfolio', 'roadmap', 'timeline',
    'deadline', 'stakeholder', 'customer', 'client', 'vendor', 'supplier',
    'partner', 'partnership', 'collaboration', 'team', 'resource', 'capacity',
    'budget', 'cost', 'price', 'margin', 'revenue', 'sales', 'marketing',
    'product', 'service', 'solution', 'offering', 'market', 'segment', 'competitor',
    'competitive', 'advantage', 'differentiation', 'value', 'proposition',
    'brand', 'positioning', 'launch', 'growth', 'scale', 'expansion', 'acquisition',
    'merger', 'integration', 'optimization', 'efficiency', 'productivity', 'kpi',
    'metric', 'dashboard', 'report', 'analysis', 'insight', 'recommendation'
  ]),

  hr: new Set([
    'employee', 'employer', 'employment', 'hire', 'hiring', 'recruit', 'recruitment',
    'candidate', 'applicant', 'resume', 'interview', 'onboarding', 'training',
    'development', 'performance', 'evaluation', 'review', 'feedback', 'goal',
    'objective', 'compensation', 'salary', 'wage', 'bonus', 'benefit', 'benefits',
    'insurance', 'retirement', 'pension', 'vacation', 'leave', 'pto', 'sick',
    'termination', 'resignation', 'layoff', 'severance', 'policy', 'procedure',
    'handbook', 'compliance', 'discipline', 'disciplinary', 'grievance', 'harassment',
    'discrimination', 'diversity', 'inclusion', 'equity', 'culture', 'engagement',
    'satisfaction', 'retention', 'turnover', 'succession', 'talent', 'workforce'
  ]),

  education: new Set([
    'student', 'teacher', 'instructor', 'professor', 'faculty', 'staff', 'school',
    'university', 'college', 'academy', 'institute', 'program', 'course', 'class',
    'curriculum', 'syllabus', 'lesson', 'lecture', 'seminar', 'workshop', 'assignment',
    'homework', 'project', 'exam', 'examination', 'test', 'quiz', 'assessment',
    'grade', 'grading', 'score', 'gpa', 'credit', 'semester', 'quarter', 'term',
    'enrollment', 'registration', 'admission', 'tuition', 'scholarship', 'grant',
    'financial', 'aid', 'degree', 'diploma', 'certificate', 'certification',
    'graduation', 'commencement', 'thesis', 'dissertation', 'research', 'academic'
  ]),

  government: new Set([
    'federal', 'state', 'local', 'municipal', 'county', 'city', 'government',
    'agency', 'department', 'bureau', 'office', 'administration', 'official',
    'public', 'citizen', 'resident', 'taxpayer', 'voter', 'election', 'ballot',
    'legislation', 'law', 'statute', 'regulation', 'ordinance', 'code', 'policy',
    'procedure', 'permit', 'license', 'registration', 'filing', 'compliance',
    'enforcement', 'inspection', 'audit', 'review', 'hearing', 'appeal', 'court',
    'judicial', 'legislative', 'executive', 'congress', 'senate', 'house',
    'representative', 'senator', 'governor', 'mayor', 'commissioner', 'council'
  ])
};

/**
 * Extracted keyword structure
 */
export interface ExtractedKeyword {
  word: string;
  count: number;
  tfIdf: number;
  isDomainSpecific: boolean;
  boostedScore?: number;
}

/**
 * Extract keywords from text using TF-IDF
 */
export function extractKeywords(
  text: string,
  options: {
    domain?: string;
    maxKeywords?: number;
    minWordLength?: number;
    boostFactor?: number;
  } = {}
): ExtractedKeyword[] {
  const {
    domain,
    maxKeywords = 100,
    minWordLength = 3,
    boostFactor = 2.0
  } = options;

  // Tokenize
  const tokens = tokenize(text, minWordLength);

  if (tokens.length === 0) {
    return [];
  }

  // Calculate term frequencies
  const termFrequencies = calculateTermFrequencies(tokens);

  // Calculate TF-IDF scores
  const keywords = calculateTfIdf(termFrequencies, tokens.length);

  // Boost domain-specific keywords
  const domainKeywordSet = domain ? DOMAIN_KEYWORDS[domain] : undefined;
  const boosted = boostDomainKeywords(keywords, domainKeywordSet, boostFactor);

  // Sort by boosted score and take top keywords
  return boosted
    .sort((a, b) => (b.boostedScore || b.tfIdf) - (a.boostedScore || a.tfIdf))
    .slice(0, maxKeywords);
}

/**
 * Tokenize text into words
 */
function tokenize(text: string, minWordLength: number): string[] {
  // Convert to lowercase and extract alphanumeric words
  const words = text
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];

  // Filter out stop words and short words
  return words.filter(word =>
    word.length >= minWordLength &&
    !STOP_WORDS.has(word) &&
    !/^\d+$/.test(word) // Filter out pure numbers
  );
}

/**
 * Calculate term frequencies
 */
function calculateTermFrequencies(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  return frequencies;
}

/**
 * Calculate TF-IDF scores
 *
 * TF (Term Frequency) = count / total_terms
 * IDF (Inverse Document Frequency) = log(total_terms / count)
 * TF-IDF = TF * IDF
 *
 * Note: This is a simplified single-document TF-IDF.
 * For true IDF, you'd need a corpus of documents.
 */
function calculateTfIdf(
  termFrequencies: Map<string, number>,
  totalTerms: number
): ExtractedKeyword[] {
  const keywords: ExtractedKeyword[] = [];

  for (const [word, count] of termFrequencies) {
    // TF: normalize by total terms
    const tf = count / totalTerms;

    // IDF: penalize very common words within the document
    // Using log(totalTerms / count) as a proxy for IDF
    const idf = Math.log(totalTerms / count);

    // TF-IDF score
    const tfIdf = tf * idf;

    keywords.push({
      word,
      count,
      tfIdf,
      isDomainSpecific: false
    });
  }

  return keywords;
}

/**
 * Boost domain-specific keywords
 */
function boostDomainKeywords(
  keywords: ExtractedKeyword[],
  domainKeywords: Set<string> | undefined,
  boostFactor: number
): ExtractedKeyword[] {
  return keywords.map(keyword => {
    const isDomainSpecific = domainKeywords?.has(keyword.word) || false;
    const boostedScore = isDomainSpecific
      ? keyword.tfIdf * boostFactor
      : keyword.tfIdf;

    return {
      ...keyword,
      isDomainSpecific,
      boostedScore
    };
  });
}

/**
 * Check if a word is a domain keyword
 */
export function isDomainKeyword(word: string, domain?: string): boolean {
  if (!domain) return false;

  const domainKeywords = DOMAIN_KEYWORDS[domain];
  return domainKeywords?.has(word.toLowerCase()) || false;
}

/**
 * Get all domain keywords for a specific domain
 */
export function getDomainKeywords(domain: string): string[] {
  const keywords = DOMAIN_KEYWORDS[domain];
  return keywords ? Array.from(keywords) : [];
}

/**
 * Extract keywords from multiple texts
 */
export function extractKeywordsBatch(
  texts: Array<{ id: string; text: string; domain?: string }>
): Map<string, ExtractedKeyword[]> {
  const results = new Map<string, ExtractedKeyword[]>();

  for (const { id, text, domain } of texts) {
    const keywords = extractKeywords(text, { domain });
    results.set(id, keywords);
  }

  return results;
}

/**
 * Combine keywords from multiple documents (for corpus-level analysis)
 */
export function combineKeywords(
  keywordSets: ExtractedKeyword[][],
  options: { maxKeywords?: number } = {}
): ExtractedKeyword[] {
  const { maxKeywords = 200 } = options;
  const combined = new Map<string, ExtractedKeyword>();

  for (const keywords of keywordSets) {
    for (const keyword of keywords) {
      const existing = combined.get(keyword.word);

      if (existing) {
        // Combine counts and scores
        combined.set(keyword.word, {
          word: keyword.word,
          count: existing.count + keyword.count,
          tfIdf: existing.tfIdf + keyword.tfIdf,
          isDomainSpecific: existing.isDomainSpecific || keyword.isDomainSpecific,
          boostedScore: (existing.boostedScore || 0) + (keyword.boostedScore || 0)
        });
      } else {
        combined.set(keyword.word, { ...keyword });
      }
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => (b.boostedScore || b.tfIdf) - (a.boostedScore || a.tfIdf))
    .slice(0, maxKeywords);
}

/**
 * Generate keyword summary string
 */
export function keywordsToString(keywords: ExtractedKeyword[], maxCount: number = 20): string {
  return keywords
    .slice(0, maxCount)
    .map(k => k.word)
    .join(', ');
}

export default {
  extractKeywords,
  extractKeywordsBatch,
  combineKeywords,
  isDomainKeyword,
  getDomainKeywords,
  keywordsToString,
  STOP_WORDS,
  DOMAIN_KEYWORDS
};
