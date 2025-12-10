/**
 * Context Manager - Unified Context Assembly & Compression
 * 
 * Merges:
 * - contextEngineering.service.ts
 * - contextCompression.service.ts
 * - skillAwareContext.service.ts
 * - rag/generation/context-builder.service.ts
 * 
 * Single source of truth for building final LLM context
 */

import type { RetrievalChunk } from './kodaRetrievalEngine.service';

export interface ContextBuildOptions {
  query: string;
  memoryContext: string;
  retrievedChunks: RetrievalChunk[];
  answerType: string;
  languageCode: string;
  maxTokens?: number;
  skill?: string; // Domain skill (finance, legal, medical, etc.)
}

export interface BuiltContext {
  finalContext: string;
  tokensUsed: number;
  chunksIncluded: number;
  compressionApplied: boolean;
}

/**
 * Build final context for LLM
 */
export async function buildContext(options: ContextBuildOptions): Promise<BuiltContext> {
  const {
    query,
    memoryContext,
    retrievedChunks,
    answerType,
    languageCode,
    maxTokens = 100000, // Gemini 2.0 Flash has 1M context window
    skill,
  } = options;

  // Token budget allocation
  const budget = calculateTokenBudget(maxTokens, answerType);

  // Build context sections
  const sections: string[] = [];
  let tokensUsed = 0;
  let chunksIncluded = 0;
  let compressionApplied = false;

  // 1. Memory context (if exists)
  if (memoryContext && memoryContext.trim()) {
    const memorySection = `## Conversation History\n\n${memoryContext}\n`;
    const memoryTokens = estimateTokens(memorySection);
    
    if (memoryTokens <= budget.memory) {
      sections.push(memorySection);
      tokensUsed += memoryTokens;
    } else {
      // Compress memory if too long
      const compressed = compressMemory(memoryContext, budget.memory);
      sections.push(`## Conversation History (Summary)\n\n${compressed}\n`);
      tokensUsed += budget.memory;
      compressionApplied = true;
    }
  }

  // 2. Retrieved chunks (with skill-aware prioritization)
  if (retrievedChunks.length > 0) {
    const chunksSection = buildChunksSection(
      retrievedChunks,
      budget.chunks,
      skill,
      languageCode
    );
    
    sections.push(chunksSection.text);
    tokensUsed += chunksSection.tokensUsed;
    chunksIncluded = chunksSection.chunksIncluded;
    
    if (chunksSection.compressed) {
      compressionApplied = true;
    }
  }

  // 3. Domain-specific context (if skill provided)
  if (skill) {
    const skillContext = getDomainContext(skill, languageCode);
    if (skillContext) {
      sections.push(skillContext);
      tokensUsed += estimateTokens(skillContext);
    }
  }

  // 4. Query (always include)
  sections.push(`## User Query\n\n${query}\n`);
  tokensUsed += estimateTokens(query);

  const finalContext = sections.join('\n---\n\n');

  return {
    finalContext,
    tokensUsed,
    chunksIncluded,
    compressionApplied,
  };
}

/**
 * Calculate token budget for different sections
 */
function calculateTokenBudget(maxTokens: number, answerType: string): {
  memory: number;
  chunks: number;
  total: number;
} {
  // Reserve tokens for answer generation
  const reservedForAnswer = 4000;
  const availableForContext = maxTokens - reservedForAnswer;

  // Allocate based on answer type
  let memoryRatio = 0.2;
  let chunksRatio = 0.8;

  if (answerType === 'MEMORY') {
    memoryRatio = 0.6;
    chunksRatio = 0.4;
  } else if (answerType === 'COMPLEX_ANALYSIS') {
    memoryRatio = 0.15;
    chunksRatio = 0.85;
  }

  return {
    memory: Math.floor(availableForContext * memoryRatio),
    chunks: Math.floor(availableForContext * chunksRatio),
    total: availableForContext,
  };
}

/**
 * Build chunks section with token budget
 */
function buildChunksSection(
  chunks: RetrievalChunk[],
  maxTokens: number,
  skill: string | undefined,
  languageCode: string
): {
  text: string;
  tokensUsed: number;
  chunksIncluded: number;
  compressed: boolean;
} {
  const chunkTexts: string[] = [];
  let tokensUsed = 0;
  let chunksIncluded = 0;
  let compressed = false;

  // Sort chunks by relevance (score) and skill-specific boosting
  const sortedChunks = sortChunksByRelevance(chunks, skill);

  for (const chunk of sortedChunks) {
    const chunkText = formatChunk(chunk, languageCode);
    const chunkTokens = estimateTokens(chunkText);

    // Check if we have budget
    if (tokensUsed + chunkTokens <= maxTokens) {
      chunkTexts.push(chunkText);
      tokensUsed += chunkTokens;
      chunksIncluded++;
    } else {
      // Try to compress and fit
      const compressedChunk = compressChunk(chunk, maxTokens - tokensUsed);
      if (compressedChunk) {
        chunkTexts.push(compressedChunk);
        tokensUsed += estimateTokens(compressedChunk);
        chunksIncluded++;
        compressed = true;
      }
      break; // No more budget
    }
  }

  const header = languageCode === 'pt' 
    ? `## Documentos Relevantes (${chunksIncluded} trechos)`
    : languageCode === 'es'
    ? `## Documentos Relevantes (${chunksIncluded} fragmentos)`
    : `## Relevant Documents (${chunksIncluded} chunks)`;

  const text = `${header}\n\n${chunkTexts.join('\n\n')}`;

  return {
    text,
    tokensUsed,
    chunksIncluded,
    compressed,
  };
}

/**
 * Sort chunks by relevance with skill-aware boosting
 */
function sortChunksByRelevance(
  chunks: RetrievalChunk[],
  skill: string | undefined
): RetrievalChunk[] {
  return chunks.sort((a, b) => {
    let scoreA = a.score;
    let scoreB = b.score;

    // Boost chunks with tables for financial analysis
    if (skill === 'financial_analysis') {
      if (a.metadata.chunkType === 'table') scoreA *= 1.3;
      if (b.metadata.chunkType === 'table') scoreB *= 1.3;
    }

    // Boost chunks with headings for all skills
    if (a.metadata.chunkType === 'heading') scoreA *= 1.2;
    if (b.metadata.chunkType === 'heading') scoreB *= 1.2;

    return scoreB - scoreA;
  });
}

/**
 * Format chunk for context
 */
function formatChunk(chunk: RetrievalChunk, languageCode: string): string {
  const docLabel = languageCode === 'pt' ? 'Documento' : languageCode === 'es' ? 'Documento' : 'Document';
  const pageLabel = languageCode === 'pt' ? 'Página' : languageCode === 'es' ? 'Página' : 'Page';

  let header = `**${docLabel}: ${chunk.documentName}**`;
  if (chunk.metadata.pageNumber) {
    header += ` (${pageLabel} ${chunk.metadata.pageNumber})`;
  }

  return `${header}\n\n${chunk.content}`;
}

/**
 * Compress memory context
 */
function compressMemory(memory: string, maxTokens: number): string {
  // Simple compression: take first and last parts
  const lines = memory.split('\n');
  const targetLines = Math.floor(maxTokens / 20); // Rough estimate

  if (lines.length <= targetLines) {
    return memory;
  }

  const keepFirst = Math.floor(targetLines / 2);
  const keepLast = targetLines - keepFirst;

  const compressed = [
    ...lines.slice(0, keepFirst),
    '...',
    ...lines.slice(-keepLast),
  ].join('\n');

  return compressed;
}

/**
 * Compress chunk to fit budget
 */
function compressChunk(chunk: RetrievalChunk, maxTokens: number): string | null {
  if (maxTokens < 50) return null; // Too small

  const content = chunk.content;
  const targetLength = maxTokens * 4; // Rough char-to-token ratio

  if (content.length <= targetLength) {
    return formatChunk(chunk, 'en');
  }

  // Take first part + ellipsis
  const compressed = content.substring(0, targetLength) + '...';
  
  return `**Document: ${chunk.documentName}**\n\n${compressed}`;
}

/**
 * Get domain-specific context hints
 */
function getDomainContext(skill: string, languageCode: string): string | null {
  const contexts: Record<string, Record<string, string>> = {
    financial_analysis: {
      en: `## Domain Context: Financial Analysis\n\nFocus on: ROI, NPV, IRR, payback period, cash flow, revenue, costs, profitability metrics.`,
      pt: `## Contexto do Domínio: Análise Financeira\n\nFoco em: ROI, VPL, TIR, payback, fluxo de caixa, receita, custos, métricas de lucratividade.`,
      es: `## Contexto del Dominio: Análisis Financiero\n\nEnfoque en: ROI, VAN, TIR, payback, flujo de caja, ingresos, costos, métricas de rentabilidad.`,
    },
    legal: {
      en: `## Domain Context: Legal\n\nFocus on: contracts, clauses, obligations, liabilities, compliance, regulations.`,
      pt: `## Contexto do Domínio: Jurídico\n\nFoco em: contratos, cláusulas, obrigações, responsabilidades, conformidade, regulamentações.`,
      es: `## Contexto del Dominio: Legal\n\nEnfoque en: contratos, cláusulas, obligaciones, responsabilidades, cumplimiento, regulaciones.`,
    },
    medical: {
      en: `## Domain Context: Medical\n\nFocus on: diagnoses, lab results, reference ranges, medications, treatments.`,
      pt: `## Contexto do Domínio: Médico\n\nFoco em: diagnósticos, resultados de exames, valores de referência, medicamentos, tratamentos.`,
      es: `## Contexto del Dominio: Médico\n\nEnfoque en: diagnósticos, resultados de laboratorio, rangos de referencia, medicamentos, tratamientos.`,
    },
  };

  return contexts[skill]?.[languageCode] || null;
}

/**
 * Estimate tokens (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
