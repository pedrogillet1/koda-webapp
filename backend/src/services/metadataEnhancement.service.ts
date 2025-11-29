/**
 * Metadata Enhancement Service
 *
 * Extracts enhanced metadata from documents:
 * - Language detection (filename + content analysis)
 * - Category classification (financial, legal, personal, etc.)
 * - Document type detection (passport, receipt, contract, etc.)
 * - Entity extraction (people, places, organizations, amounts, dates)
 */

import { DocumentEntities, EnhancedDocumentMetadata, MetadataFilters } from '../types/metadata.types';

export class MetadataEnhancementService {

  /**
   * Detect document language from filename and content
   */
  detectLanguage(text: string, filename: string): string {
    // Method 1: Check filename for language indicators
    const filenameIndicators: Record<string, string> = {
      'capítulo': 'pt',
      'comprovante': 'pt',
      'recibo': 'pt',
      'contrato': 'pt',
      'orçamento': 'pt',
      // @ts-ignore - duplicate property
      // @ts-ignore
      'chapter': 'en',
      'receipt': 'en',
      'contract': 'en',
      'budget': 'en',
      'presentation': 'en',
    };

    const filenameLower = filename.toLowerCase();
    for (const [indicator, lang] of Object.entries(filenameIndicators)) {
      if (filenameLower.includes(indicator)) {
        console.log(`   Language detected from filename: ${lang} (indicator: "${indicator}")`);
        return lang;
      }
    }

    // Method 2: Check content for language patterns
    const textSample = text.slice(0, 1000).toLowerCase();

    // Portuguese indicators
    const ptIndicators = [
      'é', 'ã', 'õ', 'ç', 'você', 'não', 'será', 'está',
      'dados', 'valor', 'documento', 'número'
    ];
    const ptCount = ptIndicators.filter(word => textSample.includes(word)).length;

    // English indicators
    const enIndicators = [
      'the', 'and', 'is', 'for', 'with', 'this', 'that', 'from'
    ];
    const enCount = enIndicators.filter(word => textSample.includes(word)).length;

    // Spanish indicators
    const esIndicators = [
      'el', 'la', 'es', 'para', 'con', 'este', 'esta', 'de'
    ];
    const esCount = esIndicators.filter(word => textSample.includes(word)).length;

    // Determine language by highest indicator count
    const max = Math.max(ptCount, enCount, esCount);
    if (max === 0) return 'en'; // Default to English

    if (ptCount === max) {
      console.log(`   Language detected from content: pt (${ptCount} indicators)`);
      return 'pt';
    }
    if (enCount === max) {
      console.log(`   Language detected from content: en (${enCount} indicators)`);
      return 'en';
    }
    if (esCount === max) {
      console.log(`   Language detected from content: es (${esCount} indicators)`);
      return 'es';
    }

    return 'en';
  }

  /**
   * Detect document category
   */
  detectCategory(text: string, filename: string): string {
    const categoryKeywords: Record<string, string[]> = {
      'financial': [
        'budget', 'p&l', 'profit', 'loss', 'revenue', 'expense',
        'invoice', 'receipt', 'payment', 'transaction', 'comprovante',
        'orçamento', 'receita', 'despesa', 'fatura', 'pagamento',
        'pix', 'transferência', 'valor', 'total', '$', 'R$'
      ],
      'legal': [
        'contract', 'agreement', 'terms', 'conditions', 'legal',
        'contrato', 'acordo', 'termos', 'condições', 'cláusula'
      ],
      'personal': [
        'passport', 'id', 'driver', 'license', 'birth', 'certificate',
        'passaporte', 'identidade', 'carteira', 'certidão', 'nascimento'
      ],
      'medical': [
        'medical', 'health', 'prescription', 'diagnosis', 'treatment',
        'médico', 'saúde', 'receita', 'diagnóstico', 'tratamento'
      ],
      'business': [
        'presentation', 'plan', 'strategy', 'proposal', 'pitch',
        'apresentação', 'plano', 'estratégia', 'proposta', 'blueprint'
      ],
      'academic': [
        'chapter', 'thesis', 'research', 'study', 'paper',
        'capítulo', 'tese', 'pesquisa', 'estudo', 'artigo', 'framework'
      ],
    };

    const textLower = (text + ' ' + filename).toLowerCase();

    // Count keyword matches for each category
    const categoryScores: Record<string, number> = {};

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          score++;
        }
      }
      categoryScores[category] = score;
    }

    // Find category with highest score
    const maxScore = Math.max(...Object.values(categoryScores));
    if (maxScore === 0) {
      return 'general';
    }

    const detectedCategory = Object.entries(categoryScores)
      .find(([cat, score]) => score === maxScore)?.[0] || 'general';

    console.log(`   Category detected: ${detectedCategory} (score: ${maxScore})`);
    return detectedCategory;
  }

  /**
   * Detect specific document type
   */
  detectDocumentType(text: string, filename: string): string {
    const typePatterns: Record<string, RegExp[]> = {
      'passport': [/passport/i, /passaporte/i, /validade/i, /date of expiry/i],
      'receipt': [/receipt/i, /comprovante/i, /recibo/i, /pix/i, /transferência/i],
      'contract': [/contract/i, /agreement/i, /contrato/i],
      'budget': [/budget/i, /p&l/i, /profit.*loss/i, /orçamento/i],
      'presentation': [/\.pptx?$/i, /presentation/i, /apresentação/i, /slide/i],
      'spreadsheet': [/\.xlsx?$/i, /budget/i, /financial/i],
      'blueprint': [/blueprint/i, /architecture/i, /design/i],
      'checklist': [/checklist/i, /lista/i, /check.*list/i],
      'plan': [/business.*plan/i, /plano.*negócio/i],
      'invoice': [/invoice/i, /fatura/i, /nota.*fiscal/i],
    };

    const combined = (text + ' ' + filename).toLowerCase();

    for (const [type, patterns] of Object.entries(typePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(combined)) {
          console.log(`   Document type detected: ${type}`);
          return type;
        }
      }
    }

    return 'document';
  }

  /**
   * Extract named entities (people, places, organizations, amounts, dates)
   */
  extractEntities(text: string, filename: string): DocumentEntities {
    const combined = text + ' ' + filename;

    // Extract amounts (currency)
    const amountPatterns = [
      /(?:R\$|USD|\$|€|£)\s*[\d,]+\.?\d*/g,
      /[\d,]+\.?\d*\s*(?:dollars?|reais?)/gi,
    ];

    const amounts: string[] = [];
    for (const pattern of amountPatterns) {
      const matches = Array.from(combined.matchAll(pattern));
      amounts.push(...matches.map(m => m[0].trim()));
    }

    // Extract dates
    const datePatterns = [
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
      /\d{4}-\d{2}-\d{2}/g,
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
    ];

    const dates: string[] = [];
    for (const pattern of datePatterns) {
      const matches = Array.from(combined.matchAll(pattern));
      dates.push(...matches.map(m => m[0].trim()));
    }

    // Extract locations (simple approach - look for capitalized words after location prepositions)
    const locationPatterns = [
      /(?:in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
      /\b(Montana|Brazil|Brasil|California|New York|Texas|Florida)\b/gi,
    ];

    const locations: string[] = [];
    for (const pattern of locationPatterns) {
      const matches = Array.from(combined.matchAll(pattern));
      matches.forEach(m => {
        if (m[1]) locations.push(m[1].trim());
        else locations.push(m[0].trim());
      });
    }

    // Extract people names (2-3 capitalized words, common name patterns)
    const peoplePattern = /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    const peopleMatches = Array.from(text.matchAll(peoplePattern));
    const people = peopleMatches
      .map(m => m[1].trim())
      .filter(name => {
        // Filter out common false positives
        const blacklist = ['Slide', 'Page', 'Document', 'File', 'Chapter', 'Section'];
        return !blacklist.some(word => name.includes(word));
      });

    // Extract organizations (words with Inc, LLC, Corp, etc.)
    const orgPatterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|LLC|Corp|Ltd|S\.A\.|LTDA)/g,
      /\b(Koda|KODA|Lone Mountain Ranch|Google|Microsoft|Amazon)\b/g,
    ];

    const organizations: string[] = [];
    for (const pattern of orgPatterns) {
      const matches = Array.from(combined.matchAll(pattern));
      matches.forEach(m => {
        if (m[1]) organizations.push(m[1].trim());
        else organizations.push(m[0].trim());
      });
    }

    // Deduplicate and limit
    const entities: DocumentEntities = {
      people: [...new Set(people)].slice(0, 10),
      organizations: [...new Set(organizations)].slice(0, 10),
      locations: [...new Set(locations)].slice(0, 10),
      dates: [...new Set(dates)].slice(0, 10),
      amounts: [...new Set(amounts)].slice(0, 10),
    };

    console.log(`   Entities extracted:`, {
      people: entities.people.length,
      organizations: entities.organizations.length,
      locations: entities.locations.length,
      dates: entities.dates.length,
      amounts: entities.amounts.length,
    });

    return entities;
  }

  /**
   * Build searchable text for keyword search
   * Includes: filename + entities + key terms
   */
  buildSearchableText(
    filename: string,
    text: string,
    entities: DocumentEntities
  ): string {
    // Combine filename + entities + first 500 chars
    const parts = [
      filename,
      ...entities.people,
      ...entities.organizations,
      ...entities.locations,
      ...entities.amounts,
      text.slice(0, 500),
    ];

    return parts.join(' ').toLowerCase();
  }

  /**
   * Extract metadata filters from query
   */
  extractMetadataFilters(query: string): MetadataFilters {
    const filters: MetadataFilters = {};
    const queryLower = query.toLowerCase();

    // Language filters
    if (queryLower.includes('portuguese') || queryLower.includes('português')) {
      filters.language = 'pt';
    } else if (queryLower.includes('english')) {
      filters.language = 'en';
    } else if (queryLower.includes('spanish') || queryLower.includes('español')) {
      filters.language = 'es';
    }

    // Category filters
    if (queryLower.includes('financial') || queryLower.includes('financeiro')) {
      filters.category = 'financial';
    } else if (queryLower.includes('legal')) {
      filters.category = 'legal';
    } else if (queryLower.includes('medical') || queryLower.includes('médico')) {
      filters.category = 'medical';
    } else if (queryLower.includes('business') || queryLower.includes('negócio')) {
      filters.category = 'business';
    }

    // File type filters
    if (queryLower.includes('pdf')) {
      filters.fileExtension = 'pdf';
    } else if (queryLower.includes('excel') || queryLower.includes('spreadsheet')) {
      filters.fileExtension = 'xlsx';
    } else if (queryLower.includes('word') || queryLower.includes('document')) {
      filters.fileExtension = 'docx';
    } else if (queryLower.includes('powerpoint') || queryLower.includes('presentation')) {
      filters.fileExtension = 'pptx';
    }

    console.log(`   Metadata filters extracted:`, filters);
    return filters;
  }
}

export default new MetadataEnhancementService();
