/**
 * Semantic Document Search Service
 *
 * Understands natural language queries about documents and returns
 * file buttons with perfect UX and confidence scoring.
 *
 * Features:
 * - Semantic understanding of document queries
 * - Confidence-based single/multiple file returns
 * - Multi-criteria search (Q3 AND Q5, decline AND revenue)
 * - Comforting user messages
 * - Perfect integration with RAG chunks
 *
 * Examples:
 * - "which document mentions Q2 2025 decline?" -> Single file (100% confidence)
 * - "files mentioning Q3 and Q5" -> Multiple files if in different docs
 * - "where is the revenue report?" -> Single file with location
 */

import prisma from '../config/database';

// ============================================================================
// TYPES
// ============================================================================

interface DocumentSearchQuery {
  type: 'find_document' | 'find_multiple' | 'locate_document';
  criteria: SearchCriteria[];
  operator: 'AND' | 'OR';
  originalQuery: string;
}

interface SearchCriteria {
  type: 'keyword' | 'time_period' | 'metric' | 'topic' | 'file_type';
  value: string;
  weight: number; // 0-1, importance of this criterion
}

interface DocumentMatch {
  documentId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  folderId: string | null;
  confidence: number; // 0-1
  matchedCriteria: string[]; // Which criteria matched
  matchedChunks: ChunkMatch[];
}

interface ChunkMatch {
  chunkId: string;
  content: string;
  relevance: number;
  matchedTerms: string[];
}

export interface SearchResult {
  success: boolean;
  confidence: number; // Overall confidence
  documents: DocumentMatch[];
  message: string; // Comforting message for user
  action: 'show_single' | 'show_multiple' | 'clarify' | 'not_found';
  uiData?: any; // Data for rendering file buttons
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class SemanticDocumentSearchService {
  /**
   * Main entry point for semantic document search
   */
  async search(query: string, userId: string): Promise<SearchResult> {
    console.log(`🔍 [DOC-SEARCH] Semantic search: "${query}"`);

    // Parse query into structured search criteria
    const parsedQuery = this.parseQuery(query);
    console.log(`🔍 [DOC-SEARCH] Parsed criteria:`, parsedQuery.criteria.map(c => c.value));

    // Search across document chunks with semantic understanding
    const matches = await this.findMatchingDocuments(parsedQuery, userId);

    // Calculate confidence and determine action
    const result = this.buildSearchResult(matches, parsedQuery);

    console.log(`✅ [DOC-SEARCH] Found ${result.documents.length} documents (confidence: ${(result.confidence * 100).toFixed(1)}%)`);

    return result;
  }

  /**
   * Check if query is a document search query
   * Supports: English, Portuguese, Spanish
   */
  isDocumentSearchQuery(query: string): boolean {
    const patterns = [
      // ============ ENGLISH PATTERNS ============
      // "which document...", "what document...", "where is the document..."
      /\b(which|what|where)\s+(document|file|report|paper|spreadsheet|pdf)/i,

      // "document that...", "file which...", "report with..."
      /\b(document|file|report)\s+(that|which|with|about|mentioning|containing)/i,

      // "where is...", "locate...", "find the..."
      /\b(where is|locate|find)\s+.*(document|file|report)/i,

      // "show me...", "give me...", "list..."
      /\b(show me|give me|list)\s+.*(document|file|report)/i,

      // "files mentioning...", "documents about..."
      /\b(files?|documents?|reports?)\s+(mentioning|about|regarding|related to)/i,

      // "which file has...", "what file contains..."
      /\b(which|what)\s+(file|document)\s+(has|contains|includes)/i,

      // "find files with...", "search documents for..."
      /\b(find|search)\s+(files?|documents?)\s+(with|for|containing)/i,

      // ============ PORTUGUESE PATTERNS ============
      // "qual documento...", "que documento...", "onde está o documento..."
      /\b(qual|que|onde)\s+(documento|arquivo|relat[óo]rio|planilha|pdf)/i,

      // "documento que...", "arquivo com...", "relatório sobre..."
      /\b(documento|arquivo|relat[óo]rio)\s+(que|com|sobre|mencionando|contendo)/i,

      // "onde está...", "localizar...", "encontrar o..."
      /\b(onde est[áa]|localizar|encontrar)\s+.*(documento|arquivo|relat[óo]rio)/i,

      // "me mostre...", "me dê...", "liste..."
      /\b(me mostre|me d[êe]|listar|liste)\s+.*(documento|arquivo|relat[óo]rio)/i,

      // "arquivos mencionando...", "documentos sobre..."
      /\b(arquivos?|documentos?|relat[óo]rios?)\s+(mencionando|sobre|referente|relacionado)/i,

      // "qual arquivo tem...", "que arquivo contém..."
      /\b(qual|que)\s+(arquivo|documento)\s+(tem|cont[ée]m|inclui)/i,

      // "buscar arquivos com...", "procurar documentos..."
      /\b(buscar|procurar)\s+(arquivos?|documentos?)\s+(com|para|contendo)/i,

      // ============ SPANISH PATTERNS ============
      // "qué documento...", "cuál documento...", "dónde está el documento..."
      /\b(qu[ée]|cu[áa]l|d[óo]nde)\s+(documento|archivo|informe|hoja de c[áa]lculo|pdf)/i,

      // "documento que...", "archivo con...", "informe sobre..."
      /\b(documento|archivo|informe)\s+(que|con|sobre|mencionando|conteniendo)/i,

      // "dónde está...", "localizar...", "encontrar el..."
      /\b(d[óo]nde est[áa]|localizar|encontrar)\s+.*(documento|archivo|informe)/i,

      // "muéstrame...", "dame...", "lista..."
      /\b(mu[ée]strame|dame|listar|lista)\s+.*(documento|archivo|informe)/i,

      // "archivos mencionando...", "documentos sobre..."
      /\b(archivos?|documentos?|informes?)\s+(mencionando|sobre|referente|relacionado)/i,

      // "qué archivo tiene...", "cuál archivo contiene..."
      /\b(qu[ée]|cu[áa]l)\s+(archivo|documento)\s+(tiene|contiene|incluye)/i,

      // "buscar archivos con...", "buscar documentos..."
      /\b(buscar)\s+(archivos?|documentos?)\s+(con|para|conteniendo)/i,
    ];

    return patterns.some(p => p.test(query));
  }

  /**
   * Parse natural language query into structured search criteria
   */
  private parseQuery(query: string): DocumentSearchQuery {
    const lowerQuery = query.toLowerCase();

    // Detect query type
    let type: DocumentSearchQuery['type'] = 'find_document';
    if (this.isMultipleDocumentQuery(lowerQuery)) {
      type = 'find_multiple';
    } else if (this.isLocationQuery(lowerQuery)) {
      type = 'locate_document';
    }

    // Extract criteria
    const criteria: SearchCriteria[] = [];

    // Extract time periods (Q1, Q2, Q3, Q4, 2024, 2025, etc.)
    const timePeriods = this.extractTimePeriods(query);
    timePeriods.forEach(period => {
      criteria.push({
        type: 'time_period',
        value: period,
        weight: 0.9 // High weight for time periods
      });
    });

    // Extract metrics/trends (decline, increase, growth, revenue, profit, etc.)
    const metrics = this.extractMetrics(query);
    metrics.forEach(metric => {
      criteria.push({
        type: 'metric',
        value: metric,
        weight: 0.8
      });
    });

    // Extract topics (revenue, expenses, profit, etc.)
    const topics = this.extractTopics(query);
    topics.forEach(topic => {
      criteria.push({
        type: 'topic',
        value: topic,
        weight: 0.7
      });
    });

    // Extract file types (xlsx, pdf, csv, etc.)
    const fileTypes = this.extractFileTypes(query);
    fileTypes.forEach(fileType => {
      criteria.push({
        type: 'file_type',
        value: fileType,
        weight: 0.6
      });
    });

    // Extract keywords (remaining important words)
    const keywords = this.extractKeywords(query, [...timePeriods, ...metrics, ...topics]);
    keywords.forEach(keyword => {
      criteria.push({
        type: 'keyword',
        value: keyword,
        weight: 0.5
      });
    });

    // Determine operator (AND vs OR)
    const operator = this.detectOperator(query);

    return {
      type,
      criteria,
      operator,
      originalQuery: query
    };
  }

  /**
   * Find documents matching the search criteria
   */
  private async findMatchingDocuments(
    query: DocumentSearchQuery,
    userId: string
  ): Promise<DocumentMatch[]> {
    // If no criteria extracted, return empty
    if (query.criteria.length === 0) {
      console.log('🔍 [DOC-SEARCH] No search criteria extracted');
      return [];
    }

    // Build search conditions for each criterion
    const searchTerms = query.criteria.map(c => c.value);

    // Build ILIKE conditions for each search term
    const ilikeClauses = searchTerms.map(term => `de.content ILIKE '%${term.replace(/'/g, "''")}%'`);
    const whereClause = ilikeClauses.join(' OR ');

    // Search in document chunks using keyword matching
    // Note: For production, consider using full-text search or vector similarity
    try {
      const chunks = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          de.id as chunk_id,
          de."documentId" as document_id,
          de.content as chunk_text,
          d.filename,
          d."mimeType" as mime_type,
          d."fileSize" as file_size,
          d."folderId" as folder_id,
          de."chunkIndex" as chunk_index
        FROM document_embeddings de
        JOIN documents d ON de."documentId" = d.id
        WHERE d."userId" = '${userId}'
          AND d.status != 'deleted'
          AND (${whereClause})
        ORDER BY de."chunkIndex" ASC
        LIMIT 100
      `);

      console.log(`🔍 [DOC-SEARCH] Found ${chunks.length} matching chunks`);

      // Group chunks by document
      const documentChunks = new Map<string, any[]>();
      chunks.forEach(chunk => {
        if (!documentChunks.has(chunk.document_id)) {
          documentChunks.set(chunk.document_id, []);
        }
        documentChunks.get(chunk.document_id)!.push(chunk);
      });

      // Score each document based on criteria matches
      const matches: DocumentMatch[] = [];

      for (const [documentId, docChunks] of Array.from(documentChunks.entries())) {
        const firstChunk = docChunks[0];

        // Check how many criteria are met
        const matchedCriteria: string[] = [];
        const chunkMatches: ChunkMatch[] = [];

        for (const criterion of query.criteria) {
          const matchingChunks = docChunks.filter(chunk =>
            this.chunkMatchesCriterion(chunk.chunk_text, criterion)
          );

          if (matchingChunks.length > 0) {
            matchedCriteria.push(criterion.value);

            // Add top matching chunks
            matchingChunks.slice(0, 3).forEach(chunk => {
              // Avoid duplicate chunks
              if (!chunkMatches.find(cm => cm.chunkId === chunk.chunk_id)) {
                chunkMatches.push({
                  chunkId: chunk.chunk_id,
                  content: chunk.chunk_text.substring(0, 300),
                  relevance: 0.8, // Default relevance for keyword match
                  matchedTerms: [criterion.value]
                });
              }
            });
          }
        }

        // Calculate confidence based on criteria match rate
        const criteriaMatchRate = matchedCriteria.length / query.criteria.length;

        // Boost confidence if all criteria matched
        let confidence = criteriaMatchRate;
        if (criteriaMatchRate === 1) {
          confidence = 0.95; // High confidence for full match
        }

        // Only include if at least one criterion matched
        if (matchedCriteria.length > 0) {
          matches.push({
            documentId,
            filename: firstChunk.filename,
            mimeType: firstChunk.mime_type,
            fileSize: firstChunk.file_size,
            folderId: firstChunk.folder_id,
            confidence,
            matchedCriteria,
            matchedChunks: chunkMatches
          });
        }
      }

      // Sort by confidence (highest first)
      matches.sort((a, b) => b.confidence - a.confidence);

      return matches;

    } catch (error) {
      console.error('🔍 [DOC-SEARCH] Error searching documents:', error);
      return [];
    }
  }

  /**
   * Check if a chunk matches a specific criterion
   */
  private chunkMatchesCriterion(chunkText: string, criterion: SearchCriteria): boolean {
    const lowerText = chunkText.toLowerCase();
    const lowerValue = criterion.value.toLowerCase();

    switch (criterion.type) {
      case 'time_period':
        // Match Q1, Q2, 2024, etc.
        return lowerText.includes(lowerValue);

      case 'metric':
        // Match decline, increase, growth, etc. with synonyms
        const metricSynonyms = this.getMetricSynonyms(lowerValue);
        return metricSynonyms.some(syn => lowerText.includes(syn));

      case 'topic':
        // Match revenue, profit, expenses, etc.
        return lowerText.includes(lowerValue);

      case 'file_type':
        // Not applicable to chunk content
        return false;

      case 'keyword':
        // Exact or fuzzy match
        return lowerText.includes(lowerValue);

      default:
        return false;
    }
  }

  /**
   * Build final search result with appropriate action and message
   */
  private buildSearchResult(
    matches: DocumentMatch[],
    query: DocumentSearchQuery
  ): SearchResult {
    if (matches.length === 0) {
      return {
        success: false,
        confidence: 0,
        documents: [],
        message: this.getNotFoundMessage(query),
        action: 'not_found'
      };
    }

    // Single high-confidence match
    if (matches.length === 1 ||
        (matches[0].confidence > 0.8 &&
         (matches.length < 2 || matches[0].confidence > matches[1].confidence * 1.5))) {
      return {
        success: true,
        confidence: matches[0].confidence,
        documents: [matches[0]],
        message: this.getSingleDocumentMessage(matches[0], query),
        action: 'show_single',
        uiData: {
          document: {
            id: matches[0].documentId,
            filename: matches[0].filename,
            mimeType: matches[0].mimeType,
            fileSize: matches[0].fileSize,
            folderId: matches[0].folderId
          },
          matchedCriteria: matches[0].matchedCriteria,
          preview: matches[0].matchedChunks[0]?.content
        }
      };
    }

    // Multiple documents match
    // Check if query requires AND operator - all criteria must be in same doc
    if (query.operator === 'AND') {
      // Filter to documents that match ALL criteria
      const perfectMatches = matches.filter(m =>
        m.matchedCriteria.length === query.criteria.length
      );

      if (perfectMatches.length === 1) {
        return {
          success: true,
          confidence: perfectMatches[0].confidence,
          documents: [perfectMatches[0]],
          message: this.getSingleDocumentMessage(perfectMatches[0], query),
          action: 'show_single',
          uiData: {
            document: {
              id: perfectMatches[0].documentId,
              filename: perfectMatches[0].filename,
              mimeType: perfectMatches[0].mimeType,
              fileSize: perfectMatches[0].fileSize,
              folderId: perfectMatches[0].folderId
            },
            matchedCriteria: perfectMatches[0].matchedCriteria,
            preview: perfectMatches[0].matchedChunks[0]?.content
          }
        };
      }

      if (perfectMatches.length === 0) {
        // No single document has all criteria - show partial matches
        return {
          success: true,
          confidence: matches[0].confidence,
          documents: matches.slice(0, 5),
          message: this.getMultipleDocumentsMessage(matches.slice(0, 5), query, true),
          action: 'show_multiple',
          uiData: {
            documents: matches.slice(0, 5).map(m => ({
              id: m.documentId,
              filename: m.filename,
              mimeType: m.mimeType,
              fileSize: m.fileSize,
              folderId: m.folderId,
              matchedCriteria: m.matchedCriteria,
              confidence: m.confidence
            })),
            note: 'No single document contains all criteria. Showing documents with partial matches.'
          }
        };
      }
    }

    // Multiple matches - show all
    return {
      success: true,
      confidence: matches[0].confidence,
      documents: matches.slice(0, 5),
      message: this.getMultipleDocumentsMessage(matches.slice(0, 5), query, false),
      action: 'show_multiple',
      uiData: {
        documents: matches.slice(0, 5).map(m => ({
          id: m.documentId,
          filename: m.filename,
          mimeType: m.mimeType,
          fileSize: m.fileSize,
          folderId: m.folderId,
          matchedCriteria: m.matchedCriteria,
          confidence: m.confidence
        }))
      }
    };
  }

  /**
   * Generate comforting message for single document result
   */
  private getSingleDocumentMessage(match: DocumentMatch, query: DocumentSearchQuery): string {
    const criteriaText = match.matchedCriteria.length > 0
      ? ` mentioning ${match.matchedCriteria.slice(0, 2).map(c => `**${c}**`).join(' and ')}`
      : '';

    return `I found the document you're looking for! **${match.filename}**${criteriaText} matches your search with ${(match.confidence * 100).toFixed(0)}% confidence.`;
  }

  /**
   * Generate comforting message for multiple documents
   */
  private getMultipleDocumentsMessage(
    matches: DocumentMatch[],
    query: DocumentSearchQuery,
    isPartialMatch: boolean
  ): string {
    if (isPartialMatch) {
      return `I couldn't find a single document with all your criteria, but I found **${matches.length} documents** with relevant information. Each document contains some of what you're looking for.`;
    }

    const criteriaText = query.criteria.length > 0
      ? ` related to ${query.criteria.slice(0, 2).map(c => `**${c.value}**`).join(' and ')}`
      : '';

    return `I found **${matches.length} documents**${criteriaText} that match your search. Here they are, sorted by relevance:`;
  }

  /**
   * Generate message when no documents found
   */
  private getNotFoundMessage(query: DocumentSearchQuery): string {
    const criteriaText = query.criteria.length > 0
      ? ` containing ${query.criteria.map(c => `**${c.value}**`).join(' and ')}`
      : '';

    return `I couldn't find any documents${criteriaText}. Try broadening your search or checking if the document has been uploaded.`;
  }

  // ============================================================================
  // QUERY PARSING HELPERS
  // ============================================================================

  private isMultipleDocumentQuery(query: string): boolean {
    // English, Portuguese, Spanish patterns
    return /\b(files|documents|all|multiple|list|every|arquivos|documentos|todos|m[úu]ltiplos|listar|cada|archivos|todos|m[úu]ltiples)\b/i.test(query);
  }

  private isLocationQuery(query: string): boolean {
    // English, Portuguese, Spanish patterns
    return /\b(where|locate|find|location|onde|localizar|encontrar|localiza[çc][ãa]o|d[óo]nde|ubicar|ubicaci[óo]n)\b/i.test(query);
  }

  private extractTimePeriods(query: string): string[] {
    const periods: string[] = [];

    // Match Q1, Q2, Q3, Q4 (universal)
    const quarterMatches = query.match(/Q[1-4]/gi);
    if (quarterMatches) {
      periods.push(...quarterMatches.map(q => q.toUpperCase()));
    }

    // Match years (2020-2030)
    const yearMatches = query.match(/\b(20[2-3][0-9])\b/g);
    if (yearMatches) {
      periods.push(...yearMatches);
    }

    // Match English months
    const englishMonthPattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi;
    const englishMonthMatches = query.match(englishMonthPattern);
    if (englishMonthMatches) {
      periods.push(...englishMonthMatches);
    }

    // Match Portuguese months
    const portugueseMonthPattern = /\b(Janeiro|Fevereiro|Mar[çc]o|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro|Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\b/gi;
    const portugueseMonthMatches = query.match(portugueseMonthPattern);
    if (portugueseMonthMatches) {
      periods.push(...portugueseMonthMatches);
    }

    // Match Spanish months
    const spanishMonthPattern = /\b(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre|Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\b/gi;
    const spanishMonthMatches = query.match(spanishMonthPattern);
    if (spanishMonthMatches) {
      periods.push(...spanishMonthMatches);
    }

    return Array.from(new Set(periods));
  }

  private extractMetrics(query: string): string[] {
    const metrics: string[] = [];

    const metricPatterns = [
      // English
      'decline', 'decrease', 'drop', 'fall', 'reduction',
      'increase', 'growth', 'rise', 'gain', 'improvement',
      'ROI', 'IRR', 'MoIC', 'CAGR', 'NPV',
      'budget', 'forecast', 'projection', 'actual',
      // Portuguese
      'decl[íi]nio', 'diminui[çc][ãa]o', 'queda', 'redu[çc][ãa]o',
      'aumento', 'crescimento', 'ganho', 'melhoria',
      'or[çc]amento', 'previs[ãa]o', 'proje[çc][ãa]o', 'real',
      // Spanish
      'declive', 'disminuci[óo]n', 'ca[íi]da', 'reducci[óo]n',
      'aumento', 'crecimiento', 'ganancia', 'mejora',
      'presupuesto', 'pron[óo]stico', 'proyecci[óo]n', 'real'
    ];

    metricPatterns.forEach(pattern => {
      if (new RegExp(`\\b${pattern}\\b`, 'i').test(query)) {
        // Normalize to lowercase, removing diacritics for matching
        const normalized = pattern.toLowerCase().replace(/\[.*?\]/g, '');
        metrics.push(normalized);
      }
    });

    return Array.from(new Set(metrics));
  }

  private extractTopics(query: string): string[] {
    const topics: string[] = [];

    const topicPatterns = [
      // English
      'revenue', 'sales', 'income',
      'expenses', 'costs', 'spending',
      'profit', 'earnings', 'margin',
      'investment', 'capital', 'funding',
      'performance', 'results', 'analysis',
      'budget', 'financial', 'report',
      // Portuguese
      'receita', 'vendas', 'renda',
      'despesas', 'custos', 'gastos',
      'lucro', 'ganhos', 'margem',
      'investimento', 'capital', 'financiamento',
      'desempenho', 'resultados', 'an[áa]lise',
      'or[çc]amento', 'financeiro', 'relat[óo]rio',
      // Spanish
      'ingresos', 'ventas', 'renta',
      'gastos', 'costos', 'costes',
      'ganancia', 'utilidad', 'margen',
      'inversi[óo]n', 'capital', 'financiamiento',
      'rendimiento', 'resultados', 'an[áa]lisis',
      'presupuesto', 'financiero', 'informe'
    ];

    topicPatterns.forEach(pattern => {
      if (new RegExp(`\\b${pattern}\\b`, 'i').test(query)) {
        const normalized = pattern.toLowerCase().replace(/\[.*?\]/g, '');
        topics.push(normalized);
      }
    });

    return Array.from(new Set(topics));
  }

  private extractFileTypes(query: string): string[] {
    const types: string[] = [];

    const typePattern = /\b(xlsx?|pdf|csv|docx?|pptx?|txt)\b/gi;
    const matches = query.match(typePattern);
    if (matches) {
      types.push(...matches.map(t => t.toLowerCase()));
    }

    return Array.from(new Set(types));
  }

  private extractKeywords(query: string, excludeTerms: string[]): string[] {
    // Remove common words and already extracted terms
    // Supports English, Portuguese, Spanish stop words
    const stopWords = [
      // English
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'what', 'which',
      'where', 'when', 'who', 'how', 'document', 'file', 'show', 'find',
      'search', 'get', 'me', 'my', 'please', 'can', 'you', 'that', 'this',
      'has', 'have', 'contains', 'mentions', 'mentioning', 'about', 'regarding',
      // Portuguese
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'e', 'ou', 'mas',
      'em', 'no', 'na', 'nos', 'nas', 'de', 'do', 'da', 'dos', 'das',
      'para', 'por', 'com', 'que', 'qual', 'quais', 'onde', 'quando', 'quem',
      'como', 'documento', 'arquivo', 'mostre', 'encontre', 'buscar', 'procurar',
      'me', 'meu', 'minha', 'por favor', 'pode', 'voce', 'isso', 'esse', 'esta',
      'tem', 'ter', 'contem', 'menciona', 'mencionando', 'sobre', 'referente',
      // Spanish
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero',
      'en', 'con', 'por', 'para', 'de', 'del', 'al', 'que', 'cual', 'cuales',
      'donde', 'cuando', 'quien', 'como', 'documento', 'archivo', 'muestra',
      'encontrar', 'buscar', 'me', 'mi', 'por favor', 'puede', 'tu', 'eso',
      'ese', 'esta', 'tiene', 'tener', 'contiene', 'menciona', 'mencionando'
    ];

    const words = query.toLowerCase().split(/\s+/);
    const keywords = words.filter(word =>
      word.length > 2 &&
      !stopWords.includes(word) &&
      !excludeTerms.some(term => term.toLowerCase() === word)
    );

    return Array.from(new Set(keywords));
  }

  private detectOperator(query: string): 'AND' | 'OR' {
    // If query contains "and", "both", "all" in English, Portuguese, or Spanish, use AND
    // English: and, both, all
    // Portuguese: e, ambos, todos
    // Spanish: y, ambos, todos
    if (/\b(and|both|all|ambos|todos)\b/i.test(query)) {
      return 'AND';
    }

    // Default to OR for broader results
    return 'OR';
  }

  private getMetricSynonyms(metric: string): string[] {
    const synonymMap: Record<string, string[]> = {
      // Decline synonyms (EN + PT + ES)
      'decline': ['decline', 'decrease', 'drop', 'fall', 'reduction', 'downturn', 'down',
                  'declínio', 'diminuição', 'queda', 'redução', 'baixa',
                  'declive', 'disminución', 'caída', 'reducción', 'baja'],
      'decrease': ['decline', 'decrease', 'drop', 'fall', 'reduction', 'downturn', 'down',
                   'declínio', 'diminuição', 'queda', 'redução', 'baixa'],
      'queda': ['decline', 'decrease', 'drop', 'fall', 'queda', 'diminuição', 'redução'],
      'caída': ['decline', 'decrease', 'drop', 'fall', 'caída', 'disminución', 'reducción'],

      // Increase synonyms (EN + PT + ES)
      'increase': ['increase', 'growth', 'rise', 'gain', 'improvement', 'upturn', 'up',
                   'aumento', 'crescimento', 'subida', 'ganho', 'melhoria', 'alta',
                   'incremento', 'crecimiento', 'alza', 'ganancia', 'mejora'],
      'growth': ['increase', 'growth', 'rise', 'gain', 'improvement', 'crescimento', 'aumento', 'crecimiento'],
      'crescimento': ['increase', 'growth', 'rise', 'crescimento', 'aumento', 'melhoria'],
      'crecimiento': ['increase', 'growth', 'rise', 'crecimiento', 'aumento', 'incremento'],

      // Revenue synonyms (EN + PT + ES)
      'revenue': ['revenue', 'sales', 'income', 'receipts', 'turnover',
                  'receita', 'vendas', 'renda', 'faturamento',
                  'ingresos', 'ventas', 'renta', 'facturación'],
      'receita': ['revenue', 'sales', 'income', 'receita', 'vendas', 'faturamento'],
      'ingresos': ['revenue', 'sales', 'income', 'ingresos', 'ventas', 'facturación'],

      // Profit synonyms (EN + PT + ES)
      'profit': ['profit', 'earnings', 'net income', 'bottom line', 'margin',
                 'lucro', 'ganhos', 'resultado líquido', 'margem',
                 'ganancia', 'utilidad', 'beneficio', 'margen'],
      'lucro': ['profit', 'earnings', 'lucro', 'ganhos', 'margem'],
      'ganancia': ['profit', 'earnings', 'ganancia', 'utilidad', 'beneficio'],

      // Expense synonyms (EN + PT + ES)
      'expense': ['expense', 'cost', 'spending', 'expenditure', 'outlay',
                  'despesa', 'custo', 'gasto',
                  'gasto', 'costo', 'coste']
    };

    return synonymMap[metric] || [metric];
  }
}

export const semanticDocumentSearchService = new SemanticDocumentSearchService();
export default semanticDocumentSearchService;
