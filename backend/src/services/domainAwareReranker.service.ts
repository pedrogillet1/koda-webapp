/**
 * Domain-Aware Reranker Service
 *
 * Applies domain-specific boosting to chunks during reranking.
 * Boosts chunks that contain domain-relevant patterns and entities.
 */

import { Domain } from './domainDetector.service';

export interface RerankableChunk {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Domain-specific boost patterns
 */
const DOMAIN_BOOST_PATTERNS: Record<Domain, {
  keywords: string[];
  entities: RegExp[];
  boost: number;
}> = {
  finance: {
    keywords: [
      'roi', 'payback', 'vpl', 'npv', 'tir', 'irr', 'lucro', 'profit',
      'receita', 'revenue', 'custo', 'cost', 'investimento', 'investment',
      'margem', 'margin', 'ebitda', 'fluxo de caixa', 'cash flow',
      'cenário', 'scenario', 'projeção', 'projection', 'viabilidade', 'feasibility',
      'retorno', 'return'
    ],
    entities: [
      /R\$\s*[\d.,]+/gi, // Currency BRL
      /\$\s*[\d.,]+/gi, // Currency USD
      /\d+%/gi, // Percentages
      /\d+\s*(meses|anos|months|years)/gi, // Time periods
    ],
    boost: 1.5
  },

  accounting: {
    keywords: [
      'balanço', 'balance', 'demonstração', 'statement', 'ativo', 'asset',
      'passivo', 'liability', 'patrimônio', 'equity', 'depreciação', 'depreciation',
      'lançamento', 'entry', 'débito', 'debit', 'crédito', 'credit',
      'liquidez', 'liquidity', 'solvência', 'solvency', 'endividamento', 'leverage',
      'capital de giro', 'working capital'
    ],
    entities: [
      /balanço\s*patrimonial/gi,
      /balance\s*sheet/gi,
      /dre|demonstração\s*(do\s*)?resultado/gi,
      /income\s*statement/gi,
      /R\$\s*[\d.,]+/gi,
    ],
    boost: 1.5
  },

  legal: {
    keywords: [
      'cláusula', 'clause', 'contrato', 'contract', 'obrigação', 'obligation',
      'direito', 'right', 'penalidade', 'penalty', 'rescisão', 'termination',
      'vigência', 'validity', 'prazo', 'deadline', 'multa', 'fine',
      'confidencialidade', 'confidentiality', 'lgpd', 'gdpr', 'dados', 'data'
    ],
    entities: [
      /cláusula\s*\d+/gi, // Clause numbers
      /clause\s*\d+/gi,
      /artigo\s*\d+/gi, // Article numbers
      /article\s*\d+/gi,
      /item\s*\d+/gi, // Item numbers
      /parágrafo\s*\d+/gi, // Paragraph numbers
    ],
    boost: 1.8 // Higher boost for legal (clause references are critical)
  },

  medical: {
    keywords: [
      'exame', 'exam', 'laudo', 'report', 'diagnóstico', 'diagnosis',
      'resultado', 'result', 'valor', 'value', 'referência', 'reference',
      'normal', 'alterado', 'abnormal', 'elevado', 'elevated', 'reduzido', 'reduced',
      'hemograma', 'glicose', 'glucose', 'colesterol', 'cholesterol',
      'impressão', 'impression', 'conclusão', 'conclusion'
    ],
    entities: [
      /\d+\s*(mg\/dl|g\/dl|mm³|ui\/l|ng\/ml)/gi, // Lab values with units
      /valor\s*de\s*referência/gi,
      /reference\s*value/gi,
      /\d+\s*[-–]\s*\d+/gi, // Reference ranges
    ],
    boost: 1.6
  },

  education: {
    keywords: [
      'introdução', 'introduction', 'desenvolvimento', 'development',
      'conclusão', 'conclusion', 'argumento', 'argument', 'tese', 'thesis',
      'parágrafo', 'paragraph', 'texto', 'text', 'resumo', 'summary',
      'análise', 'analysis', 'interpretação', 'interpretation'
    ],
    entities: [
      /parágrafo\s*\d+/gi,
      /paragraph\s*\d+/gi,
      /capítulo\s*\d+/gi,
      /chapter\s*\d+/gi,
    ],
    boost: 1.3
  },

  research: {
    keywords: [
      'hipótese', 'hypothesis', 'metodologia', 'methodology', 'resultado', 'result',
      'discussão', 'discussion', 'conclusão', 'conclusion', 'amostra', 'sample',
      'participantes', 'participants', 'variável', 'variable', 'significância', 'significance',
      'estatística', 'statistics', 'correlação', 'correlation', 'análise', 'analysis',
      'estudo', 'study', 'pesquisa', 'research'
    ],
    entities: [
      /p\s*[<>=]\s*0\.\d+/gi, // p-values
      /n\s*=\s*\d+/gi, // Sample size
      /\d+%\s*\(\d+\/\d+\)/gi, // Percentages with fractions
      /ci\s*\d+%/gi, // Confidence intervals
    ],
    boost: 1.4
  },

  general: {
    keywords: [],
    entities: [],
    boost: 1.0
  }
};

/**
 * Apply domain-specific boosting to chunks
 */
export function applyDomainBoosting(
  chunks: RerankableChunk[],
  domain: Domain,
  query: string
): RerankableChunk[] {
  // If general domain, no boosting
  if (domain === 'general') {
    return chunks;
  }

  const boostConfig = DOMAIN_BOOST_PATTERNS[domain];
  if (!boostConfig) {
    return chunks;
  }

  return chunks.map(chunk => {
    const chunkLower = chunk.content.toLowerCase();
    let boostMultiplier = 1.0;
    const boostReasons: string[] = [];

    // Check for keyword matches
    let keywordMatches = 0;
    for (const keyword of boostConfig.keywords) {
      if (chunkLower.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    }

    if (keywordMatches > 0) {
      // Boost based on number of keyword matches
      const keywordBoost = 1.0 + (keywordMatches * 0.1);
      boostMultiplier *= keywordBoost;
      boostReasons.push(`keywords:${keywordMatches}`);
    }

    // Check for entity matches
    let entityMatches = 0;
    for (const entityPattern of boostConfig.entities) {
      const matches = chunk.content.match(entityPattern);
      if (matches) {
        entityMatches += matches.length;
      }
    }

    if (entityMatches > 0) {
      // Entities are strong signals
      const entityBoost = 1.0 + (entityMatches * 0.15);
      boostMultiplier *= entityBoost;
      boostReasons.push(`entities:${entityMatches}`);
    }

    // Apply base domain boost if any signals found
    if (keywordMatches > 0 || entityMatches > 0) {
      boostMultiplier *= boostConfig.boost;
    }

    // Apply boost
    const boostedScore = chunk.score * boostMultiplier;

    return {
      ...chunk,
      score: boostedScore,
      metadata: {
        ...chunk.metadata,
        domainBoost: boostMultiplier,
        domainBoostReasons: boostReasons,
        originalScore: chunk.score
      }
    };
  });
}

/**
 * Boost chunks that contain query-specific terms
 */
export function boostQueryRelevantChunks(
  chunks: RerankableChunk[],
  query: string,
  domain: Domain
): RerankableChunk[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);

  return chunks.map(chunk => {
    const chunkLower = chunk.content.toLowerCase();
    let termMatches = 0;

    for (const term of queryTerms) {
      if (chunkLower.includes(term)) {
        termMatches++;
      }
    }

    // Calculate boost based on term coverage
    const termCoverage = queryTerms.length > 0 ? termMatches / queryTerms.length : 0;
    const queryBoost = 1.0 + (termCoverage * 0.3);

    const boostedScore = chunk.score * queryBoost;

    return {
      ...chunk,
      score: boostedScore,
      metadata: {
        ...chunk.metadata,
        queryBoost,
        queryTermMatches: termMatches,
        queryTermCoverage: termCoverage
      }
    };
  });
}

/**
 * Boost chunks based on chunk type (for specific domains)
 */
export function boostByChunkType(
  chunks: RerankableChunk[],
  domain: Domain
): RerankableChunk[] {
  // Chunk type priorities by domain
  const chunkTypePriorities: Partial<Record<Domain, Record<string, number>>> = {
    finance: {
      'financial_table': 1.8,
      'financial_summary': 1.6,
      'calculation': 1.5,
      'scenario_comparison': 1.7,
      'default': 1.0
    },
    accounting: {
      'balance_sheet': 1.8,
      'income_statement': 1.7,
      'financial_table': 1.6,
      'default': 1.0
    },
    legal: {
      'clause': 2.0, // Clauses are most important
      'obligation': 1.7,
      'penalty': 1.6,
      'definition': 1.5,
      'default': 1.0
    },
    medical: {
      'lab_result': 1.8,
      'impression': 2.0, // Impression/conclusion is most important
      'reference_range': 1.6,
      'default': 1.0
    },
    research: {
      'methodology': 1.6,
      'results': 1.8,
      'discussion': 1.5,
      'conclusion': 1.7,
      'default': 1.0
    }
  };

  const priorities = chunkTypePriorities[domain];
  if (!priorities) {
    return chunks;
  }

  return chunks.map(chunk => {
    const chunkType = chunk.metadata?.chunkType || chunk.metadata?.type || 'default';
    const typeBoost = priorities[chunkType] || priorities['default'] || 1.0;

    const boostedScore = chunk.score * typeBoost;

    return {
      ...chunk,
      score: boostedScore,
      metadata: {
        ...chunk.metadata,
        chunkTypeBoost: typeBoost
      }
    };
  });
}

/**
 * Complete domain-aware reranking pipeline
 */
export function rerankWithDomainAwareness(
  chunks: RerankableChunk[],
  query: string,
  domain: Domain
): RerankableChunk[] {
  // Step 1: Apply domain-specific boosting
  let rankedChunks = applyDomainBoosting(chunks, domain, query);

  // Step 2: Boost query-relevant chunks
  rankedChunks = boostQueryRelevantChunks(rankedChunks, query, domain);

  // Step 3: Boost by chunk type
  rankedChunks = boostByChunkType(rankedChunks, domain);

  // Step 4: Sort by final score
  rankedChunks.sort((a, b) => b.score - a.score);

  return rankedChunks;
}

/**
 * Get boost explanation for a chunk
 */
export function getBoostExplanation(chunk: RerankableChunk): string {
  const metadata = chunk.metadata || {};
  const parts: string[] = [];

  if (metadata.originalScore !== undefined) {
    parts.push(`Original: ${metadata.originalScore.toFixed(3)}`);
  }

  if (metadata.domainBoost !== undefined && metadata.domainBoost !== 1.0) {
    parts.push(`Domain: x${metadata.domainBoost.toFixed(2)}`);
    if (metadata.domainBoostReasons) {
      parts.push(`(${metadata.domainBoostReasons.join(', ')})`);
    }
  }

  if (metadata.queryBoost !== undefined && metadata.queryBoost !== 1.0) {
    parts.push(`Query: x${metadata.queryBoost.toFixed(2)}`);
    if (metadata.queryTermCoverage !== undefined) {
      parts.push(`(${(metadata.queryTermCoverage * 100).toFixed(0)}% coverage)`);
    }
  }

  if (metadata.chunkTypeBoost !== undefined && metadata.chunkTypeBoost !== 1.0) {
    parts.push(`Type: x${metadata.chunkTypeBoost.toFixed(2)}`);
  }

  parts.push(`Final: ${chunk.score.toFixed(3)}`);

  return parts.join(' | ');
}

export default {
  applyDomainBoosting,
  boostQueryRelevantChunks,
  boostByChunkType,
  rerankWithDomainAwareness,
  getBoostExplanation
};
