/**
 * RAG Terminology Integration
 *
 * Integrates the terminology service with the RAG pipeline for:
 * - Query expansion with synonyms
 * - Domain detection for context-aware retrieval
 * - Multilingual query support
 * - Enhanced semantic search
 */

import {
  getSynonyms,
  expandQuery,
  detectDomainContext,
  ExpandedQuery,
  DomainContext
} from '../services/terminology.service';
import NodeCache from 'node-cache';

// ═══════════════════════════════════════════════════════════════════════════
// ⚡ PERFORMANCE FIX: In-memory cache for terminology integration
// ═══════════════════════════════════════════════════════════════════════════
// REASON: enhanceQueryForRAG takes 2-4s due to expandQuery + detectDomainContext
// IMPACT: Reduces repeated queries from 3s to <10ms
// TTL: 1 hour (3600 seconds) - balances performance with freshness
const terminologyCache = new NodeCache({ stdTTL: 3600 });

export interface EnhancedQuery {
  originalQuery: string;
  expandedQuery: string;
  searchTerms: string[];
  synonymsUsed: Record<string, string[]>;
  detectedDomains: DomainContext[];
  language: string;
  confidence: number;
}

export interface RAGQueryOptions {
  userId?: string;
  preferredDomains?: string[];
  language?: string;
  maxSynonymsPerTerm?: number;
  includeDefinitions?: boolean;
  boostDomainTerms?: boolean;
}

/**
 * Detect the language of a query
 */
export function detectLanguage(text: string): string {
  // Simple language detection based on common words
  const ptWords = ['de', 'da', 'do', 'em', 'para', 'com', 'que', 'não', 'uma', 'os', 'as', 'pelo', 'pela', 'são'];
  const esWords = ['de', 'la', 'el', 'en', 'que', 'con', 'para', 'por', 'los', 'las', 'una', 'del', 'como', 'más'];
  const enWords = ['the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'what', 'where', 'when', 'how', 'which'];

  const words = text.toLowerCase().split(/\s+/);

  let enScore = 0;
  let ptScore = 0;
  let esScore = 0;

  for (const word of words) {
    if (enWords.includes(word)) enScore++;
    if (ptWords.includes(word)) ptScore++;
    if (esWords.includes(word)) esScore++;
  }

  // Check for language-specific characters
  if (/[ãõáéíóúâêôç]/i.test(text)) ptScore += 2;
  if (/[ñ¿¡áéíóú]/i.test(text)) esScore += 2;

  if (ptScore > enScore && ptScore > esScore) return 'pt';
  if (esScore > enScore && esScore > ptScore) return 'es';
  return 'en';
}

/**
 * Enhance a query for RAG retrieval with terminology expansion
 */
export async function enhanceQueryForRAG(
  query: string,
  options: RAGQueryOptions = {}
): Promise<EnhancedQuery> {
  const {
    userId,
    preferredDomains,
    language,
    maxSynonymsPerTerm = 3,
    boostDomainTerms = true
  } = options;

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚡ PERFORMANCE FIX: Check cache first
  // ═══════════════════════════════════════════════════════════════════════════
  // REASON: expandQuery + detectDomainContext take 2-4s total
  // IMPACT: Cache hit returns in <10ms vs 3s+ for fresh calls
  const cacheKey = `terminology:${query}:${userId || 'anon'}:${maxSynonymsPerTerm}`;
  const cached = terminologyCache.get<EnhancedQuery>(cacheKey);

  if (cached) {
    console.log(`✅ [TERMINOLOGY CACHE HIT] "${query.substring(0, 50)}..." (saved ~3s)`);
    return cached;
  }

  console.log(`❌ [TERMINOLOGY CACHE MISS] "${query.substring(0, 50)}..." - processing`);

  // Detect language if not specified
  const detectedLang = language || detectLanguage(query);

  // ⚡ PERFORMANCE FIX: Run expandQuery and detectDomainContext in parallel
  // REASON: Both operations were running sequentially (2s + 2s = 4s)
  // IMPACT: Now runs in max(2s, 2s) = 2s (50% faster)
  const [expansion, domains] = await Promise.all([
    // Expand the query with synonyms
    expandQuery(query, userId, undefined, detectedLang),
    // Detect domain context
    detectDomainContext(query, userId)
  ]);

  // Build enhanced search terms
  const searchTerms = new Set<string>();

  // Add original query words
  query.toLowerCase().split(/\s+/).forEach(w => {
    if (w.length > 2) searchTerms.add(w);
  });

  // Add synonyms (limited per term)
  const synonymsUsed: Record<string, string[]> = {};
  for (const [term, synonyms] of expansion.synonymsUsed) {
    const limitedSynonyms = synonyms.slice(0, maxSynonymsPerTerm);
    synonymsUsed[term] = limitedSynonyms;
    limitedSynonyms.forEach(s => searchTerms.add(s));
  }

  // Boost terms from preferred/detected domains
  if (boostDomainTerms && domains.length > 0) {
    const topDomain = preferredDomains?.[0] || domains[0].domain;

    // Add domain-specific terms to search
    for (const domainContext of domains) {
      if (domainContext.confidence > 0.3 || domainContext.domain === topDomain) {
        domainContext.matchedTerms.forEach(t => searchTerms.add(t));
      }
    }
  }

  // Build expanded query string
  const expandedQueryParts = [query];

  // Add high-confidence synonyms to query
  for (const [term, synonyms] of Object.entries(synonymsUsed)) {
    if (synonyms.length > 0) {
      expandedQueryParts.push(`(${[term, ...synonyms.slice(0, 2)].join(' OR ')})`);
    }
  }

  const expandedQuery = expandedQueryParts.join(' ');

  // Calculate confidence based on domain matches and synonyms found
  let confidence = 0.5;
  if (domains.length > 0) {
    confidence += 0.2 * domains[0].confidence;
  }
  if (Object.keys(synonymsUsed).length > 0) {
    confidence += 0.2;
  }
  if (expansion.languagesMatched.includes(detectedLang)) {
    confidence += 0.1;
  }

  const result: EnhancedQuery = {
    originalQuery: query,
    expandedQuery,
    searchTerms: Array.from(searchTerms),
    synonymsUsed,
    detectedDomains: domains,
    language: detectedLang,
    confidence: Math.min(confidence, 1)
  };

  // ⚡ PERFORMANCE FIX: Store result in cache for future use
  terminologyCache.set(cacheKey, result);
  console.log(`💾 [TERMINOLOGY CACHE] Stored result for "${query.substring(0, 50)}..."`);

  return result;
}

/**
 * Build vector search query with terminology expansion
 */
export async function buildVectorSearchQuery(
  query: string,
  options: RAGQueryOptions = {}
): Promise<{
  queryText: string;
  filters: Record<string, any>;
  boost: Record<string, number>;
}> {
  const enhanced = await enhanceQueryForRAG(query, options);

  // Build query text with expanded terms
  const queryText = enhanced.searchTerms.join(' ');

  // Build filters based on detected domains
  const filters: Record<string, any> = {};
  if (enhanced.detectedDomains.length > 0 && enhanced.detectedDomains[0].confidence > 0.5) {
    filters.suggestedDomain = enhanced.detectedDomains[0].domain;
  }

  // Build boost factors for domain-specific terms
  const boost: Record<string, number> = {};
  for (const domain of enhanced.detectedDomains) {
    for (const term of domain.matchedTerms) {
      boost[term] = 1 + (domain.confidence * 0.5);
    }
  }

  return {
    queryText,
    filters,
    boost
  };
}

/**
 * Generate alternative queries for semantic search diversity
 */
export async function generateQueryVariants(
  query: string,
  options: RAGQueryOptions = {}
): Promise<string[]> {
  const enhanced = await enhanceQueryForRAG(query, options);
  const variants: string[] = [query];

  // Generate variants using synonyms
  const words = query.toLowerCase().split(/\s+/);

  for (const [term, synonyms] of Object.entries(enhanced.synonymsUsed)) {
    if (synonyms.length > 0) {
      // Create variant with first synonym
      const variant = words.map(w =>
        w.toLowerCase() === term.toLowerCase() ? synonyms[0] : w
      ).join(' ');

      if (variant !== query) {
        variants.push(variant);
      }
    }
  }

  // Add domain-focused variants
  if (enhanced.detectedDomains.length > 0) {
    const domain = enhanced.detectedDomains[0].domain;
    variants.push(`${query} ${domain}`);
  }

  // Limit variants
  return variants.slice(0, 5);
}

/**
 * Score document relevance based on terminology matches
 */
export function scoreTerminologyRelevance(
  documentText: string,
  enhanced: EnhancedQuery
): number {
  const docLower = documentText.toLowerCase();
  let score = 0;
  let maxScore = 0;

  // Score original query terms
  const originalWords = enhanced.originalQuery.toLowerCase().split(/\s+/);
  for (const word of originalWords) {
    if (word.length > 2) {
      maxScore += 2;
      if (docLower.includes(word)) {
        score += 2;
      }
    }
  }

  // Score synonym matches (lower weight)
  for (const [term, synonyms] of Object.entries(enhanced.synonymsUsed)) {
    for (const synonym of synonyms) {
      maxScore += 0.5;
      if (docLower.includes(synonym.toLowerCase())) {
        score += 0.5;
      }
    }
  }

  // Score domain term matches
  for (const domain of enhanced.detectedDomains) {
    for (const term of domain.matchedTerms) {
      maxScore += 1;
      if (docLower.includes(term.toLowerCase())) {
        score += 1;
      }
    }
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Rerank search results using terminology scoring
 */
export function rerankWithTerminology(
  results: Array<{ text: string; score: number; metadata?: any }>,
  enhanced: EnhancedQuery,
  terminologyWeight: number = 0.3
): Array<{ text: string; score: number; metadata?: any; terminologyScore: number }> {
  return results
    .map(result => {
      const terminologyScore = scoreTerminologyRelevance(result.text, enhanced);
      const combinedScore =
        result.score * (1 - terminologyWeight) +
        terminologyScore * terminologyWeight;

      return {
        ...result,
        score: combinedScore,
        terminologyScore
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Extract key terms from a query for highlighting
 */
export function extractHighlightTerms(enhanced: EnhancedQuery): string[] {
  const terms = new Set<string>();

  // Add original query words
  enhanced.originalQuery.split(/\s+/).forEach(w => {
    if (w.length > 2) terms.add(w);
  });

  // Add synonyms
  for (const synonyms of Object.values(enhanced.synonymsUsed)) {
    synonyms.forEach(s => terms.add(s));
  }

  // Add domain terms
  for (const domain of enhanced.detectedDomains) {
    domain.matchedTerms.forEach(t => terms.add(t));
  }

  return Array.from(terms);
}

/**
 * Format enhanced query information for debugging/logging
 */
export function formatEnhancedQueryInfo(enhanced: EnhancedQuery): string {
  const lines: string[] = [];

  lines.push(`Original Query: "${enhanced.originalQuery}"`);
  lines.push(`Language: ${enhanced.language}`);
  lines.push(`Confidence: ${(enhanced.confidence * 100).toFixed(1)}%`);
  lines.push(`Search Terms: ${enhanced.searchTerms.join(', ')}`);

  if (Object.keys(enhanced.synonymsUsed).length > 0) {
    lines.push('\nSynonyms Used:');
    for (const [term, synonyms] of Object.entries(enhanced.synonymsUsed)) {
      lines.push(`  - "${term}": ${synonyms.join(', ')}`);
    }
  }

  if (enhanced.detectedDomains.length > 0) {
    lines.push('\nDetected Domains:');
    for (const domain of enhanced.detectedDomains) {
      lines.push(`  - ${domain.domain}: ${(domain.confidence * 100).toFixed(1)}% (terms: ${domain.matchedTerms.join(', ')})`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a terminology-aware embedding query
 * Combines original query with key synonyms for better embedding
 */
export async function createEmbeddingQuery(
  query: string,
  options: RAGQueryOptions = {}
): Promise<string> {
  const enhanced = await enhanceQueryForRAG(query, {
    ...options,
    maxSynonymsPerTerm: 2
  });

  // Build embedding-friendly query
  const parts = [query];

  // Add top synonyms
  for (const synonyms of Object.values(enhanced.synonymsUsed)) {
    if (synonyms[0]) {
      parts.push(synonyms[0]);
    }
  }

  // Add domain context if high confidence
  if (enhanced.detectedDomains.length > 0 && enhanced.detectedDomains[0].confidence > 0.6) {
    parts.push(`[${enhanced.detectedDomains[0].domain}]`);
  }

  return parts.join(' ');
}

export default {
  detectLanguage,
  enhanceQueryForRAG,
  buildVectorSearchQuery,
  generateQueryVariants,
  scoreTerminologyRelevance,
  rerankWithTerminology,
  extractHighlightTerms,
  formatEnhancedQueryInfo,
  createEmbeddingQuery
};
