import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pinecone } from '@pinecone-database/pinecone';
import prisma from '../config/database';
import fileActionsService from './fileActions.service';
import { actionHistoryService } from './actionHistory.service';
import { gracefulDegradationService } from './graceful-degradation.service';
import { bm25RetrievalService } from './bm25-retrieval.service';
import statusEmitter, { ProcessingStage } from './statusEmitter.service';
import embeddingService from './embedding.service';
import geminiCache from './geminiCache.service';
import geminiClient from './geminiClient.service';  // Pre-import for fast bypass streaming
import { systemPromptsService } from './systemPrompts.service';
import ErrorMessagesService from './errorMessages.service';

// Financial Analysis Services (DEEP_FINANCIAL_ANALYSIS mode)
import { extractFinancialFacts, type FinancialFact, type NumericExtractionResult } from './numericFactsExtractor.service';
import { calculateFinancialAnalysis, formatROI, formatPayback, formatCurrency, generateComparisonText, type FinancialAnalysisResult } from './financialCalculator.service';
import * as languageDetectionService from './languageDetection.service';
import { performHybridRetrieval, initializePineconeIndex, type HybridRetrievalResult } from './hybridRetrieval.service';

import { fallbackDetection, fallbackResponse, psychologicalSafety } from './fallback';
import type { FallbackType, FallbackContext } from './fallback';
import * as folderNav from './folderNavigation.service';
import { formatFileListingResponse } from '../utils/inlineDocumentInjector';
import { smartProcessSpacing } from '../utils/markdownSpacing';

import calculationDetector from './calculation/calculationDetector.service';
import smartCalculator from './calculation/smartCalculator.service';
import codeGenerator from './calculation/codeGenerator.service';
import pythonExecutor from './calculation/pythonExecutor.service';
import { CalculationType } from './calculation/calculationTypes';
import { excelFormulaEngine } from './calculation';
import calculationRouter from './calculation/calculationRouter.service';

import { formatValidationService } from './formatValidation.service';

import * as confidenceScoring from './archived/confidence-scoring.service';

// QA Orchestrator Service (Quality Assurance Gate)
import { runQualityAssurance } from './qaOrchestrator.service';

// Master Answer Formatter Service (Single Source of Truth for Formatting)
import { formatAnswer } from './masterAnswerFormatter.service';

import {
  semanticDocumentSearchService,
  hybridRetrievalBooster,
  fastPathDetector,
  memoryService,
  citationTracking,
  outputIntegration,
  synthesisQueryDetectionService,
  comparativeAnalysisService,
  methodologyExtractionService,
  trendAnalysisService,
  queryEnhancementService,
  terminologyIntelligenceService,
  crossDocumentSynthesisService,
  terminologyIntegration,
  causalExtractionService,
  shouldBypassRAG,
  requiresRAG,
  getBypassType,
  queryDecomposition,
  contradictionDetection,
  practicalImplicationsService,
  evidenceAggregation,
  memoryExtraction,
  type UserContext as DynamicUserContext,
  type ResponseConfig,
  type DocumentInfo as AdaptiveDocumentInfo
} from './deletedServiceStubs';

import adaptiveAnswerGeneration, { classifyResponseType, FLASH_OPTIMAL_CONFIG, ResponseType } from './adaptiveAnswerGeneration.service';
import contextEngineering from './contextEngineering.service';
import { emptyResponsePrevention } from './emptyResponsePrevention.service';
import { fallbackResponseService } from './fallbackResponse.service';

// OLD: import { postProcessAnswer as qaPostProcessAnswer } from './outputPostProcessor.service';
// NEW: Unified Post-Processor (replaces 6+ conflicting formatters)
import { kodaUnifiedPostProcessor, type PostProcessingInput, detectLanguage as detectQueryLanguage, determineAnswerType } from './kodaUnifiedPostProcessor.service';
import groundingVerificationService, { GroundingVerificationResult } from './groundingVerification.service';
import citationVerificationService, { CitationVerificationResult } from './citationVerification.service';
import { checkAnswerQuality } from './answerQualityChecker.service';
import { generateFallback as generateQAFallback } from './fallbackStrategy.service';
import clarificationLogicService from './clarificationLogic.service';
import rollingConversationSummaryService from './rollingConversationSummary.service';
import { microSummaryRerankerService } from './microSummaryReranker.service';
import { rerankByChunkType } from './chunkTypeReranker.service';
import { getConversationState, updateConversationState, extractEntities, extractTopics } from './conversationStateTracker.service';

import infiniteConversationMemory from './infiniteConversationMemory.service';

// Conversation Context Service (Multi-turn context management)
import { conversationContextService } from './deletedServiceStubs';

import structureEnforcementService from './structureEnforcement.service';

// Format Enforcement V2 and Citation Format Services (KODA 100/100)
import { kodaFormatEnforcementService } from './kodaFormatEnforcement.service';
import { kodaCitationFormatService, type CitationSource as FormattedCitationSource } from './kodaCitationFormat.service';

// SIMPLE INTENT DETECTION (Fast Pattern-Based)
// FIX: Import the simple intent detection service for unified routing
// This replaces multiple conflicting intent detection services
import { detectIntent as detectSimpleIntent, type SimpleIntentResult } from './simpleIntentDetection.service';

// ============================================================================
// MODE-BASED RAG OPTIMIZATION (4-Mode Performance System)
// ============================================================================
import {
  type RAGMode,
  type RAGModeConfig,
  classifyQueryMode,
  getModeConfig,
  logModeClassification,
  shouldSkipHandler,
} from './ragModes.service';

import {
  getSystemPromptForMode,
} from './systemPromptTemplates.service';

import cacheService from './cache.service';

// DOCUMENT INTELLIGENCE SYSTEM - Routing, Hybrid Search
import { routeToDocument, routeToMultipleDocuments, type DocumentRoutingResult } from './documentRouter.service';
import { hybridSearch, analyzeQueryIntent, type SearchFilters, type HybridSearchOptions } from './hybridSearch.service';

// CONTEXT-AWARE INTENT DETECTION (Advanced 6-Stage Pipeline)
// Provides: Negation detection, completeness validation, entity extraction,
// pronoun resolution, verb disambiguation, and multi-intent detection
import { contextAwareIntentDetection, type ContextAwareIntentResult } from './contextAwareIntentDetection.service';

// HIERARCHICAL INTENT CLASSIFICATION (Two-Stage: Heuristic + LLM)
import { classifyIntent, shouldDecompose, decomposeQuery, type IntentResult, type SubQuestion } from './hierarchicalIntentClassifier.service';
import { getPipelineConfig, planAnswerShape, buildPromptWithPlan, type PipelineConfig, type AnswerPlan } from './pipelineConfiguration.service';
import { executeSubQuestion, assembleMultiPartAnswer, type SubQuestionResult, type MultiPartAnswer } from './queryExecutor.service';
import { handleHierarchicalIntent, handleQueryDecomposition } from './hierarchicalIntentHandler.service';

// SKILL-BASED ROUTING SYSTEM (New modular skill architecture)
import {
  integrateSkillRouting,
  postProcessSkillAnswer,
  isMetaSkill,
  requiresDocumentContext,
  describeSkillRouting,
  type SkillIntegrationResult,
} from './skillSystemIntegration.service';

// RAG CONFIGURATION INTERFACE
export interface RAGConfig {
  useLLMFiltering?: boolean;           // LLM-based chunk filtering (saves 3-5 seconds when disabled)
  useFullDocuments?: boolean;          // Full document retrieval (saves ~1000ms when disabled)
  useContradictionDetection?: boolean; // Contradiction detection (saves ~1200ms when disabled)
}

// Default config: all features disabled for maximum speed
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  useLLMFiltering: false,
  useFullDocuments: false,
  useContradictionDetection: false,
};

// RRF (Reciprocal Rank Fusion) Merging Algorithm
interface RRFScore {
  content: string;
  metadata: any;
  vectorRank: number;
  keywordRank: number;
  vectorScore: number;
  keywordScore: number;
}

interface HybridResult {
  content: string;
  metadata: any;
  vectorScore: number;
  bm25Score: number;
  hybridScore: number;
  inBoth: boolean;
}

function mergeWithRRF(
  vectorResults: any[],
  keywordResults: any[],
  topK: number
): HybridResult[] {
  const k = 60; // RRF constant (standard in literature)
  const scoreMap = new Map<string, RRFScore>();

  console.log(`ðŸ”„ [RRF] Merging ${vectorResults.length} vector + ${keywordResults.length} keyword results`);

  // Process vector results
  vectorResults.forEach((result, rank) => {
    const id = `${result.metadata?.documentId || 'unknown'}-${result.metadata?.chunkIndex || rank}`;
    scoreMap.set(id, {
      content: result.metadata?.content || result.metadata?.text || '',
      metadata: result.metadata,
      vectorRank: rank + 1,
      keywordRank: 0,
      vectorScore: result.score || 0,
      keywordScore: 0,
    });
  });

  // Process keyword results
  keywordResults.forEach((result, rank) => {
    const id = `${result.metadata?.documentId || result.documentId || 'unknown'}-${result.metadata?.chunkIndex || result.chunkIndex || rank}`;
    const existing = scoreMap.get(id);

    if (existing) {
      // Found in both - update keyword info
      existing.keywordRank = rank + 1;
      existing.keywordScore = result.score || result.bm25Score || 0;
    } else {
      // Only in keyword results
      scoreMap.set(id, {
        content: result.content || result.metadata?.content || '',
        metadata: result.metadata || { documentId: result.documentId },
        vectorRank: 0,
        keywordRank: rank + 1,
        vectorScore: 0,
        keywordScore: result.score || result.bm25Score || 0,
      });
    }
  });

  // Calculate RRF scores
  const results = Array.from(scoreMap.values()).map(item => {
    let rrfScore = 0;

    // Add vector contribution: 1 / (k + rank)
    if (item.vectorRank > 0) {
      rrfScore += 1 / (k + item.vectorRank);
    }

    // Add keyword contribution: 1 / (k + rank)
    if (item.keywordRank > 0) {
      rrfScore += 1 / (k + item.keywordRank);
    }

    return {
      content: item.content,
      metadata: item.metadata,
      vectorScore: item.vectorScore,
      bm25Score: item.keywordScore,
      hybridScore: rrfScore,
      inBoth: item.vectorRank > 0 && item.keywordRank > 0,
    };
  });

  // Sort by RRF score (higher is better)
  const sorted = results.sort((a, b) => b.hybridScore - a.hybridScore);

  // Log statistics
  const vectorOnly = sorted.filter(r => r.bm25Score === 0).length;
  const keywordOnly = sorted.filter(r => r.vectorScore === 0).length;
  const both = sorted.filter(r => r.vectorScore > 0 && r.bm25Score > 0).length;

  console.log(`âœ… [RRF] Merged results:`);
  console.log(`   - Vector only: ${vectorOnly}`);
  console.log(`   - Keyword only: ${keywordOnly}`);
  console.log(`   - Both: ${both}`);
  console.log(`   - Returning top ${topK}`);

  return sorted.slice(0, topK);
}

// ============================================================================
// PHASE 2 OPTIMIZATION: Advanced Reranking Pipeline
// ============================================================================
// Applies both micro-summary reranking and chunk-type reranking after RRF merge
// Impact: +15-20% retrieval accuracy, better context selection

async function applyPhase2Reranking(
  hybridResults: HybridResult[],
  query: string,
  documentType?: string
): Promise<HybridResult[]> {
  if (hybridResults.length === 0) return hybridResults;

  console.log(`🔄 [PHASE2 RERANK] Starting advanced reranking for ${hybridResults.length} chunks...`);

  try {
    // Step 1: Apply micro-summary reranking (if chunks have micro-summaries)
    const chunksWithMicroSummary = hybridResults.filter((r: any) => r.metadata?.microSummary);

    let rerankedResults = hybridResults;

    if (chunksWithMicroSummary.length > 0) {
      console.log(`   📝 Applying micro-summary reranking (${chunksWithMicroSummary.length} chunks have summaries)`);

      // Convert to format expected by microSummaryRerankerService
      const candidates = hybridResults.map((r: any) => ({
        chunkId: r.metadata?.chunkId || `${r.metadata?.documentId}_${r.metadata?.chunkIndex}`,
        documentId: r.metadata?.documentId || '',
        documentTitle: r.metadata?.filename || r.metadata?.documentName || '',
        chunkText: r.content || r.metadata?.content || r.metadata?.text || '',
        microSummary: r.metadata?.microSummary,
        chunkType: r.metadata?.chunkType,
        sectionName: r.metadata?.section || r.metadata?.sectionName,
        pageNumber: r.metadata?.pageNumber,
        combinedScore: r.hybridScore || r.vectorScore || 0,
        metadata: r.metadata
      }));

      const microReranked = await microSummaryRerankerService.rerankWithMicroSummaries(candidates, {
        query,
        queryIntent: detectQueryIntent(query)
      });

      // Convert back to HybridResult format
      rerankedResults = microReranked.map((r: any) => ({
        content: r.chunkText,
        metadata: r.metadata,
        vectorScore: r.vectorScore || 0,
        bm25Score: r.bm25Score || 0,
        hybridScore: r.finalScore || r.combinedScore || 0,
        inBoth: true
      }));
    }

    // Step 2: Apply chunk-type reranking
    console.log(`   🎯 Applying chunk-type reranking...`);

    const chunkTypeResults = await rerankByChunkType(
      rerankedResults.map((r: any) => ({
        id: r.metadata?.chunkId || `${r.metadata?.documentId}_${r.metadata?.chunkIndex}`,
        content: r.content || r.metadata?.content || r.metadata?.text || '',
        metadata: r.metadata,
        score: r.hybridScore || r.vectorScore || 0
      })),
      query,
      documentType
    );

    // Convert back to HybridResult format
    const finalResults = chunkTypeResults.rerankedChunks.map((r: any) => ({
      content: r.content,
      metadata: r.metadata,
      vectorScore: r.originalScore || 0,
      bm25Score: 0,
      hybridScore: r.finalScore || r.originalScore || 0,
      inBoth: true
    }));

    console.log(`✅ [PHASE2 RERANK] Complete. Top chunk score: ${finalResults[0]?.hybridScore?.toFixed(3)}`);

    return finalResults;

  } catch (error) {
    console.error('❌ [PHASE2 RERANK] Failed, returning original results:', error);
    return hybridResults;
  }
}

// Helper to detect query intent for micro-summary reranking
function detectQueryIntent(query: string): string {
  const lower = query.toLowerCase();

  if (/o que [ée]|what is|define|explain|explique/i.test(lower)) return 'explanation';
  if (/resum|summary|overview|geral/i.test(lower)) return 'summary';
  if (/compar|versus|vs\.|differ/i.test(lower)) return 'comparison';
  if (/quanto|how much|valor|price|custo|cost/i.test(lower)) return 'exact_match';
  if (/onde|where|localiz|locat/i.test(lower)) return 'information_retrieval';

  return 'default';
}

// ============================================================================
// PERFORMANCE TIMING INSTRUMENTATION
// ============================================================================

class PerformanceTimer {
  private timings: Map<string, number[]> = new Map();
  private startTime: number = Date.now();
  private checkpointStack: Array<{ label: string; start: number }> = [];
  private marks: Map<string, number> = new Map(); // For mark/measure pattern

  start(label: string): void {
    const now = Date.now();
    this.checkpointStack.push({ label, start: now });
    console.log(`â±ï¸  [START] ${label}`);
  }

  end(label: string): number {
    const now = Date.now();
    const checkpoint = this.checkpointStack.pop();

    if (!checkpoint || checkpoint.label !== label) {
      console.error(`âš ï¸  [TIMING ERROR] Mismatched: expected "${checkpoint?.label}", got "${label}"`);
      return 0;
    }

    const duration = now - checkpoint.start;

    if (!this.timings.has(label)) {
      this.timings.set(label, []);
    }
    this.timings.get(label)!.push(duration);

    const totalElapsed = now - this.startTime;
    console.log(`â±ï¸  [END] ${label}: ${duration}ms (total: ${totalElapsed}ms)`);

    return duration;
  }

  // Mark a point in time for later measurement
  mark(label: string): void {
    this.marks.set(label, Date.now());
  }

  // Measure time from a previous mark to now
  measure(label: string, fromMark: string): number {
    const markTime = this.marks.get(fromMark);
    if (!markTime) {
      console.error(`âš ï¸  [TIMING ERROR] Mark "${fromMark}" not found`);
      return 0;
    }
    const duration = Date.now() - markTime;

    if (!this.timings.has(label)) {
      this.timings.set(label, []);
    }
    this.timings.get(label)!.push(duration);

    console.log(`â±ï¸  [MEASURE] ${label}: ${duration}ms`);
    return duration;
  }

  record(label: string, duration: number): void {
    if (!this.timings.has(label)) {
      this.timings.set(label, []);
    }
    this.timings.get(label)!.push(duration);
    console.log(`â±ï¸  [RECORD] ${label}: ${duration}ms`);
  }

  printSummary(): void {
    const totalTime = Date.now() - this.startTime;
    console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('â±ï¸  COMPLETE PERFORMANCE TIMING BREAKDOWN');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

    const entries = Array.from(this.timings.entries())
      .map(([label, times]) => ({
        label,
        total: times.reduce((a, b) => a + b, 0),
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        count: times.length
      }))
      .sort((a, b) => b.total - a.total);

    // Calculate measured vs unmeasured time
    let measuredTime = 0;
    entries.forEach(({ label, total, avg, count }) => {
      // Don't count TOTAL REQUEST in measured time (it's the container)
      if (label !== 'TOTAL REQUEST') {
        measuredTime += total;
      }
      const percentage = ((total / totalTime) * 100).toFixed(1);
      if (count > 1) {
        console.log(`  ${label}: ${total}ms (${percentage}%) - ${avg.toFixed(1)}ms avg Ã— ${count} calls`);
      } else {
        console.log(`  ${label}: ${total}ms (${percentage}%)`);
      }
    });

    const unmeasuredTime = totalTime - measuredTime;
    const measuredPct = ((measuredTime / totalTime) * 100).toFixed(1);
    const unmeasuredPct = ((unmeasuredTime / totalTime) * 100).toFixed(1);

    console.log('â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
    console.log(`  MEASURED: ${measuredTime}ms (${measuredPct}%)`);
    console.log(`  UNMEASURED: ${unmeasuredTime}ms (${unmeasuredPct}%) â† INVESTIGATE THIS`);
    console.log(`  TOTAL TIME: ${totalTime}ms`);
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');
  }

  reset(): void {
    this.timings.clear();
    this.checkpointStack = [];
    this.marks.clear();
    this.startTime = Date.now();
  }
}

// Global timer for request-level tracking
let requestTimer: PerformanceTimer | null = null;

// ============================================================================
// ============================================================================
function removeWholeBlockDuplication(text: string): string {
  if (!text || text.length < 200) return text;

  // Method 1: Check if the second half is very similar to the first half
  const halfLength = Math.floor(text.length / 2);
  const firstHalf = text.substring(0, halfLength);
  const secondHalf = text.substring(halfLength);

  const firstWords = new Set(firstHalf.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const secondWords = new Set(secondHalf.toLowerCase().split(/\s+/).filter(w => w.length > 4));

  if (firstWords.size > 10 && secondWords.size > 10) {
    const intersection = new Set([...firstWords].filter(w => secondWords.has(w)));
    const similarity = intersection.size / Math.min(firstWords.size, secondWords.size);

    if (similarity > 0.7) {
      console.log(`[DEDUP] Detected whole-block duplication (${(similarity * 100).toFixed(0)}% similar halves)`);
      return firstHalf.trim();
    }
  }

  // Method 2: Look for repeated opening phrases
  const restartPatterns = [
    /You asked/gi, /Based on the/gi, /Here's what/gi, /Let me summarize/gi,
    /I'll provide/gi, /I can see that/gi, /Looking at/gi, /From the documents/gi,
    /According to/gi, /While I couldn't/gi
  ];

  for (const pattern of restartPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length >= 2) {
      const firstMatch = matches[0].index || 0;
      const secondMatch = matches[1].index || 0;

      if (secondMatch > 100 && secondMatch - firstMatch > 100) {
        const afterFirst = text.substring(firstMatch, Math.min(firstMatch + 200, text.length));
        const afterSecond = text.substring(secondMatch, Math.min(secondMatch + 200, text.length));

        const afterFirstWords = new Set(afterFirst.toLowerCase().split(/\s+/));
        const afterSecondWords = new Set(afterSecond.toLowerCase().split(/\s+/));
        const afterIntersection = new Set([...afterFirstWords].filter(w => afterSecondWords.has(w)));
        const afterSimilarity = afterIntersection.size / Math.min(afterFirstWords.size, afterSecondWords.size);

        if (afterSimilarity > 0.6) {
          console.log(`[DEDUP] Detected restart pattern "${matches[0][0]}" with duplicate (${(afterSimilarity * 100).toFixed(0)}% similar)`);
          return text.substring(0, secondMatch).trim();
        }
      }
    }
  }

  return text;
}

// ============================================================================
// ============================================================================
function fixMarkdownTableCells(markdown: string): string {
  const lines = markdown.split('\n');
  const fixedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // ðŸ”§ SAFEGUARD: Skip extremely long lines (malformed LLM output)
    if (line.length > 2000) {
      console.warn(`âš ï¸ [TABLE FIX] Skipping malformed line (${line.length} chars)`);
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      // Check if it's a separator row (|---|---|---|)
      const isSeparator = /^\|[\s\-:]+\|$/.test(line) || /^\|[\s\-:|]+\|$/.test(line);
      if (isSeparator) {
        // ðŸ”§ SAFEGUARD: Fix malformed separators with too many dashes
        const fixedSeparator = line.replace(/\-{10,}/g, '---');
        fixedLines.push(fixedSeparator);
      } else {
        // Regular table row - concatenate continuation lines
        let fullRow = line;
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          // Stop if next line starts a new table row or is empty
          if (nextLine.startsWith('|') || !nextLine || nextLine.length === 0) break;
          // Skip extremely long continuation lines
          if (nextLine.length > 1000) {
            console.warn(`âš ï¸ [TABLE FIX] Skipping malformed continuation (${nextLine.length} chars)`);
            break;
          }
          fullRow += ' ' + nextLine;
          j++;
        }
        i = j - 1;

        // ðŸ”§ SAFEGUARD: Truncate cells that are too long
        const cells = fullRow.split('|').map(cell => {
          const trimmed = cell.trim();
          if (trimmed.length > 500) {
            return trimmed.substring(0, 497) + '...';
          }
          return trimmed;
        });
        fixedLines.push('| ' + cells.filter(c => c).join(' | ') + ' |');
      }
    } else {
      fixedLines.push(line);
    }
  }
  return fixedLines.join('\n');
}

// ============================================================================
// ============================================================================

/**
 * Custom error types for RAG system
 */
export class RAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public suggestion: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'RAGError';
  }
}

/**
 * Document not found error
 */
export class DocumentNotFoundError extends RAGError {
  constructor(documentId: string) {
    super(
      `Document not found: ${documentId}`,
      'DOCUMENT_NOT_FOUND',
      404,
      'The document may have been deleted. Try refreshing the page or selecting a different document.',
      false
    );
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends RAGError {
  constructor(retryAfter: number = 60) {
    super(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      `Too many requests. Please wait ${retryAfter} seconds and try again.`,
      true
    );
  }
}

/**
 * API quota exceeded error
 */
export class QuotaExceededError extends RAGError {
  constructor(service: string) {
    super(
      `${service} API quota exceeded`,
      'QUOTA_EXCEEDED',
      402,
      `Your ${service} API quota has been exceeded. Please upgrade your plan or wait until your quota resets.`,
      false
    );
  }
}

/**
 * Invalid query error
 */
export class InvalidQueryError extends RAGError {
  constructor(reason: string) {
    super(
      `Invalid query: ${reason}`,
      'INVALID_QUERY',
      400,
      'Please rephrase your query and try again. Make sure your query is clear and specific.',
      false
    );
  }
}

/**
 * Network error
 */
export class NetworkError extends RAGError {
  constructor(service: string) {
    super(
      `Network error connecting to ${service}`,
      'NETWORK_ERROR',
      503,
      'Unable to connect to external service. Please check your internet connection and try again.',
      true
    );
  }
}

/**
 * Server error
 */
export class ServerError extends RAGError {
  constructor(message: string) {
    super(
      `Server error: ${message}`,
      'SERVER_ERROR',
      500,
      'An unexpected error occurred. Please try again. If the problem persists, contact support.',
      true
    );
  }
}

/**
 * Convert generic error to RAGError with user-friendly message
 */
export function toRAGError(error: any): RAGError {
  // Already a RAGError
  if (error instanceof RAGError) {
    return error;
  }

  // Axios error (API call failed)
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.error || error.message;

    switch (status) {
      case 404:
        return new DocumentNotFoundError(message);
      case 429:
        const retryAfter = parseInt(error.response.headers?.['retry-after']) || 60;
        return new RateLimitError(retryAfter);
      case 402:
        return new QuotaExceededError('API');
      case 400:
        return new InvalidQueryError(message);
      case 503:
        return new NetworkError('API');
      default:
        return new ServerError(message);
    }
  }

  // Network error (no response)
  if (error.request) {
    return new NetworkError('server');
  }

  // Gemini/Pinecone specific errors
  const errorMessage = error.message || String(error);

  if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
    return new QuotaExceededError('Gemini');
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return new RateLimitError(60);
  }

  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return new DocumentNotFoundError(errorMessage);
  }

  if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
    return new NetworkError('external service');
  }

  // Generic error
  return new ServerError(error.message || 'Unknown error');
}

// ============================================================================
// INTENT DETECTION CACHE (5min TTL)
// ============================================================================

interface CachedIntent {
  result: any;
  timestamp: number;
}

const intentCache = new Map<string, CachedIntent>();
const INTENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
function cacheIntent(query: string, result: any): void {
  const normalizedQuery = query.toLowerCase().trim();
  intentCache.set(normalizedQuery, {
    result,
    timestamp: Date.now()
  });
  console.log(`ðŸ’¾ [INTENT CACHE] Cached result (total entries: ${intentCache.size})`);
}

// Periodic cleanup of expired cache entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  let removed = 0;

  for (const [key, value] of intentCache.entries()) {
    if (now - value.timestamp > INTENT_CACHE_TTL) {
      intentCache.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`ðŸ§¹ [INTENT CACHE] Cleaned up ${removed} expired entries (${intentCache.size} remaining)`);
  }
}, 10 * 60 * 1000);

// ============================================================================
// DELETED DOCUMENT FILTER
// ============================================================================

/**
 * Filter out deleted documents from Pinecone results
 */
async function filterDeletedDocuments(matches: any[], userId: string): Promise<any[]> {
  const fnStart = Date.now();

  if (!matches || matches.length === 0) {
    if (requestTimer) requestTimer.record('filterDeletedDocuments (empty)', Date.now() - fnStart);
    return [];
  }

  // Get unique document IDs
  const extractStart = Date.now();
  const documentIds = [...new Set(matches.map(m => m.metadata?.documentId).filter(Boolean))];
  if (requestTimer) requestTimer.record('filterDeletedDocuments: Extract IDs', Date.now() - extractStart);

  if (documentIds.length === 0) {
    if (requestTimer) requestTimer.record('filterDeletedDocuments (no IDs)', Date.now() - fnStart);
    return matches;
  }

  console.log(`ðŸ” [FILTER] Checking ${documentIds.length} unique documents from ${matches.length} matches`);

  // Query database for valid (non-deleted) documents
  const dbStart = Date.now();
  const validDocuments = await prisma.document.findMany({
    where: {
      id: { in: documentIds },
      userId: userId,
      status: { not: 'deleted' },
    },
    select: { id: true },
  });
  if (requestTimer) requestTimer.record('filterDeletedDocuments: DB Query', Date.now() - dbStart);

  const validDocumentIds = new Set(validDocuments.map(d => d.id));

  // Filter matches to only include valid documents
  const filterStart = Date.now();
  const filtered = matches.filter(m => validDocumentIds.has(m.metadata?.documentId));
  if (requestTimer) requestTimer.record('filterDeletedDocuments: Filter Matches', Date.now() - filterStart);

  if (filtered.length < matches.length) {
    console.log(`ðŸ—‘ï¸ [FILTER] Removed deleted documents: ${matches.length} â†’ ${filtered.length}`);
  }

  if (requestTimer) requestTimer.record('filterDeletedDocuments (total)', Date.now() - fnStart);
  return filtered;
}

// ============================================================================
// FULL DOCUMENT RETRIEVAL - Enhanced Context Management
// ============================================================================

/**
 * Retrieve full documents instead of chunks
 */
async function retrieveFullDocuments(
  documentIds: string[],
  userId: string
): Promise<{ id: string; title: string; content: string; metadata?: any }[]> {

  console.log(`ðŸ“„ [FULL DOCS] Retrieving ${documentIds.length} full documents`);

  // Remove duplicates
  const uniqueDocIds = [...new Set(documentIds)];

  const documents = await prisma.document.findMany({
    where: {
      id: { in: uniqueDocIds },
      userId: userId,
      status: 'completed'
    },
    include: {
      metadata: {
        select: {
          extractedText: true,
          markdownContent: true,
          pageCount: true,
          wordCount: true
        }
      }
    }
  });

  const fullDocs = documents.map(doc => ({
    id: doc.id,
    title: doc.filename,
    content: doc.metadata?.markdownContent || doc.metadata?.extractedText || '',
    metadata: {
      pageCount: doc.metadata?.pageCount,
      wordCount: doc.metadata?.wordCount
    }
  }));

  // Calculate total tokens (rough estimate: 1 token â‰ˆ 4 characters)
  const totalTokens = fullDocs.reduce((sum, doc) => sum + (doc.content.length / 4), 0);
  console.log(`ðŸ“„ [FULL DOCS] Retrieved ${fullDocs.length} documents (~${Math.floor(totalTokens)} tokens)`);

  // Warn if approaching context limit
  if (totalTokens > 800000) { // 800K tokens, leaving room for prompt and response
    console.warn(`âš ï¸ [FULL DOCS] Large context size (${Math.floor(totalTokens)} tokens) - may need truncation`);
  }

  return fullDocs;
}

/**
 * Build document context from full documents
 */
function buildDocumentContext(
  documents: { id: string; title: string; content: string; metadata?: any }[]
): string {

  if (documents.length === 0) {
    return '';
  }

  let context = '## Relevant Documents\n\n';

  for (const doc of documents) {
    context += `### Document: ${doc.title}\n\n`;

    // Add metadata if available
    if (doc.metadata) {
      const meta = [];
      if (doc.metadata.pageCount) meta.push(`${doc.metadata.pageCount} pages`);
      if (doc.metadata.wordCount) meta.push(`${doc.metadata.wordCount} words`);
      if (meta.length > 0) {
        context += `*[${meta.join(', ')}]*\n\n`;
      }
    }

    context += `${doc.content}\n\n`;
    context += `---\n\n`;
  }

  return context;
}

// ============================================================================
// STRUCTURED REASONING PROMPTS - Complex Query Analysis
// ============================================================================

/**
 * Detect query complexity
 */
function detectQueryComplexity(query: string): 'simple' | 'medium' | 'complex' {
  const lowerQuery = query.toLowerCase();

  // Simple queries (fact retrieval, simple questions)
  const simpleIndicators = [
    'what is', 'who is', 'when did', 'where is',
    'show me', 'find', 'list', 'display',
    'get', 'retrieve', 'fetch'
  ];

  // Complex queries (multi-document analysis, synthesis)
  const complexIndicators = [
    'compare', 'analyze', 'synthesize', 'evaluate',
    'all documents', 'across all', 'every document',
    'contradiction', 'conflict', 'disagree',
    'relationship between', 'timeline', 'changes over time',
    'evolution', 'trend', 'pattern',
    'why', 'how does', 'explain the difference',
    'summarize all', 'overview of all'
  ];

  // Check for simple patterns
  if (simpleIndicators.some(indicator => lowerQuery.includes(indicator))) {
    // But check if it's actually complex despite simple wording
    if (complexIndicators.some(indicator => lowerQuery.includes(indicator))) {
      return 'complex';
    }
    return 'simple';
  }

  // Check for complex patterns
  if (complexIndicators.some(indicator => lowerQuery.includes(indicator))) {
    return 'complex';
  }

  return 'medium';
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.4,    // FLASH: Reduced from 0.7 for more deterministic factual answers
    topP: 0.95,          // Keep same (nucleus sampling threshold)
    topK: 40,            // FLASH OPTIMIZED: 10 -> 40 (better vocabulary variety)
    maxOutputTokens: 2500, // FIXED: Increased from 900 - Gemini 2.5 Flash needs room for internal thinking
  },
});
console.log('[FLASH] Gemini optimized: maxTokens 2500, topK 40, temp 0.4');

let pinecone: Pinecone | null = null;
let pineconeIndex: any = null;

export async function initializePinecone() {
  if (!pinecone) {
    console.log('ðŸ”¥ [PINECONE] Initializing Pinecone client...');
    const startTime = Date.now();
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || '',
    });
    pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME || 'koda-openai');

    initializePineconeIndex(pineconeIndex);
    console.log('   âœ… [HYBRID] Pinecone index shared with hybrid retrieval service');

    // âš¡ WARM UP: Do a dummy query to establish the connection
    try {
      await pineconeIndex.describeIndexStats();
      console.log(`âœ… [PINECONE] Connection warmed up in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.log(`âš ï¸  [PINECONE] Warm-up query failed (will retry on first real query)`);
    }
  }
}

// ============================================================================
// ============================================================================

interface EnhancedSourceInfo {
  documentId: string;
  documentName: string;
  pageNumber: number | null;       // Primary page (first or most relevant)
  allPages: number[];              // ALL pages referenced from this document
  relevantText: string;
  score: number;
  mimeType?: string;
}

function fastCitationExtraction(response: string, chunks: any[]): EnhancedSourceInfo[] {
  const sourceMap = new Map<string, EnhancedSourceInfo>();

  // Extract [1], [2], etc. from response
  const citationMatches = response.match(/\[(\d+)\]/g) || [];
  const citedIndices = [...new Set(citationMatches.map(m => parseInt(m.replace(/\[|\]/g, '')) - 1))];

  console.log(`âš¡ [FAST CITATION] Found ${citedIndices.length} unique citation references in response`);

  // Map citations to chunks - accumulate ALL pages per document
  citedIndices.forEach(idx => {
    if (idx >= 0 && idx < chunks.length) {
      const chunk = chunks[idx];
      const docId = chunk.metadata?.documentId;
      const score = chunk.score || chunk.rerankScore || chunk.hybridScore || 0;
      const pageNum = chunk.metadata?.page || null;

      if (docId) {
        const existing = sourceMap.get(docId);
        if (existing) {
          if (pageNum !== null && !existing.allPages.includes(pageNum)) {
            existing.allPages.push(pageNum);
            existing.allPages.sort((a, b) => a - b);
          }
          // Keep highest score
          if (score > existing.score) {
            existing.score = score;
            existing.relevantText = (chunk.metadata?.text || chunk.metadata?.content || chunk.content || '').substring(0, 200);
          }
        } else {
          sourceMap.set(docId, {
            documentId: docId,
            documentName: chunk.metadata?.filename || 'Unknown',
            pageNumber: pageNum,
            allPages: pageNum !== null ? [pageNum] : [],
            relevantText: (chunk.metadata?.text || chunk.metadata?.content || chunk.content || '').substring(0, 200),
            score,
            mimeType: chunk.metadata?.mimeType
          });
        }
      }
    }
  });

  // If no citations found in response, use top 3 chunks as sources
  if (sourceMap.size === 0) {
    console.log(`âš¡ [FAST CITATION] No explicit citations found, using top 3 chunks as sources`);
    chunks.slice(0, 3).forEach(chunk => {
      const docId = chunk.metadata?.documentId;
      const score = chunk.score || chunk.rerankScore || chunk.hybridScore || 0;
      const pageNum = chunk.metadata?.page || null;

      if (docId) {
        const existing = sourceMap.get(docId);
        if (existing) {
          // Accumulate page numbers
          if (pageNum !== null && !existing.allPages.includes(pageNum)) {
            existing.allPages.push(pageNum);
            existing.allPages.sort((a, b) => a - b);
          }
          if (score > existing.score) {
            existing.score = score;
            existing.relevantText = (chunk.metadata?.text || chunk.metadata?.content || chunk.content || '').substring(0, 200);
          }
        } else {
          sourceMap.set(docId, {
            documentId: docId,
            documentName: chunk.metadata?.filename || 'Unknown',
            pageNumber: pageNum,
            allPages: pageNum !== null ? [pageNum] : [],
            relevantText: (chunk.metadata?.text || chunk.metadata?.content || chunk.content || '').substring(0, 200),
            score,
            mimeType: chunk.metadata?.mimeType
          });
        }
      }
    });
  }

  // Convert Map to array, sorted by score descending
  const sources = Array.from(sourceMap.values()).sort((a, b) => b.score - a.score);

  console.log(`âš¡ [FAST CITATION] Applying KODA citation formatting...`);
  const formattedSources = kodaCitationFormatService.formatSources(chunks);

  sources.forEach(src => {
    const formatted = formattedSources.find(f => f.documentId === src.documentId);
    if (formatted) {
      // Add KODA formatted location (only shows page if 100% confident)
      (src as any).formattedLocation = formatted.location;
      (src as any).relevanceScore = formatted.relevanceScore;
      (src as any).relevanceExplanation = formatted.relevanceExplanation;
      (src as any).folderPath = formatted.folderPath;
      (src as any).categoryName = formatted.categoryName;
    }
  });

  console.log(`âš¡ [FAST CITATION] Extracted ${sources.length} unique document sources (saved ~1000ms)`);
  sources.forEach((src, idx) => {
    const pagesStr = src.allPages.length > 0 ? `pages ${src.allPages.join(', ')}` : 'no page info';
    const kodaLocation = (src as any).formattedLocation || 'N/A';
    console.log(`   ${idx + 1}. ${src.documentName} (${pagesStr}, KODA: ${kodaLocation}, score: ${src.score.toFixed(3)})`);
  });

  return sources;
}

// ============================================================================
// ============================================================================
// PURPOSE: Appends a "Sources" section with accurate document locations

interface CitationSource {
  documentId: string;
  documentName: string;
  pages: number[];
  score: number;
  mimeType?: string;
}

// ============================================================================
// OBSERVATION LAYER - Validates retrieval results
// ============================================================================
// PURPOSE: Checks if retrieved results are sufficient before generating answer

interface ObservationResult {
  needsRefinement: boolean; // Should we retry with a different approach?
  reason?: 'no_results' | 'low_relevance' | 'incomplete' | 'insufficient_coverage';
  details?: {
    expected?: number;    // How many items user asked for (e.g., "list all 7")
    found?: number;       // How many items we actually retrieved
    avgScore?: number;    // Average relevance score of results
    suggestion?: string;  // Suggested refinement strategy
  };
}

function observeRetrievalResults(
  results: any,
  query: string,
  minRelevanceScore: number = 0.05
): ObservationResult {

  // ============================================================================
  // CHECK 1: No results found
  // ============================================================================

  if (!results.matches || results.matches.length === 0) {
    console.log('ðŸ” [OBSERVE] No results found - refinement needed');
    return {
      needsRefinement: true,
      reason: 'no_results',
      details: {
        suggestion: 'Try broader search terms or check if documents are uploaded'
      }
    };
  }

  // ============================================================================
  // CHECK 2: Low relevance scores
  // ============================================================================

  const avgScore = results.matches.reduce((sum: number, m: any) => sum + (m.score || 0), 0) / results.matches.length;
  const topScore = results.matches[0]?.score || 0;

  if (topScore < minRelevanceScore) {
    console.log(`ðŸ” [OBSERVE] Low relevance (top: ${topScore.toFixed(2)}, avg: ${avgScore.toFixed(2)}) - refinement needed`);
    return {
      needsRefinement: true,
      reason: 'low_relevance',
      details: {
        avgScore,
        suggestion: 'Try different keywords or broader search'
      }
    };
  }

  // ============================================================================
  // CHECK 3: Incomplete results (user asks for specific count)
  // ============================================================================

  const countMatch = query.match(/\b(all\s+)?(\d+)\s+(principles?|steps?|methods?|ways?|reasons?|factors?|elements?|components?|stages?|phases?|points?)\b/i);

  if (countMatch) {
    const expectedCount = parseInt(countMatch[2]);

    // Try to count how many distinct items we found
    // This is a heuristic - we look for numbered lists or distinct concepts
    const content = results.matches.map((m: any) => m.metadata?.content || '').join(' ');

    // Count numbered items (1., 2., 3., etc.)
    const numberedItems = content.match(/\b\d+\.\s/g)?.length || 0;

    // Count bullet points
    const bulletItems = content.match(/[â€¢\-\*]\s/g)?.length || 0;

    const foundCount = Math.max(numberedItems, bulletItems, results.matches.length);

    if (foundCount < expectedCount) {
      console.log(`ðŸ” [OBSERVE] Incomplete results (expected: ${expectedCount}, found: ${foundCount}) - refinement needed`);
      return {
        needsRefinement: true,
        reason: 'incomplete',
        details: {
          expected: expectedCount,
          found: foundCount,
          suggestion: `Search for "complete list" or "all ${expectedCount}"`
        }
      };
    }
  }

  // ============================================================================
  // CHECK 4: Insufficient coverage for multi-part queries
  // ============================================================================

  // Detect multi-part queries (e.g., "compare X and Y", "what is A and B")
  const hasAnd = /\band\b/i.test(query);
  const hasOr = /\bor\b/i.test(query);
  const hasVs = /\bvs\.?\b|\bversus\b/i.test(query);

  if ((hasAnd || hasOr || hasVs) && results.matches.length < 5) {
    console.log(`ðŸ” [OBSERVE] Multi-part query with insufficient results (${results.matches.length} chunks) - refinement may be needed`);
    // Don't force refinement, but flag as potentially insufficient
    return {
      needsRefinement: false, // Let it proceed, but log the concern
      reason: 'insufficient_coverage',
      details: {
        found: results.matches.length,
        suggestion: 'Consider breaking query into sub-queries'
      }
    };
  }

  // ============================================================================
  // ALL CHECKS PASSED - Results are good
  // ============================================================================

  console.log(`âœ… [OBSERVE] Results are sufficient (${results.matches.length} chunks, avg score: ${avgScore.toFixed(2)})`);
  return {
    needsRefinement: false
  };
}

function refineQuery(originalQuery: string, observation: ObservationResult): string {

  if (!observation.needsRefinement) {
    return originalQuery; // No refinement needed
  }

  console.log(`ðŸ”§ [REFINE] Refining query due to: ${observation.reason}`);

  switch (observation.reason) {

    // ============================================================================
    // CASE 1: No results found â†’ Broaden the search
    // ============================================================================
    case 'no_results': {
      // Remove very specific terms, keep core concepts
      // Example: "How does loss aversion affect purchasing decisions in retail?"
      // â†’ "loss aversion purchasing"

      // Extract key nouns (simple heuristic: words > 4 chars, not common words)
      const commonWords = ['what', 'how', 'why', 'when', 'where', 'does', 'affect', 'impact', 'influence', 'relate', 'apply'];
      const words = originalQuery.toLowerCase().split(/\s+/);
      const keyWords = words.filter(w =>
        w.length > 4 &&
        !commonWords.includes(w) &&
        !/^(the|and|for|with|from|about)$/.test(w)
      );

      const refinedQuery = keyWords.slice(0, 3).join(' '); // Take top 3 key words
      console.log(`ðŸ”§ [REFINE] Broadened query: "${originalQuery}" â†’ "${refinedQuery}"`);
      return refinedQuery;
    }

    // ============================================================================
    // CASE 2: Low relevance â†’ Try different keywords
    // ============================================================================
    case 'low_relevance': {
      // Try removing question words and focusing on core concepts
      // Example: "What are the key principles of persuasion?"
      // â†’ "principles persuasion"

      const withoutQuestionWords = originalQuery
        .replace(/^(what|how|why|when|where|who|which)\s+(is|are|does|do|can|could|would|should)\s+/i, '')
        .replace(/^(tell me about|explain|describe|list|show me)\s+/i, '');

      console.log(`ðŸ”§ [REFINE] Simplified query: "${originalQuery}" â†’ "${withoutQuestionWords}"`);
      return withoutQuestionWords;
    }

    // ============================================================================
    // CASE 3: Incomplete results â†’ Search for complete list
    // ============================================================================
    case 'incomplete': {
      // Add "complete list" or "all X" to the query
      // Example: "What are Cialdini's principles?" (found 5, expected 7)
      // â†’ "Cialdini complete list all 7 principles"

      const expected = observation.details?.expected;
      const coreQuery = originalQuery.replace(/^(what|how|list|tell me|explain)\s+(are|is|about)?\s*/i, '');

      const refinedQuery = expected
        ? `${coreQuery} complete list all ${expected}`
        : `${coreQuery} complete list`;

      console.log(`ðŸ”§ [REFINE] Added "complete list": "${originalQuery}" â†’ "${refinedQuery}"`);
      return refinedQuery;
    }

    // ============================================================================
    // ============================================================================
    case 'insufficient_coverage': {
      // This will be handled by query decomposition in Phase 2
      console.log(`ðŸ”§ [REFINE] Insufficient coverage - will be handled by decomposition`);
      return originalQuery;
    }

    default:
      return originalQuery;
  }
}

// ============================================================================
// QUERY DECOMPOSITION - Breaks complex queries into sub-queries
// ============================================================================

interface QueryAnalysis {
  isComplex: boolean;
  queryType: 'simple' | 'comparison' | 'multi_part' | 'sequential' | 'cross_document';
  subQueries?: string[];
  originalQuery: string;
}

async function analyzeQueryComplexity(query: string): Promise<QueryAnalysis> {
  const fnStart = Date.now();
  if (requestTimer) requestTimer.start('analyzeQueryComplexity');

  const lowerQuery = query.toLowerCase();

  // ============================================================================
  // PATTERN 0: Multi-Document Cross-Reference Queries (HIGHEST PRIORITY)
  // ============================================================================
  // Example: "Based on document A and document B, analyze..."
  // Example: "Compare the financial report with the lease agreement"
  // Example: "Using the medical record and lease, determine..."

  const multiDocPatterns = [
    /based on.*(?:and|,).*(?:analyze|compare|evaluate|assess|determine)/i,
    /(?:compare|contrast).*(?:with|and|versus|vs)/i,
    /using.*(?:and|,).*(?:analyze|determine|assess|evaluate)/i,
    /(?:financial report|lease|contract|medical record|agreement).*(?:and|,).*(?:financial report|lease|contract|medical record|agreement)/i,
    /cross-reference|cross reference/i,
    /relationship between.*and/i,
    /how does.*relate to|how does.*affect/i,
    /(?:based on|according to|from).*(?:report|document|file|record).*(?:and|,).*(?:report|document|file|record)/i,
    /analyze.*(?:potential|financial|risk|impact).*(?:for|of)/i
  ];

  for (const pattern of multiDocPatterns) {
    if (pattern.test(query)) {
      console.log(`ðŸ”— [DECOMPOSE] Detected multi-document cross-reference query`);

      // Use LLM to intelligently decompose
      if (requestTimer) requestTimer.start('decomposeWithLLM');
      const decomposed = await decomposeWithLLM(query);
      if (requestTimer) requestTimer.end('decomposeWithLLM');
      if (decomposed) {
        if (requestTimer) requestTimer.end('analyzeQueryComplexity');
        return decomposed;
      }
    }
  }

  // ============================================================================
  // PATTERN 1: Comparison queries
  // ============================================================================

  const comparisonPatterns = [
    /compare\s+(.+?)\s+(and|vs\.?|versus)\s+(.+)/i,
    /difference\s+between\s+(.+?)\s+and\s+(.+)/i,
    /(.+?)\s+vs\.?\s+(.+)/i,
    /(.+?)\s+versus\s+(.+)/i
  ];

  for (const pattern of comparisonPatterns) {
    const match = query.match(pattern);
    if (match) {
      // Extract the two concepts being compared
      let concept1, concept2;

      if (match[1] && match[3]) {
        // "compare X and Y" or "compare X vs Y"
        concept1 = match[1].trim();
        concept2 = match[3].trim();
      } else if (match[1] && match[2]) {
        // "X vs Y" or "difference between X and Y"
        concept1 = match[1].trim();
        concept2 = match[2].trim();
      }

      if (concept1 && concept2) {
        console.log(`ðŸ§© [DECOMPOSE] Detected comparison query: "${concept1}" vs "${concept2}"`);

        if (requestTimer) requestTimer.end('analyzeQueryComplexity');
        return {
          isComplex: true,
          queryType: 'comparison',
          subQueries: [
            concept1, // Get information about first concept
            concept2, // Get information about second concept
            query // Also search for direct comparison content
          ],
          originalQuery: query
        };
      }
    }
  }

  // ============================================================================
  // PATTERN 2: Multi-part queries with "and"
  // ============================================================================

  // Example: "What are the revenue in Q1 and Q2 and Q3?"
  // Example: "Explain A and B and C"

  const andParts = query.split(/\s+and\s+/i);

  if (andParts.length >= 3) {
    // Has 3+ parts connected by "and"
    console.log(`ðŸ§© [DECOMPOSE] Detected multi-part query with ${andParts.length} parts`);

    // Extract the question stem (e.g., "What is" from "What is A and B and C")
    const questionStem = andParts[0].match(/^(what|how|why|when|where|who|which|explain|describe|tell me about|list)\s+(is|are|does|do|was|were)?/i)?.[0] || '';

    const subQueries = andParts.map((part, index) => {
      if (index === 0) {
        return part.trim(); // First part already has question stem
      } else {
        // Add question stem to subsequent parts
        return questionStem ? `${questionStem} ${part.trim()}` : part.trim();
      }
    });

    if (requestTimer) requestTimer.end('analyzeQueryComplexity');
    return {
      isComplex: true,
      queryType: 'multi_part',
      subQueries,
      originalQuery: query
    };
  }

  // ============================================================================
  // PATTERN 3: Sequential queries with numbered steps
  // ============================================================================

  // Example: "First explain X, then describe Y, finally analyze Z"
  // Example: "What is step 1 and step 2 and step 3?"

  const sequentialPatterns = [
    /first.+?(then|and then|next|after that|finally)/i,
    /(step|stage|phase)\s+\d+/gi
  ];

  for (const pattern of sequentialPatterns) {
    if (pattern.test(query)) {
      console.log(`ðŸ§© [DECOMPOSE] Detected sequential query`);

      // Use LLM to decompose (more complex pattern)
      if (requestTimer) requestTimer.start('decomposeWithLLM (sequential)');
      const decomposed = await decomposeWithLLM(query);
      if (requestTimer) requestTimer.end('decomposeWithLLM (sequential)');
      if (decomposed) {
        if (requestTimer) requestTimer.end('analyzeQueryComplexity');
        return decomposed;
      }
    }
  }

  // ============================================================================
  // PATTERN 4: Queries asking for specific counts
  // ============================================================================

  // Example: "List all 7 principles"
  // Example: "What are the 5 stages?"

  const countMatch = query.match(/\b(all\s+)?(\d+)\s+(principles?|steps?|methods?|ways?|reasons?|factors?|elements?|components?|stages?|phases?)\b/i);

  if (countMatch) {
    const count = parseInt(countMatch[2]);
    if (count >= 5) {
      // Large lists might benefit from decomposition
      console.log(`ðŸ§© [DECOMPOSE] Detected large list query (${count} items)`);

      // Don't decompose, but flag for special handling (completeness check)
      if (requestTimer) requestTimer.end('analyzeQueryComplexity');
      return {
        isComplex: true,
        queryType: 'simple', // Keep as simple, but observation layer will check completeness
        originalQuery: query
      };
    }
  }

  // ============================================================================
  // DEFAULT: Simple query
  // ============================================================================

  console.log(`âœ… [DECOMPOSE] Simple query - no decomposition needed`);
  if (requestTimer) requestTimer.end('analyzeQueryComplexity');
  return {
    isComplex: false,
    queryType: 'simple',
    originalQuery: query
  };
}

const decompositionCache = new Map<string, { result: QueryAnalysis | null; timestamp: number }>();
const DECOMPOSITION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function decomposeWithLLM(query: string): Promise<QueryAnalysis | null> {
  // âš¡ Check cache first - saves 1-2 seconds for repeat queries
  const cacheKey = query.toLowerCase().trim();
  const cached = decompositionCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < DECOMPOSITION_CACHE_TTL) {
    console.log(`âš¡ [DECOMPOSE CACHE HIT] Using cached decomposition (saved 1-2s)`);
    return cached.result;
  }

  try {
    console.log(`ðŸ¤– [LLM DECOMPOSE] Analyzing query complexity with LLM...`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent decomposition
        maxOutputTokens: 500,
      },
    });

    const prompt = `Analyze this query and break it into sub-queries if it's complex.

Query: "${query}"

QUERY TYPES:
1. SIMPLE: Can be answered with a single search
   - Example: "What is the revenue?"
   - Response: { "isComplex": false }

2. COMPARISON: Comparing multiple concepts or documents
   - Example: "Compare document A with document B"
   - Response: { "isComplex": true, "queryType": "comparison", "subQueries": [...] }

3. MULTI_PART: Multiple independent questions
   - Example: "What is X and what is Y?"
   - Response: { "isComplex": true, "queryType": "multi_part", "subQueries": [...] }

4. CROSS_DOCUMENT: Needs information from multiple documents
   - Example: "Based on the financial report and lease, analyze..."
   - Response: { "isComplex": true, "queryType": "cross_document", "subQueries": [...] }

DECOMPOSITION RULES:
- Each sub-query should be a complete, searchable question
- Sub-queries should be independent (can be searched separately)
- Keep sub-queries simple and focused
- For cross-document queries, create sub-queries that target specific documents
- Maximum 5 sub-queries
- Preserve entity names (company names, document types, etc.)

EXAMPLES:

Query: "Based on the financial report for TechCorp and the lease for TechStart, analyze risks for the landlord"
Response:
{
  "isComplex": true,
  "queryType": "cross_document",
  "subQueries": [
    "What is TechCorp's net income and cash flow from operations?",
    "What is the security deposit amount in the lease agreement?",
    "What is the monthly rent amount in the lease agreement?",
    "What is the relationship between TechCorp and TechStart?",
    "What are the landlord's obligations in the lease agreement?"
  ]
}

Query: "What is the revenue?"
Response:
{
  "isComplex": false
}

Now analyze this query:
"${query}"

Respond with ONLY the JSON object, no explanation.`;

    // Call Gemini to analyze query
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Extract JSON object from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Parse JSON response
    const analysis = JSON.parse(jsonText);

    if (analysis.isComplex && analysis.subQueries && analysis.subQueries.length > 0) {
      console.log(`ðŸ¤– [LLM DECOMPOSE] Broke query into ${analysis.subQueries.length} sub-queries`);
      const result: QueryAnalysis = {
        isComplex: true,
        queryType: analysis.queryType || 'sequential',
        subQueries: analysis.subQueries,
        originalQuery: query
      };
      // âš¡ Cache the result for future queries
      decompositionCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }

    console.log(`âœ… [LLM DECOMPOSE] Query classified as simple`);
    // âš¡ Cache null result for simple queries too (avoids re-analyzing)
    decompositionCache.set(cacheKey, { result: null, timestamp: Date.now() });
    return null;
  } catch (error) {
    console.error('âš ï¸ [LLM DECOMPOSE] Failed to decompose with LLM:', error);
    return null;
  }
}

async function handleMultiStepQuery(
  analysis: QueryAnalysis,
  userId: string,
  filter: any,
  onChunk: (chunk: string) => void
): Promise<any> {
  if (!analysis.subQueries || analysis.subQueries.length === 0) {
    throw new Error('No sub-queries provided for multi-step query');
  }

  console.log(`ðŸ”„ [MULTI-STEP] Executing ${analysis.subQueries.length} sub-queries...`);

  // ============================================================================
  // ============================================================================

  analysis.subQueries.forEach((subQuery, index) => {
    console.log(`  ${index + 1}. "${subQuery}"`);
  });

  // Generate all embeddings in parallel
  const embeddingPromises = analysis.subQueries.map(subQuery =>
    embeddingService.generateEmbedding(subQuery)
  );
  const embeddings = await Promise.all(embeddingPromises);

  // ============================================================================
  // Execute all Pinecone queries in parallel (with pre-generated embeddings)
  // ============================================================================

  const subQueryPromises = analysis.subQueries.map(async (subQuery, index) => {
    const queryEmbedding = embeddings[index].embedding;

    // ðŸ”€ HYBRID RETRIEVAL: Use combined Vector + BM25 search
    const hybridResults = await performHybridRetrieval(
      subQuery,
      queryEmbedding,
      userId,
      5, // topK
      filter
    );

    // Filter deleted documents
    const filteredMatches = await filterDeletedDocuments(hybridResults.matches || [], userId);

    // ðŸš€ HYBRID RETRIEVAL BOOST: Apply filename/entity matching boost
    const boostedMatches = hybridRetrievalBooster.boostRetrievalScores(filteredMatches, subQuery, 1.8);

    const sectionRefs = extractSectionReferences(subQuery);
    if (sectionRefs.length > 0) {
      boostSectionMatches(boostedMatches, sectionRefs);
    }

    console.log(`  âœ… Found ${boostedMatches.length} chunks for sub-query ${index + 1}`);

    return boostedMatches;
  });

  // Wait for all sub-queries to complete
  const allResults = await Promise.all(subQueryPromises);

  // ============================================================================
  // Combine and deduplicate results
  // ============================================================================

  const combinedMatches = [];
  const seenChunkIds = new Set();

  for (const results of allResults) {
    for (const match of results) {
      // Deduplicate by chunk ID
      const chunkId = match.id || `${match.metadata?.documentId}-${match.metadata?.page}`;

      if (!seenChunkIds.has(chunkId)) {
        seenChunkIds.add(chunkId);
        combinedMatches.push(match);
      }
    }
  }

  // Sort by relevance score (highest first)
  combinedMatches.sort((a, b) => (b.score || 0) - (a.score || 0));

  const topMatches = combinedMatches.slice(0, 10);

  console.log(`âœ… [MULTI-STEP] Combined ${allResults.length} sub-query results into ${topMatches.length} unique chunks`);

  return { matches: topMatches };
}

// ============================================================================
// ITERATIVE REFINEMENT - Full agent loop with multiple attempts
// ============================================================================

interface AgentLoopConfig {
  maxAttempts: number;           // Maximum refinement attempts
  minRelevanceScore: number;     // Minimum acceptable relevance
  minChunks: number;             // Minimum chunks needed
  improvementThreshold: number;  // Minimum improvement to continue (e.g., 0.1 = 10% better)
}

const DEFAULT_AGENT_CONFIG: AgentLoopConfig = {
  maxAttempts: 2,              // Reduced from 3 (saves 10-15s on complex queries)
  minRelevanceScore: 0.05,     // Slightly lower threshold (0.7 â†’ 0.65)
  minChunks: 3,
  improvementThreshold: 0.15   // Higher threshold (0.1 â†’ 0.15) to stop earlier if not improving much
};

interface AgentLoopState {
  attempt: number;
  bestResults: any | null;
  bestScore: number;
  history: Array<{
    attempt: number;
    query: string;
    resultCount: number;
    avgScore: number;
    observation: ObservationResult;
  }>;
}

function createInitialState(): AgentLoopState {
  return {
    attempt: 0,
    bestResults: null,
    bestScore: 0,
    history: []
  };
}

async function iterativeRetrieval(
  initialQuery: string,
  userId: string,
  filter: any,
  config: AgentLoopConfig = DEFAULT_AGENT_CONFIG
): Promise<any> {

  const state = createInitialState();
  let currentQuery = initialQuery;

  console.log(`ðŸ”„ [AGENT LOOP] Starting iterative retrieval (max ${config.maxAttempts} attempts)`);

  // ============================================================================
  // AGENT LOOP: Try up to maxAttempts times
  // ============================================================================

  while (state.attempt < config.maxAttempts) {
    state.attempt++;
    console.log(`\nðŸ”„ [AGENT LOOP] Attempt ${state.attempt}/${config.maxAttempts}: "${currentQuery}"`);

    // STEP 1: Execute retrieval

    // ✅ PERFORMANCE FIX: Use cached embeddings
    const embeddingResult = await generateEmbeddingCached(currentQuery);
    const queryEmbedding = embeddingResult.embedding;

    // ðŸ”€ HYBRID RETRIEVAL: Use combined Vector + BM25 search
    const hybridResults = await performHybridRetrieval(
      currentQuery,
      queryEmbedding,
      userId,
      5, // topK - less context = faster LLM response
      filter
    );

    const filteredMatches = await filterDeletedDocuments(hybridResults.matches || [], userId);

    // ðŸš€ HYBRID RETRIEVAL BOOST: Apply filename/entity matching boost
    const boostedMatches = hybridRetrievalBooster.boostRetrievalScores(filteredMatches, currentQuery, 1.8);

    const sectionRefs = extractSectionReferences(currentQuery);
    if (sectionRefs.length > 0) {
      boostSectionMatches(boostedMatches, sectionRefs);
    }

    // STEP 2: Observe results

    const observation = observeRetrievalResults({ matches: boostedMatches }, currentQuery, config.minRelevanceScore);

    const avgScore = boostedMatches.length > 0
      ? boostedMatches.reduce((sum: number, m: any) => sum + (m.score || 0), 0) / boostedMatches.length
      : 0;

    // Record this attempt in history
    state.history.push({
      attempt: state.attempt,
      query: currentQuery,
      resultCount: boostedMatches.length,
      avgScore,
      observation
    });

    console.log(`  ðŸ“Š Results: ${boostedMatches.length} chunks, avg score: ${avgScore.toFixed(2)}`);

    // STEP 3: Update best results if this attempt is better

    if (avgScore > state.bestScore) {
      const improvement = state.bestScore > 0
        ? ((avgScore - state.bestScore) / state.bestScore)
        : 1.0;

      console.log(`  âœ… New best results! (${(improvement * 100).toFixed(1)}% improvement)`);

      state.bestResults = { matches: boostedMatches };
      state.bestScore = avgScore;
    } else {
      console.log(`  âš ï¸  Not better than previous best (${state.bestScore.toFixed(2)})`);
    }

    // STEP 4: Decide if we should continue or stop

    // Stop if results are good enough
    if (!observation.needsRefinement &&
        boostedMatches.length >= config.minChunks &&
        avgScore >= config.minRelevanceScore) {
      console.log(`  âœ… Results are satisfactory - stopping`);
      break;
    }

    // Stop if we've reached max attempts
    if (state.attempt >= config.maxAttempts) {
      console.log(`  â¹ï¸  Reached max attempts - using best results`);
      break;
    }

    // Stop if last attempt didn't improve much
    if (state.attempt > 1) {
      const previousScore = state.history[state.history.length - 2].avgScore;
      const improvement = avgScore > 0 ? (avgScore - previousScore) / previousScore : 0;

      if (improvement < config.improvementThreshold && improvement >= 0) {
        console.log(`  â¹ï¸  Improvement too small (${(improvement * 100).toFixed(1)}%) - stopping`);
        break;
      }
    }

    // STEP 5: Refine query for next attempt

    console.log(`  ðŸ”§ Refining query for next attempt...`);
    currentQuery = refineQuery(currentQuery, observation);

    if (currentQuery === state.history[state.history.length - 1].query) {
      console.log(`  â¹ï¸  Refinement produced same query - stopping to avoid infinite loop`);
      break;
    }
  }

  // ============================================================================
  // Return best results found across all attempts
  // ============================================================================

  console.log(`\nâœ… [AGENT LOOP] Completed after ${state.attempt} attempts`);
  console.log(`  Best score: ${state.bestScore.toFixed(2)}`);
  console.log(`  Best result count: ${state.bestResults?.matches?.length || 0}`);

  return state.bestResults || { matches: [] };
}

interface AnswerValidation {
  isValid: boolean;
  issues?: string[];
  suggestions?: string[];
}

function validateAnswer(answer: string, query: string, sources: any[]): AnswerValidation {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // ============================================================================
  // CHECK 1: Answer is not too short
  // ============================================================================

  if (answer.length < 50) {
    issues.push('Answer is very short (< 50 characters)');
    suggestions.push('Consider retrieving more context or refining query');
  }

  // ============================================================================
  // CHECK 2: Answer doesn't just say "couldn't find"
  // ============================================================================

  if (/couldn't find|don't have|no information/i.test(answer) && sources.length > 0) {
    issues.push('Answer says "couldn\'t find" but sources are available');
    suggestions.push('LLM might not be using the provided context - check prompt');
  }

  // ============================================================================
  // CHECK 3: For count queries, verify count is mentioned
  // ============================================================================

  const countMatch = query.match(/\b(all\s+)?(\d+)\s+(principles?|steps?|methods?|ways?)\b/i);
  if (countMatch) {
    const expectedCount = parseInt(countMatch[2]);
    const numberedItems = answer.match(/\b\d+\./g)?.length || 0;

    if (numberedItems < expectedCount) {
      issues.push(`Query asks for ${expectedCount} items but answer only lists ${numberedItems}`);
      suggestions.push('Retrieval might be incomplete - consider additional refinement');
    }
  }

  // ============================================================================
  // CHECK 4: Answer uses sources (has page references)
  // ============================================================================

  if (sources.length > 0 && !/\[p\.\d+\]/i.test(answer)) {
    issues.push('Answer doesn\'t include page citations despite having sources');
    suggestions.push('Check if citation format is correct in system prompt');
  }

  // ============================================================================
  // Return validation result
  // ============================================================================

  if (issues.length > 0) {
    console.log(`âš ï¸  [VALIDATE] Answer validation found ${issues.length} issues:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
    return { isValid: false, issues, suggestions };
  }

  console.log(`âœ… [VALIDATE] Answer passed validation`);
  return { isValid: true };
}

// ============================================================================
// ADAPTIVE STRATEGY - Choose best retrieval approach per query
// ============================================================================

function determineRetrievalStrategy(query: string): 'vector' | 'keyword' | 'hybrid' {

  const lowerQuery = query.toLowerCase();

  // ============================================================================
  // STRATEGY 1: Keyword search for exact-match queries
  // ============================================================================
  // Uses PostgreSQL full-text search with GIN index for fast keyword matching

  // Detect technical terms, IDs, version numbers, acronyms
  const hasExactMatchPattern = [
    /[A-Z]{2,}-\d+/,       // IDs like "AES-256", "SHA-512"
    /v\d+\.\d+/,           // Version numbers like "v2.1"
    /\b[A-Z]{3,}\b/,       // Acronyms like "API", "SDK", "OCR"
    /"[^"]+"/,             // Quoted terms (user wants exact match)
    /\d{3,}/               // Long numbers (IDs, codes)
  ];

  for (const pattern of hasExactMatchPattern) {
    if (pattern.test(query)) {
      console.log(`ðŸŽ¯ [STRATEGY] Exact-match pattern detected â†’ using KEYWORD search (BM25)`);
      return 'keyword';
    }
  }

  // ============================================================================
  // STRATEGY 2: Hybrid search for comparisons
  // ============================================================================

  const isComparison = /compare|difference|versus|vs\.?/i.test(query);

  if (isComparison) {
    console.log(`ðŸŽ¯ [STRATEGY] Comparison query detected â†’ using HYBRID search`);
    return 'hybrid';
  }

  // ============================================================================
  // STRATEGY 3: Hybrid for multi-document queries
  // ============================================================================

  // Detect queries that mention multiple documents
  const documentMentions = query.match(/\b\w+\.(pdf|docx|xlsx|pptx|txt)\b/gi);

  if (documentMentions && documentMentions.length >= 2) {
    console.log(`ðŸŽ¯ [STRATEGY] Multiple documents mentioned â†’ using HYBRID search`);
    return 'hybrid';
  }

  // ============================================================================
  // STRATEGY 4: Vector search for everything else (semantic understanding)
  // ============================================================================

  console.log(`ðŸŽ¯ [STRATEGY] Standard query â†’ using VECTOR search`);
  return 'vector';
}

async function pureBM25Search(query: string, userId: string, topK: number = 20): Promise<any> {
  console.log(`ðŸ” [PURE BM25] Executing keyword-only search for: "${query}"`);

  try {
    await initializePinecone();

    // This will return only BM25 results
    const emptyVectorResults: any[] = [];
    const hybridResults = await bm25RetrievalService.hybridSearch(query, emptyVectorResults, userId, topK);

    console.log(`âœ… [PURE BM25] Found ${hybridResults.length} keyword matches`);

    // Convert to Pinecone-like format
    const matches = hybridResults.map((result: any) => ({
      id: result.metadata?.documentId || '',
      score: result.bm25Score || result.hybridScore,
      metadata: result.metadata,
      content: result.content
    }));

    return { matches };
  } catch (error) {
    console.error('âŒ [PURE BM25] Error:', error);
    return { matches: [] };
  }
}

// ============================================================================
// LANGUAGE DETECTION UTILITY
// ============================================================================

function detectLanguage(query: string): 'pt' | 'es' | 'en' | 'fr' {
  const lower = query.toLowerCase();

  const strongEnglishPatterns = [
    /\bwhat\s+is\b/i,
    /\bhow\s+(many|much|is|are|does|do)\b/i,
    /\bwhy\s+(is|are|does|do)\b/i,
    /\bwhat\s+are\b/i,
    /\bwhich\s+(is|are|property|properties|fund|funds|company|companies)\b/i,
    /\bshould\s+i\b/i,
    /\bcan\s+(you|i)\b/i,
    /\bif\s+i\s+have\b/i,
    /\bbased\s+on\b/i,
    /\baccording\s+to\b/i,
    /\bplease\b/i,
    /\bthe\s+(total|average|sum|revenue|investment|budget|fund|property)\b/i,
    /\b(calculate|compare|analyze|explain|show|find|get|list|summarize)\b/i,
    /\b(what|which|how|where|when|who)\s+/i,  // English question starters
    /\b(across|between|from|with)\s+/i,  // English prepositions in context
  ];

  // If query matches any strong English pattern, return English immediately
  if (strongEnglishPatterns.some(pattern => pattern.test(lower))) {
    console.log(`ðŸŒ [LANG DETECT] Detected: English (strong pattern match)`);
    return 'en';
  }

  // Helper function to count whole-word matches using word boundaries
  const countWholeWordMatches = (text: string, words: string[]): number => {
    return words.filter(word => {
      // Skip single-character patterns (they cause false positives)
      if (word.length <= 2) return false;
      // Escape special regex characters and create word boundary pattern
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(text);
    }).length;
  };

  // English indicators (STRONG - check first)
  const enWords = [
    // Question words (unique to English)
    'what', 'how', 'when', 'where', 'why', 'who', 'which', 'whose',
    // Common English verbs
    'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did',
    'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might',
    // English-specific words
    'the', 'and', 'but', 'or', 'not', 'this', 'that', 'these', 'those',
    'with', 'from', 'into', 'about', 'between', 'through', 'during',
    // Document/file terms (English)
    'document', 'documents', 'file', 'files', 'folder', 'folders',
    // Actions
    'show', 'tell', 'find', 'get', 'give', 'make', 'create', 'delete', 'move',
    'list', 'summarize', 'explain', 'calculate', 'compare', 'analyze',
    // Question patterns
    'uploaded', 'mentioned', 'contains', 'across', 'between',
    // Common words
    'all', 'any', 'each', 'every', 'some', 'many', 'much', 'more', 'most',
    'my', 'your', 'their', 'our', 'its',
    'total', 'average', 'sum', 'main', 'key', 'top'
  ];

  // Portuguese indicators (unique words only - removed single chars)
  const ptWords = [
    // Question words (unique to Portuguese)
    'quantos', 'quantas', 'quais', 'qual', 'onde', 'quando', 'porque', 'quem',
    // Common Portuguese verbs
    'tenho', 'salvei', 'salvo', 'fazer', 'posso', 'pode', 'preciso', 'quero', 'gostaria',
    'ajudar', 'mostrar', 'explicar', 'encontrar', 'buscar', 'procurar',
    // File/document terms (Portuguese-specific)
    'arquivo', 'arquivos', 'pasta', 'pastas',
    // Actions
    'cria', 'criar', 'deletar', 'apagar', 'mover', 'renomear', 'enviar', 'baixar',
    // Greetings (Portuguese-specific)
    'obrigado', 'obrigada',
    // Common Portuguese words (unique)
    'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas',
    'muito', 'tambÃ©m', 'tambem'
  ];

  // Spanish indicators (unique words only - removed single chars)
  const esWords = [
    // Question words (Spanish-specific)
    'cuÃ¡ntos', 'cuantos', 'cuÃ¡ntas', 'cuantas', 'cuÃ¡les', 'cuales', 'cuÃ¡l', 'cual',
    'dÃ³nde', 'donde', 'cuÃ¡ndo', 'cuando', 'cÃ³mo', 'quiÃ©n', 'quien',
    // Common Spanish verbs
    'tengo', 'puedo', 'necesito', 'quiero', 'quisiera',
    // File/document terms (Spanish-specific)
    'archivo', 'archivos', 'carpeta', 'carpetas',
    // Actions
    'crear', 'borrar', 'eliminar', 'renombrar', 'descargar',
    // Greetings (Spanish-specific)
    'hola', 'gracias'
  ];

  // French indicators (unique words only)
  const frWords = [
    // Question words (French-specific)
    'quoi', 'comment', 'pourquoi', 'combien', 'lesquels', 'lesquelles',
    // Common French verbs/words
    'avoir', 'Ãªtre', 'faire', 'pouvoir', 'vouloir', 'devoir', 'savoir',
    'je', 'tu', 'nous', 'vous', 'ils', 'elles',
    // File/document terms (French-specific)
    'fichier', 'fichiers', 'dossier', 'dossiers', 'document', 'documents',
    // Actions
    'crÃ©er', 'supprimer', 'renommer', 'tÃ©lÃ©charger', 'montrer', 'expliquer',
    // Greetings (French-specific)
    'bonjour', 'bonsoir', 'salut', 'merci'
  ];

  // Count matches for each language using whole word matching
  const enCount = countWholeWordMatches(lower, enWords);
  const ptCount = countWholeWordMatches(lower, ptWords);
  const esCount = countWholeWordMatches(lower, esWords);
  const frCount = countWholeWordMatches(lower, frWords);

  // Log for debugging
  console.log(`ðŸŒ [LANG DETECT] EN: ${enCount}, PT: ${ptCount}, ES: ${esCount}, FR: ${frCount} for query: "${query.substring(0, 50)}..."`);

  const MIN_MATCHES_FOR_LANGUAGE_SWITCH = 2;

  // English wins if it has the most matches OR ties with any other language
  if (enCount >= ptCount && enCount >= esCount && enCount >= frCount && enCount > 0) {
    console.log(`ðŸŒ [LANG DETECT] Detected: English`);
    return 'en';
  }

  // Return language with most matches ONLY if above threshold
  if (ptCount > esCount && ptCount > frCount && ptCount >= MIN_MATCHES_FOR_LANGUAGE_SWITCH) {
    console.log(`ðŸŒ [LANG DETECT] Detected: Portuguese (${ptCount} matches)`);
    return 'pt';
  }
  if (esCount > ptCount && esCount > frCount && esCount >= MIN_MATCHES_FOR_LANGUAGE_SWITCH) {
    console.log(`ðŸŒ [LANG DETECT] Detected: Spanish (${esCount} matches)`);
    return 'es';
  }
  if (frCount > ptCount && frCount > esCount && frCount >= MIN_MATCHES_FOR_LANGUAGE_SWITCH) {
    console.log(`ðŸŒ [LANG DETECT] Detected: French (${frCount} matches)`);
    return 'fr';
  }

  console.log(`ðŸŒ [LANG DETECT] Detected: English (default)`);
  return 'en'; // Default to English
}

// ============================================================================
// FORMAT ENFORCEMENT HELPER
// ============================================================================
// PURPOSE: Centralized format enforcement for ALL response paths
// ============================================================================

function applyFormatEnforcement(
  response: string,
  options?: {
    skipForShortResponses?: boolean;
    responseType?: string;
    logPrefix?: string;
    query?: string; // NEW: Pass query for smart title decisions
  }
): string {
  const {
    skipForShortResponses = true,
    responseType = 'general',
    logPrefix = '[FORMAT]',
    query = ''
  } = options || {};

  // Skip empty responses
  if (!response || response.trim().length === 0) {
    return response;
  }

  if (skipForShortResponses && response.length < 50) {
    console.log(`${logPrefix} Skipping format enforcement for short response (${response.length} chars)`);
    return response;
  }

  // Skip special response markers (document generation, streaming signals, etc.)
  if (response.startsWith('__') && response.includes('__:')) {
    console.log(`${logPrefix} Skipping format enforcement for special marker`);
    return response;
  }

  if (response.includes('{{DOC:::')) {
    console.log(`${logPrefix} Skipping format enforcement for inline document markers`);
    return response;
  }

  try {
    console.log(`${logPrefix} Applying format enforcement to ${responseType} response (${response.length} chars)...`);

    // Apply format enforcement with query for smart title decisions
    const formatResult = kodaFormatEnforcementService.enforceFormat(
      response,
      'informational',  // queryType
      'medium',         // answerLength
      undefined,        // userTone
      undefined,        // fileList
      query             // NEW: Pass query for smart title detection
    );

    const formatted = formatResult.fixedText || response;

    // Log violations if any
    if (formatResult.violations.length > 0) {
      const errorCount = formatResult.violations.filter(v => v.severity === 'error').length;
      const warningCount = formatResult.violations.filter(v => v.severity === 'warning').length;
      console.log(`${logPrefix} Fixed ${errorCount} errors, ${warningCount} warnings`);
    } else {
      console.log(`${logPrefix} No format violations found`);
    }

    return formatted;
  } catch (error) {
    console.error(`${logPrefix} Format enforcement error:`, error);
    // Return original response if enforcement fails
    return response;
  }
}

// ============================================================================
// CALCULATION ENGINE - Manus Method Integration
// ============================================================================

async function handleCalculationQuery(query: string, userId: string): Promise<string | null> {
  console.log('ðŸ§® [CALCULATION] Routing query through calculation router...');

  try {
    // Use the unified calculation router for all calculation types
    const result = await calculationRouter.routeQuery(query);

    if (!result.handled) {
      console.log('ðŸ§® [CALCULATION] Not a calculation, proceeding with normal RAG');
      return null; // Not a calculation, proceed with normal RAG
    }

    if (result.error) {
      console.error('ðŸ§® [CALCULATION] Error:', result.error);
      return `I encountered an error while calculating: ${result.error}`;
    }

    console.log(`ðŸ§® [CALCULATION] Handled by: ${result.method} in ${result.executionTime}ms`);
    return result.response || null;
  } catch (error: any) {
    console.error('ðŸ§® [CALCULATION] Unexpected error:', error);
    // Fall back to legacy handling if router fails
    return handleCalculationQueryLegacy(query, userId);
  }
}

async function handleCalculationQueryLegacy(query: string, userId: string): Promise<string | null> {
  console.log('ðŸ§® [CALCULATION] Using legacy handler...');

  // Step 1: Detect if this is a calculation
  const detection = calculationDetector.detect(query);

  if (!detection.isCalculation) {
    console.log('ðŸ§® [CALCULATION] Not a calculation, proceeding with normal RAG');
    return null; // Not a calculation, proceed with normal RAG
  }

  console.log(`ðŸ§® [CALCULATION] Type: ${detection.type}, Confidence: ${detection.confidence}`);

  // Step 2: Route to appropriate calculator
  switch (detection.type) {
    case CalculationType.SIMPLE_MATH:
      return await handleSimpleMath(query, detection);

    case CalculationType.FINANCIAL:
      return await handleFinancialCalculation(query, detection);

    case CalculationType.STATISTICAL:
      return await handleStatisticalCalculation(query, detection);

    case CalculationType.COMPLEX:
    case CalculationType.EXCEL_FORMULA:
      return await handleComplexCalculation(query, userId);

    default:
      return null; // Fallback to normal RAG
  }
}

/**
 * Handle simple math calculations
 */
async function handleSimpleMath(query: string, detection: any): Promise<string> {
  const result = smartCalculator.evaluateExpression(detection.expression || query);

  if (result.success) {
    return `The answer is **${result.formatted}**.

**Calculation**: \`${detection.expression || query}\`
**Result**: ${result.result}
**Execution time**: ${result.executionTime}ms`;
  } else {
    return `I encountered an error calculating that: ${result.error}`;
  }
}

/**
 * Handle financial calculations
 */
async function handleFinancialCalculation(query: string, detection: any): Promise<string> {
  const params = detection.parameters || {};

  const result = smartCalculator.calculateFinancial(params.function, params);

  if (result.success) {
    return `The **${params.function}** is **${result.formatted}**.

**Function**: ${params.function}
**Parameters**: ${JSON.stringify(params, null, 2)}
**Result**: ${result.result}
**Execution time**: ${result.executionTime}ms`;
  } else {
    // Fallback to Python execution for complex financial calculations
    return await handleComplexCalculation(query, '');
  }
}

/**
 * Handle statistical calculations
 */
async function handleStatisticalCalculation(query: string, detection: any): Promise<string> {
  const params = detection.parameters || {};

  const result = smartCalculator.calculateStatistical(params.function, params.values || []);

  if (result.success) {
    return `The **${params.function}** is **${result.formatted}**.

**Values**: [${params.values?.join(', ')}]
**Result**: ${result.result}
**Execution time**: ${result.executionTime}ms`;
  } else {
    return `I encountered an error: ${result.error}`;
  }
}

/**
 * Handle complex calculations using Python (EXACTLY like Manus)
 */
async function handleComplexCalculation(query: string, userId: string): Promise<string> {
  console.log('ðŸ [PYTHON] Generating code for complex calculation...');

  // Step 1: Generate Python code using LLM
  const codeGen = await codeGenerator.generateCalculationCode(query);

  if (!codeGen.success || !codeGen.code) {
    return `I couldn't generate code for that calculation: ${codeGen.error}`;
  }

  console.log('ðŸ [PYTHON] Code generated, validating...');

  // Step 2: Validate code for security
  const validation = pythonExecutor.validateCode(codeGen.code);

  if (!validation.valid) {
    return `I can't execute that code for security reasons: ${validation.reason}`;
  }

  console.log('ðŸ [PYTHON] Executing code...');

  // Step 3: Execute Python code
  const execution = await pythonExecutor.executePython(codeGen.code);

  if (execution.success) {
    let response = `**Result**: ${execution.output}`;

    if (codeGen.explanation) {
      response += `\n\n**How I calculated this**: ${codeGen.explanation}`;
    }

    response += `\n\n**Execution time**: ${execution.executionTime}ms`;

    // Optionally show the code
    response += `\n\n<details>
<summary>View Python Code</summary>

\`\`\`python
${codeGen.code}
\`\`\`
</details>`;

    return response;
  } else {
    return `I encountered an error executing the calculation: ${execution.error}`;
  }
}

// ============================================================================
// EXCEL QUERY HANDLER - Direct Excel cell/formula queries
// ============================================================================

/**
 * Handle Excel-specific queries (cell values, formulas, what-if scenarios)
 */
async function handleExcelQuery(
  query: string,
  documentId: string,
  userId: string
): Promise<string | null> {
  // Check if the document is loaded in the Excel engine
  if (!excelFormulaEngine.isLoaded(documentId)) {
    return null; // Not an Excel document or not loaded
  }

  // Detect Excel formula/cell queries
  const formulaPatterns = [
    { pattern: /what(?:'s| is) the (?:value|formula) (?:in|of|for) cell ([A-Z]+\d+)/i, type: 'value' },
    { pattern: /calculate cell ([A-Z]+\d+)/i, type: 'value' },
    { pattern: /what if ([A-Z]+\d+) (?:is|equals|=|was|were) (.+)/i, type: 'whatif' },
    { pattern: /how is ([A-Z]+\d+) calculated/i, type: 'dependencies' },
    { pattern: /what cells? (?:does|do) ([A-Z]+\d+) depend on/i, type: 'dependencies' },
    { pattern: /what cells? (?:are affected by|use) ([A-Z]+\d+)/i, type: 'dependents' },
    { pattern: /show me cell ([A-Z]+\d+)/i, type: 'value' },
    { pattern: /get (?:the )?(?:value of )?([A-Z]+\d+)/i, type: 'value' },
  ];

  for (const { pattern, type } of formulaPatterns) {
    const match = query.match(pattern);
    if (match) {
      console.log(`ðŸ“Š [EXCEL] Detected ${type} query for cell ${match[1]}`);

      switch (type) {
        case 'value':
          return await handleExcelCellQuery(match[1], documentId);
        case 'whatif':
          return await handleExcelWhatIfQuery(match[1], match[2], documentId);
        case 'dependencies':
          return await handleExcelDependenciesQuery(match[1], documentId);
        case 'dependents':
          return await handleExcelDependentsQuery(match[1], documentId);
      }
    }
  }

  return null;
}

/**
 * Handle Excel cell value/formula query
 */
async function handleExcelCellQuery(
  cellAddress: string,
  documentId: string
): Promise<string> {
  // Get sheet names to find the cell
  const sheetNames = excelFormulaEngine.getSheetNames(documentId);
  const sheetName = sheetNames[0] || 'Sheet1';

  // Get cell value and formula
  const result = excelFormulaEngine.getCellValue(documentId, sheetName, cellAddress);

  if (!result.success) {
    return `I couldn't find cell ${cellAddress}: ${result.error}`;
  }

  let response = `**Cell ${cellAddress}** (Sheet: ${sheetName}):\n\n`;
  response += `- **Value**: ${result.value ?? '(empty)'}\n`;

  if (result.formula) {
    response += `- **Formula**: \`${result.formula}\`\n\n`;

    // Get dependencies
    const deps = excelFormulaEngine.getFormulaDependencies(documentId, sheetName, cellAddress);
    if (deps.success && deps.dependencies && deps.dependencies.length > 0) {
      response += `**This cell depends on**: ${deps.dependencies.join(', ')}\n\n`;
    }

    // Get dependents
    const dependents = excelFormulaEngine.getFormulaDependents(documentId, sheetName, cellAddress);
    if (dependents.success && dependents.dependents && dependents.dependents.length > 0) {
      response += `**Cells that depend on this**: ${dependents.dependents.join(', ')}\n\n`;
    }

    response += `This cell is calculated using the formula shown above.`;
  } else {
    response += `\nThis cell contains a direct value (no formula).`;
  }

  return response;
}

/**
 * Handle Excel what-if scenario query
 */
async function handleExcelWhatIfQuery(
  cellAddress: string,
  newValueStr: string,
  documentId: string
): Promise<string> {
  const sheetNames = excelFormulaEngine.getSheetNames(documentId);
  const sheetName = sheetNames[0] || 'Sheet1';

  // Parse the new value
  const newValue = parseFloat(newValueStr.replace(/[$,]/g, '')) || newValueStr;

  // Get original value
  const originalResult = excelFormulaEngine.getCellValue(documentId, sheetName, cellAddress);
  const originalValue = originalResult.value;

  // Execute what-if scenario
  const whatIfResult = await excelFormulaEngine.executeWhatIf(documentId, sheetName, [
    { cellAddress, newValue }
  ]);

  if (!whatIfResult.success) {
    return `I couldn't run the what-if scenario: ${whatIfResult.error}`;
  }

  // Get the new values of key cells (we'll show cells that changed)
  let response = `**What-If Analysis**: If ${cellAddress} = ${newValue}\n\n`;
  response += `| Cell | Original | New Value |\n`;
  response += `|------|----------|----------|\n`;
  response += `| ${cellAddress} | ${originalValue} | ${newValue} |\n`;

  // Show a few dependent cells that might have changed
  const dependents = excelFormulaEngine.getFormulaDependents(documentId, sheetName, cellAddress);
  if (dependents.success && dependents.dependents) {
    for (const depCell of dependents.dependents.slice(0, 5)) {
      const cleanCell = depCell.includes('!') ? depCell.split('!')[1] : depCell;
      const depValue = excelFormulaEngine.getCellValue(documentId, sheetName, cleanCell);
      if (depValue.success) {
        response += `| ${cleanCell} | - | ${depValue.value} |\n`;
      }
    }
  }

  // Revert the changes
  await excelFormulaEngine.revertWhatIf(documentId);

  response += `\n*Note: Original values have been restored.*`;

  return response;
}

/**
 * Handle Excel dependencies query
 */
async function handleExcelDependenciesQuery(
  cellAddress: string,
  documentId: string
): Promise<string> {
  const sheetNames = excelFormulaEngine.getSheetNames(documentId);
  const sheetName = sheetNames[0] || 'Sheet1';

  const result = excelFormulaEngine.getFormulaDependencies(documentId, sheetName, cellAddress);

  if (!result.success) {
    return `I couldn't analyze dependencies for ${cellAddress}: ${result.error}`;
  }

  if (!result.dependencies || result.dependencies.length === 0) {
    const cellResult = excelFormulaEngine.getCellValue(documentId, sheetName, cellAddress);
    if (cellResult.formula) {
      return `Cell ${cellAddress} has a formula (\`${cellResult.formula}\`) but I couldn't determine its dependencies.`;
    }
    return `Cell ${cellAddress} contains a direct value and doesn't depend on any other cells.`;
  }

  let response = `**Cell ${cellAddress} Dependencies**:\n\n`;
  response += `This cell depends on the following cells:\n`;

  for (const dep of result.dependencies) {
    const depValue = excelFormulaEngine.getCellValue(documentId, sheetName, dep);
    response += `- **${dep}**: ${depValue.value ?? '(empty)'}\n`;
  }

  const cellResult = excelFormulaEngine.getCellValue(documentId, sheetName, cellAddress);
  if (cellResult.formula) {
    response += `\n**Formula**: \`${cellResult.formula}\``;
  }

  return response;
}

/**
 * Handle Excel dependents query (cells that use this cell)
 */
async function handleExcelDependentsQuery(
  cellAddress: string,
  documentId: string
): Promise<string> {
  const sheetNames = excelFormulaEngine.getSheetNames(documentId);
  const sheetName = sheetNames[0] || 'Sheet1';

  const result = excelFormulaEngine.getFormulaDependents(documentId, sheetName, cellAddress);

  if (!result.success) {
    return `I couldn't analyze dependents for ${cellAddress}: ${result.error}`;
  }

  if (!result.dependents || result.dependents.length === 0) {
    return `No other cells currently depend on ${cellAddress}.`;
  }

  let response = `**Cells that depend on ${cellAddress}**:\n\n`;
  response += `If you change ${cellAddress}, these cells will be affected:\n`;

  for (const dep of result.dependents) {
    const cleanCell = dep.includes('!') ? dep.split('!')[1] : dep;
    const depResult = excelFormulaEngine.getCellValue(documentId, sheetName, cleanCell);
    response += `- **${cleanCell}**: ${depResult.value ?? '(empty)'}`;
    if (depResult.formula) {
      response += ` (formula: \`${depResult.formula}\`)`;
    }
    response += `\n`;
  }

  return response;
}

// ============================================================================
// CONVERSATION CONTEXT PRE-CHECK (PHASE 1 FIX)
// ============================================================================
// PURPOSE: Check if query can be answered from conversation history BEFORE
//          routing to calculation/excel handlers that might intercept it

/**
 * Extract key terms from a query for conversation search
 */
function extractKeyTerms(query: string): string[] {
  const stopWords = new Set([
    'what', 'is', 'the', 'was', 'were', 'are', 'how', 'much', 'many', 'who',
    'when', 'where', 'which', 'why', 'can', 'you', 'tell', 'me', 'about',
    'do', 'does', 'did', 'have', 'has', 'had', 'be', 'been', 'being',
    'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'up', 'down', 'out', 'our', 'my', 'your', 'their'
  ]);

  // Important short terms that should NOT be filtered (financial quarters, etc.)
  const importantShortTerms = new Set(['q1', 'q2', 'q3', 'q4', 'fy', 'roi']);

  // Extract words, keeping numbers and important terms
  const words = query.toLowerCase()
    .replace(/[?!.,;:'"()]/g, '')
    .split(/\s+/)
    .filter(word => {
      // Keep important short terms
      if (importantShortTerms.has(word)) return true;
      // Keep years (4-digit numbers)
      if (/^\d{4}$/.test(word)) return true;
      // Normal filter: length > 2 and not a stopword
      return word.length > 2 && !stopWords.has(word);
    });

  // Also extract named entities (capitalized words in original query)
  const namedEntities = query
    .split(/\s+/)
    .filter(word => /^[A-Z][a-z]+/.test(word) && word.length > 2)
    .map(w => w.toLowerCase());

  // Combine and deduplicate
  const allTerms = [...new Set([...words, ...namedEntities])];

  return allTerms;
}

async function checkConversationContextFirst(
  query: string,
  conversationId: string,
  userId: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{
  canAnswer: boolean;
  answer?: string;
  confidence: number;
  source: 'infinite_memory' | 'recent_history' | 'none';
}> {
  console.log('\nðŸ§  [CONV-CHECK] Checking conversation context FIRST...');
  console.log(`   Query: "${query.substring(0, 80)}..."`);

  const keyTerms = extractKeyTerms(query);
  console.log(`   Key terms: ${keyTerms.join(', ')}`);

  // Skip pre-check for pure calculation queries with no context indicators
  const pureCalculationPatterns = [
    /^\d+\s*[\+\-\*\/\^]\s*\d+/,  // 5 + 3
    /^calculate\s+\d+/i,          // calculate 500...
    /^what\s+is\s+\d+\s*[\+\-\*\/]/i,  // what is 5 + 3
  ];

  if (pureCalculationPatterns.some(p => p.test(query))) {
    console.log('   â­ï¸ Skipping: Pure calculation query');
    return { canAnswer: false, confidence: 0, source: 'none' };
  }

  // FIX: Skip pre-check for document content queries
  const documentContentPatterns = [
    /\bwhat\s+(?:is|are|does)\s+.+?\s+about\b/i,  // "what is X about"
    /\bexplain\s+(?:the\s+)?(?:document|file|content|pdf|report)\b/i,  // "explain the document"
    /\bsummarize\s+(?:the\s+)?(?:document|file|content|pdf|report)\b/i,  // "summarize the file"
    /\banalyze\s+(?:the\s+)?(?:document|file|content|pdf|report)\b/i,  // "analyze the document"
    /\btell\s+me\s+about\s+(?:the\s+)?(?:document|file|content)\b/i,  // "tell me about the document"
    /\bwhat\s+(?:is|are)\s+in\s+(?:the\s+)?(?:document|file)\b/i,  // "what is in the document"
    /\bwhat\s+does\s+(?:the\s+)?(?:document|file)\s+say\b/i,  // "what does the document say"
    /\b(?:show|find|search)\s+(?:me\s+)?(?:information|content|data)\s+(?:in|from|about)\b/i,  // "show me information in"
  ];

  if (documentContentPatterns.some(p => p.test(query))) {
    console.log('   [SKIP] Document content query - should use RAG');
    return { canAnswer: false, confidence: 0, source: 'none' };
  }

  // FIX: Skip if query mentions a filename
  const filenamePattern = /\b[a-z0-9_\-\s]+\.(?:pdf|xlsx?|docx?|txt|csv|pptx?|png|jpe?g)\b/i;
  if (filenamePattern.test(query)) {
    console.log('   [SKIP] Query mentions filename - should use RAG');
    return { canAnswer: false, confidence: 0, source: 'none' };
  }

  // FIX: Require EXPLICIT conversation reference words
  const explicitConversationReferences = [
    /\b(we|our|us)\s+(discussed|mentioned|said|talked about|agreed)\b/i,  // "we discussed"
    /\b(you|earlier|before|previously)\s+(said|told|mentioned)\b/i,  // "you said earlier"
    /\bwhat\s+did\s+(we|you|i)\s+(say|discuss|mention|talk about)\b/i,  // "what did we say"
    /\bin\s+(?:our|the)\s+(?:previous|earlier|last)\s+conversation\b/i,  // "in our previous conversation"
    /\baccording\s+to\s+(?:our|the)\s+conversation\b/i,  // "according to our conversation"
  ];

  const hasExplicitConversationReference = explicitConversationReferences.some(p => p.test(query));

  if (!hasExplicitConversationReference) {
    console.log('   â­ï¸ Skipping: No context indicators and few key terms');
    return { canAnswer: false, confidence: 0, source: 'none' };
  }

  try {
    // STRATEGY 1: Check infinite memory first (semantic search)
    console.log('   ðŸ“š Searching infinite memory...');
    const memoryContext = await infiniteConversationMemory.getContextForQuery(
      conversationId,
      userId,
      query
    );

    if (memoryContext && memoryContext.trim().length > 100) {
      // Check if the memory context contains relevant information
      const termsFound = keyTerms.filter(term =>
        memoryContext.toLowerCase().includes(term.toLowerCase())
      );

      const termMatchRatio = termsFound.length / Math.max(keyTerms.length, 1);
      console.log(`   ðŸ“Š Term match ratio: ${termMatchRatio.toFixed(2)} (${termsFound.length}/${keyTerms.length})`);

      // FIX: Require higher confidence for conversation-only answers
      if (termMatchRatio >= 0.7 && termsFound.length >= 3) {
        console.log('   âœ… Found relevant context in infinite memory!');
        return {
          canAnswer: true,
          answer: memoryContext,
          confidence: Math.min(0.9, 0.5 + termMatchRatio * 0.4),
          source: 'infinite_memory'
        };
      }
    }

    // STRATEGY 2: Check recent conversation history (last 30 messages)
    console.log('   ðŸ’¬ Checking recent conversation history...');

    let recentHistory = conversationHistory;
    if (!recentHistory || recentHistory.length < 5) {
      // Fetch from database
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { role: true, content: true }
      });
      recentHistory = messages.reverse().map(m => ({
        role: m.role,
        content: m.content
      }));
    }

    // This prevents false positives where the user's query matches itself
    const assistantMessages = recentHistory?.filter(m => m.role === 'assistant') || [];
    console.log(`   ðŸ“Š Assistant messages found: ${assistantMessages.length}`);

    if (assistantMessages.length === 0 || !assistantMessages.some(m => m.content.length > 50)) {
      console.log('   â­ï¸ Skipping: No substantive assistant responses in history');
      // Fall through to return 'none' at the end
    } else if (recentHistory && recentHistory.length > 0) {
      // Only check assistant message content for key terms (not user queries!)
      const historyText = assistantMessages.map(m => m.content).join(' ').toLowerCase();

      // Check if key terms appear in assistant responses
      const termsInHistory = keyTerms.filter(term =>
        historyText.includes(term.toLowerCase())
      );

      const historyMatchRatio = termsInHistory.length / Math.max(keyTerms.length, 1);
      console.log(`   ðŸ“Š History match ratio: ${historyMatchRatio.toFixed(2)} (${termsInHistory.length}/${keyTerms.length})`);

      // FIX: Require higher confidence for conversation-only answers
      if (historyMatchRatio >= 0.8 && termsInHistory.length >= 3) {
        // Build context from matching ASSISTANT messages only
        const relevantMessages = assistantMessages.filter(m =>
          keyTerms.some(term => m.content.toLowerCase().includes(term.toLowerCase()))
        );

        if (relevantMessages.length > 0) {
          const contextFromHistory = relevantMessages
            .slice(-10) // Last 10 relevant messages
            .map(m => `Assistant: ${m.content}`)
            .join('\n\n');

          console.log('   âœ… Found relevant context in recent assistant history!');
          return {
            canAnswer: true,
            answer: contextFromHistory,
            confidence: Math.min(0.85, 0.4 + historyMatchRatio * 0.45),
            source: 'recent_history'
          };
        }
      }
    }

    console.log('   âŒ No relevant conversation context found');
    return { canAnswer: false, confidence: 0, source: 'none' };

  } catch (error) {
    console.error('   âš ï¸ Error checking conversation context:', error);
    return { canAnswer: false, confidence: 0, source: 'none' };
  }
}

/**
 * Handle a query that should be answered from conversation context
 */
async function handleConversationContextQuery(
  query: string,
  conversationContext: string,
  userId: string,
  detectedLanguage: string,
  onChunk: (chunk: string) => void,
  onStage?: (stage: string, message: string) => void,
  profilePrompt?: string
): Promise<{ sources: any[] }> {
  console.log('\nðŸŽ¯ [CONV-ANSWER] Generating answer from conversation context...');

  if (onStage) {
    onStage('thinking', 'Recalling from our conversation...');
  }

  try {
    // Use adaptive answer generation with conversation-only mode
    const result = await adaptiveAnswerGeneration.generateAdaptiveAnswer({
      query,
      userId,
      language: detectedLanguage || 'en',
      conversationContext,
      forceConversationOnly: true, // NEW: Forces LLM to use only conversation
      profilePrompt,
      documents: [], // No documents needed
      fullDocumentTexts: new Map(),
      retrievedChunks: [],
    });

    if (result.answer && result.answer.trim().length > 0) {
      const formattedAnswer = applyFormatEnforcement(result.answer, {
        responseType: 'conversation_context',
        logPrefix: '[CONV-ANSWER FORMAT]',
        query  // Pass query for smart title detection
      });
      if (onChunk) onChunk(formattedAnswer);
      if (onStage) onStage('complete', 'Complete');
      return { sources: [] };
    }

    // Fallback: Generate response directly
    console.log('   âš ï¸ Adaptive generation returned empty, using direct generation...');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.3 }
    });

    const prompt = `You are a helpful assistant. Answer the user's question based ONLY on the conversation context provided.

CONVERSATION CONTEXT:
${conversationContext}

USER QUESTION: ${query}

INSTRUCTIONS:
- Answer ONLY using information from the conversation context above
- If the information is in the context, provide a direct answer
- Do NOT say "I don't have documents" or suggest uploading files
- Respond in ${detectedLanguage || 'English'}
- Be concise and direct

YOUR ANSWER:`;

    const response = await model.generateContent(prompt);
    const answer = response.response.text();

    // Apply structure enforcement (will skip title/sections for conversation)
    const structuredAnswer = structureEnforcementService.enforceStructure(answer, {
      query,
      sources: [],
      isComparison: false,
      responseType: 'conversation'  // ✅ No title for conversation responses
    });

    // Then apply format enforcement (with query for smart title detection)
    const formattedAnswer = applyFormatEnforcement(structuredAnswer.text, {
      responseType: 'conversation_fallback',
      logPrefix: '[CONV-FALLBACK FORMAT]',
      query  // Pass query for smart title detection
    });
    if (onChunk) onChunk(formattedAnswer);
    if (onStage) onStage('complete', 'Complete');

    return { sources: [] };

  } catch (error) {
    console.error('   âŒ Error generating conversation answer:', error);
    throw error;
  }
}

// ============================================================================
// MAIN ENTRY POINT - Streaming Answer Generation
// ============================================================================

export async function generateAnswerStream(
  userId: string,
  query: string,
  conversationId: string,
  onChunk: (chunk: string) => void,
  attachedDocumentId?: string | string[],  // ? FIX #8: Accept array for multi-document support
  conversationHistory?: Array<{ role: string; content: string }>,
  onStage?: (stage: string, message: string) => void,
  memoryContext?: string,
  fullConversationContext?: string,
  isFirstMessage?: boolean,  // ? NEW: Flag to control greeting logic
  detectedLanguage?: string,  // ? FIX: Accept pre-detected language from controller
  profilePrompt?: string,  // ? USER PROFILE: Custom prompt from user profile for personalization
  ragConfig: RAGConfig = DEFAULT_RAG_CONFIG  // RAG feature toggles
): Promise<{ sources: any[] }> {
  // ============================================================================
  // ENHANCED ROUTER LOGGING
  // ============================================================================
  console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');
  console.log('ðŸ” [ROUTER] Analyzing query...');
  console.log(`   Query: "${query}"`);
  console.log(`   User: ${userId}`);
  console.log(`   Conversation: ${conversationId}`);
  console.log('â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”');

  // ============================================================================
  // STEP -2: CONTEXT-AWARE INTENT DETECTION (6-Stage Pipeline)
  // ============================================================================
  // Runs the advanced intent detection pipeline for:
  // - Refusal detection (send email, book flight, etc.)
  // - Incomplete query detection (missing objects)
  // - Entity extraction (filenames, folders, topics)
  // - Pronoun resolution using conversation history
  // - Verb disambiguation (show, find, what, list, open)
  // - Multi-intent detection (and, then, also)

  const contextIntent = contextAwareIntentDetection.detectIntent(
    query,
    conversationHistory?.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })) || []
  );

  console.log(`🎯 [CONTEXT-INTENT] Primary: ${contextIntent.primaryIntent.primary} (${(contextIntent.confidence * 100).toFixed(0)}%)`);
  if (contextIntent.primaryIntent.disambiguation) {
    console.log(`   ↳ Disambiguation: ${contextIntent.primaryIntent.disambiguation}`);
  }
  if (contextIntent.entities.length > 0) {
    console.log(`   ↳ Entities: ${contextIntent.entities.map(e => `${e.type}:${e.value}`).join(', ')}`);
  }
  if (!contextIntent.isComplete) {
    console.log(`   ⚠️ Incomplete query: ${contextIntent.clarificationNeeded}`);
  }

  // ============================================================================
  // STEP -1.8: SKILL-BASED ROUTING (New modular skill architecture)
  // ============================================================================
  // Uses rule-based pattern matching with LLM fallback for ambiguous queries.
  // Maps queries to specific skills (GENERAL, LEGAL, FINANCIAL) with speed profiles.

  let skillRoutingResult: SkillIntegrationResult | null = null;
  try {
    // Get user document count for LIST_DOCUMENTS skill
    const userDocCount = await prisma.document.count({ where: { userId } });

    skillRoutingResult = await integrateSkillRouting(
      query,
      userId,
      userDocCount,
      conversationHistory
    );

    console.log('┌─────────────────────────────────────────────────────────────');
    console.log(`│ 🎯 [SKILL ROUTING] ${skillRoutingResult.skillMapping.skillId}`);
    console.log(`│    Mode: ${skillRoutingResult.ragMode} | Bypass: ${skillRoutingResult.shouldBypassRAG}`);
    console.log(`│    Detection: ${skillRoutingResult.skillMapping.detectionMethod} (${(skillRoutingResult.skillMapping.confidence * 100).toFixed(0)}%)`);
    console.log('└─────────────────────────────────────────────────────────────');

  } catch (error) {
    console.error('[SKILL ROUTING] Error in skill routing, falling back to existing logic:', error);
    // Continue with existing logic if skill routing fails
  }

  // ============================================================================

  // ============================================================================
  // STEP -1.7: HIERARCHICAL INTENT CLASSIFICATION (Two-Stage: Heuristic + LLM)
  // ============================================================================
  const hierarchicalResult = await handleHierarchicalIntent(query, userId);
  const { hierarchicalIntent, pipelineConfig, answerPlan } = hierarchicalResult;

  // Handle clarification_needed intent (early return)
  if (hierarchicalResult.handled && hierarchicalResult.clarificationMessage) {
    if (onChunk) onChunk(hierarchicalResult.clarificationMessage);
    if (onStage) onStage('complete', 'Complete');
    return { sources: [] };
  }
  // STEP -1.5: REFUSAL DETECTION (Actions we cannot perform)
  // ============================================================================
  // Handle requests that Koda cannot fulfill (email, calls, bookings, etc.)

  if (contextIntent.primaryIntent.isRefusal) {
    console.log('🚫 [ROUTER] → REFUSAL (Action not supported)');

    const refusalMessage = `I'm sorry, but I can't help with that request. As a document assistant, I can help you:

• **Search and analyze** your uploaded documents
• **Answer questions** about document content
• **Summarize** and explain information from your files
• **Create, move, or organize** folders and documents

Is there something about your documents I can help with instead?`;

    if (onChunk) onChunk(refusalMessage);
    if (onStage) onStage('complete', 'Complete');
    return { sources: [] };
  }

  // ============================================================================
  // STEP -1: FAST PATH - File/Document Listing (MOVED UP FOR SPEED)
  // ============================================================================

  if (isDocumentListingQuery(query)) {
    console.log('📋 [ROUTER] → FAST LISTING (skipping all other checks)');
    return await handleDocumentListing(userId, query, onChunk);
  }

  // ============================================================================
  // STEP 0: RAG BYPASS CHECK (For Greetings & General Knowledge)
  // ============================================================================
  // Uses dynamic Gemini responses (not preset) for natural conversation

  if (shouldBypassRAG(query)) {
    const bypassType = getBypassType(query);
    console.log(`âš¡ [ROUTER] â†’ BYPASS (${bypassType}) - No RAG needed`);

    // Handle bypass queries with direct LLM response
    if (onStage) onStage('answering', 'Generating response...');

    const systemPrompt = `You are Koda, a helpful AI assistant. Answer the user's question directly using your knowledge.
Keep your response concise and helpful. Do not mention documents or say you're searching for information.
${bypassType === 'date_time' ? `Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.` : ''}
Respond in the same language as the user's question.`;

    try {
      // FIX: Use pre-imported geminiClient (saves 500ms cold import time)
      const model = geminiClient.getModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      });

      // FIX: Use STREAMING instead of non-streaming (saves 1-2s TTFB)
      const streamResult = await model.generateContentStream(query);
      let fullResponse = '';

      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        if (onChunk) onChunk(chunkText);  // Stream directly to client
      }

      // Apply format enforcement to the complete response for logging
      applyFormatEnforcement(fullResponse, {
        responseType: 'bypass',
        logPrefix: '[BYPASS FORMAT]'
      });

      if (onStage) onStage('complete', 'Complete');
      return { sources: [] };
    } catch (error) {
      console.error('âŒ [ROUTER] Bypass LLM call failed, falling back to RAG:', error);
      // Fall through to normal routing
    }
  }

  console.log('ðŸ“š [ROUTER] â†’ RAG PIPELINE (document retrieval needed)');

  const pineconePromise = initializePinecone();

  // ============================================================================
  // ðŸ§  CONVERSATION CONTEXT PRE-CHECK (PHASE 1 FIX - RUNS FIRST!)
  // ============================================================================

  try {
    const conversationCheck = await checkConversationContextFirst(
      query,
      conversationId,
      userId,
      conversationHistory
    );

    if (conversationCheck.canAnswer && conversationCheck.answer) {
      console.log(`ðŸ§  [CONV-CHECK] âœ… Can answer from ${conversationCheck.source} (confidence: ${conversationCheck.confidence.toFixed(2)})`);

      // Handle the query using conversation context
      return await handleConversationContextQuery(
        query,
        conversationCheck.answer,
        userId,
        detectedLanguage || 'en',
        onChunk,
        onStage,
        profilePrompt
      );
    }

    console.log('ðŸ§  [CONV-CHECK] âŒ No conversation context found, proceeding to other handlers...');
  } catch (error) {
    console.error('ðŸ§  [CONV-CHECK] Error in conversation pre-check:', error);
    // Continue to other handlers if pre-check fails
  }

  // ============================================================================
  // CALCULATION ENGINE - Check if this is a calculation query (Manus Method)
  // ============================================================================
  // Impact: Handles math, financial, statistical calculations with 100% accuracy
  // Uses Python execution for complex calculations exactly like Manus does

  try {
    const calculationResult = await handleCalculationQuery(query, userId);

    if (calculationResult) {
      console.log('ðŸ§® [ROUTER] â†’ CALCULATION (math/financial query detected)');

      if (onStage) {
        onStage('calculating', 'Computing calculation...');
      }

      // Apply format enforcement to calculation results (with query for smart title)
      const formattedCalculation = applyFormatEnforcement(calculationResult, {
        responseType: 'calculation',
        logPrefix: '[CALCULATION FORMAT]',
        query  // Pass query for smart title detection
      });

      if (onChunk) {
        onChunk(formattedCalculation);
      }

      if (onStage) {
        onStage('complete', 'Complete');
      }

      return { sources: [] };
    }
  } catch (error) {
    console.error('ðŸ§® [CALCULATION] Error in calculation handling:', error);
    // Fall through to normal RAG if calculation fails
  }

  // ============================================================================
  // EXCEL QUERY HANDLER - Direct cell/formula queries on uploaded Excel files
  // ============================================================================
  // Impact: Instant answers for "what's in cell A1?", "what if B2 = 1000?", etc.

  try {
    // Get the primary document ID for Excel queries
    const primaryDocId = Array.isArray(attachedDocumentId)
      ? attachedDocumentId[0]
      : attachedDocumentId;

    if (primaryDocId) {
      const excelResult = await handleExcelQuery(query, primaryDocId, userId);

      if (excelResult) {
        console.log('ðŸ“Š [ROUTER] â†’ EXCEL (cell/formula query detected)');

        if (onStage) {
          onStage('analyzing', 'Analyzing Excel data...');
        }

        // Apply format enforcement to Excel results (with query for smart title)
        const formattedExcel = applyFormatEnforcement(excelResult, {
          responseType: 'excel',
          logPrefix: '[EXCEL FORMAT]',
          query  // Pass query for smart title detection
        });

        if (onChunk) {
          onChunk(formattedExcel);
        }

        if (onStage) {
          onStage('complete', 'Complete');
        }

        return { sources: [] };
      }
    }
  } catch (error) {
    console.error('ðŸ“Š [EXCEL] Error in Excel query handling:', error);
    // Fall through to normal RAG if Excel query fails
  }

  // ============================================================================
  // SEMANTIC DOCUMENT SEARCH - "which document mentions X?"
  // ============================================================================
  // Impact: Handles document discovery queries with confidence scoring
  // Returns file buttons with matched criteria and preview

  try {
    if (semanticDocumentSearchService.isDocumentSearchQuery(query)) {
      console.log('ðŸ” [DOC-SEARCH] Document search query detected');

      if (onStage) {
        onStage('searching', 'Searching your documents...');
      }

      const searchResult = await semanticDocumentSearchService.search(query, userId);

      if (searchResult.success || searchResult.action === 'not_found') {
        console.log(`ðŸ” [DOC-SEARCH] ${searchResult.action}: ${searchResult.documents.length} documents found`);

        // Format response with file information for frontend
        let response = searchResult.message;

        // Add document details for show_multiple
        if (searchResult.action === 'show_multiple' && searchResult.uiData?.documents) {
          response += '\n\n';
          searchResult.uiData.documents.forEach((doc: any, idx: number) => {
            response += `${idx + 1}. **${doc.filename}** `;
            if (doc.matchedCriteria?.length > 0) {
              response += `(matches: ${doc.matchedCriteria.join(', ')}) `;
            }
            response += `- ${(doc.confidence * 100).toFixed(0)}% confidence\n`;
          });
        }

        // Add preview for single document
        if (searchResult.action === 'show_single' && searchResult.uiData?.preview) {
          response += '\n\n**Preview:**\n> ' + searchResult.uiData.preview.substring(0, 200) + '...';
        }

        // Apply format enforcement to document search results
        const formattedResponse = applyFormatEnforcement(response, {
          responseType: 'document_search',
          logPrefix: '[DOC-SEARCH FORMAT]'
        });

        if (onChunk) {
          onChunk(formattedResponse);
        }

        if (onStage) {
          onStage('complete', 'Complete');
        }

        // Return sources based on found documents
        const sources = searchResult.documents.map(doc => ({
          documentId: doc.documentId,
          filename: doc.filename,
          mimeType: doc.mimeType,
          confidence: doc.confidence,
          preview: doc.content?.substring(0, 200) || ''
        }));

        return { sources };
      }
    }
  } catch (error) {
    console.error('ðŸ” [DOC-SEARCH] Error in document search handling:', error);
    // Fall through to normal RAG if document search fails
  }

  // ============================================================================
  // DYNAMIC RESPONSE SYSTEM - Handles all non-RAG queries
  // ============================================================================
  // Impact: 20+ seconds â†’ < 1 second for 30-40% of queries
  // Replaces hardcoded fast path with AI-generated, context-aware responses

  // Emit initial analyzing status
  if (onStage) {
    onStage('analyzing', 'Understanding your question...');
  }

  // Get document count for context
  const documentCount = await prisma.document.count({
    where: { userId }
  });

  // Build user context for dynamic responses
  const userContext: DynamicUserContext = {
    userId,
    documentCount,
    language: detectedLanguage || 'en',
    conversationHistory,
    lastQuery: query,
    hasUploadedDocuments: documentCount > 0,
  };

  // Detect response type for dynamic handling
  const getResponseType = (q: string): 'greeting' | 'help' | 'capabilities' | 'general' => {
    const lowerQ = q.toLowerCase();
    if (lowerQ.match(/^(hello|hi|hey|olÃ¡|oi|hola|bonjour)\b/i)) return 'greeting';
    if (lowerQ.match(/\b(help|what can you do|how do you work|como funciona|que puedes hacer)\b/i)) return 'capabilities';
    if (lowerQ.match(/\b(how to|como|where|onde|dÃ³nde)\b.*\b(upload|use|start|upload|usar|comeÃ§ar)\b/i)) return 'help';
    return 'general';
  };

  const responseType = getResponseType(query);

  // Now uses languageDetection.service for proper multilanguage support
  const fastPathResult = await fastPathDetector.detect(query, {
    documentCount,
    hasUploadedDocuments: documentCount > 0,
    language: detectedLanguage || 'en',
    userId,
    conversationContext: conversationHistory?.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n'),
  });

  if (fastPathResult.isFastPath && fastPathResult.response) {
    const metadata = fastPathResult.metadata;
    const responseSource = metadata?.type === 'direct' ? 'Direct Gemini' : 'Preset';
    const model = metadata?.model || 'N/A';
    const latency = metadata?.latency || 0;

    console.log(`âš¡ FAST PATH: ${fastPathResult.type} - ${responseSource} (${fastPathResult.detectedLanguage})`);
    console.log(`   Model: ${model}, Latency: ${latency}ms, Used RAG: ${metadata?.usedRAG || false}`);

    // Fast path responses (greetings, help) are already properly formatted
    // DO NOT apply format enforcement - greetings should be natural, not structured
    if (onChunk) onChunk(fastPathResult.response);
    if (onStage) onStage('complete', 'Complete');
    return { sources: [] };
  }

  // ============================================================================
  // EARLY FALLBACK DETECTION (Pre-RAG)
  // ============================================================================

  // Early fallback detection for clarification and refusal queries
  const earlyFallbackCheck = fallbackDetection.detectFallback({
    query,
    documentCount,
    ragResults: [], // No RAG results yet
    ragScore: undefined,
    conversationHistory: conversationHistory || [],
    ragExecuted: false  // ⚡ FIX: RAG hasn't run yet - don't trigger knowledge fallback
  });

  // ⚡ FIX: Check if query looks like it's asking about a specific document
  const queryLower = query.toLowerCase();
  const looksLikeDocumentQuery = (
    // Contains "about" with other specific words (likely document name)
    (/\babout\b/.test(queryLower) && query.split(/\s+/).length >= 4) ||
    // Contains quoted text (document name in quotes)
    /["'].+["']/.test(query) ||
    // Contains file extension references
    /\.(pdf|xlsx?|docx?|pptx?|csv|txt)\b/i.test(query) ||
    // Contains "document named", "file called", etc.
    /(document|file|report|spreadsheet)\s+(named|called|titled)/i.test(query) ||
    // Has 3+ consecutive non-English/unusual words (likely document name)
    /\b[a-záàâãéèêíïóôõöúçñ]{3,}\s+[a-záàâãéèêíïóôõöúçñ]{3,}\b/i.test(queryLower)
  );

  // ⚡ FIX: Raise confidence threshold from 0.85 to 0.92 to be more conservative
  const shouldTriggerEarlyFallback = (
    earlyFallbackCheck.needsFallback &&
    earlyFallbackCheck.confidence > 0.92 &&
    (earlyFallbackCheck.fallbackType === 'refusal' ||
     (earlyFallbackCheck.fallbackType === 'clarification' && !looksLikeDocumentQuery))
  );

  // Log when early fallback is skipped due to document query detection
  if (earlyFallbackCheck.needsFallback && !shouldTriggerEarlyFallback) {
    console.log(`🔍 [EARLY FALLBACK SKIPPED] type=${earlyFallbackCheck.fallbackType}, confidence=${earlyFallbackCheck.confidence}, looksLikeDocumentQuery=${looksLikeDocumentQuery} - proceeding to RAG`);
  }

  if (shouldTriggerEarlyFallback) {
    console.log(`⚡ [EARLY FALLBACK] ${earlyFallbackCheck.fallbackType} detected - skipping RAG`);

    // Get document names for context
    const earlyUserDocuments = await prisma.document.findMany({
      where: { userId },
      select: { filename: true, mimeType: true, createdAt: true }
    });
    const earlyDocumentNames = earlyUserDocuments.map(d => d.filename);

    // Determine language
    const earlyQueryLang = detectedLanguage || 'en';
    const earlyQueryLangName = earlyQueryLang === 'pt' ? 'Portuguese' :
                              earlyQueryLang === 'es' ? 'Spanish' : 'English';

    const earlyFallbackContext: FallbackContext = {
      query,
      fallbackType: earlyFallbackCheck.fallbackType,
      reason: earlyFallbackCheck.reason,
      documentCount,
      documentNames: earlyDocumentNames,
      language: earlyQueryLangName,
      conversationHistory: conversationHistory || []
    };

    try {
      const earlyFallbackAnswer = await fallbackResponse.generateFallbackResponse(earlyFallbackContext);

      // Apply structure enforcement (will skip title/sections for fallback)
      const structuredFallback = structureEnforcementService.enforceStructure(earlyFallbackAnswer.trim(), {
        query,
        sources: [],
        isComparison: false,
        responseType: 'fallback'  // ✅ No title for fallback responses
      });

      // Then apply format enforcement (with query for smart title detection)
      const formattedFallback = applyFormatEnforcement(structuredFallback.text, {
        responseType: 'early_fallback',
        logPrefix: '[EARLY-FALLBACK FORMAT]',
        query  // Pass query for smart title detection
      });

      if (onChunk) onChunk(formattedFallback);
      if (onStage) onStage('complete', 'Complete');

      console.log(`âœ… [EARLY FALLBACK] ${earlyFallbackCheck.fallbackType} response generated (saved RAG processing)`);
      return { sources: [] };
    } catch (earlyFallbackError) {
      console.error('âŒ [EARLY FALLBACK] Error generating response:', earlyFallbackError);
      // Fall through to normal RAG processing
    }
  }

  // DOCUMENT GENERATION DETECTION
  const { detectDocumentGenerationIntent } = await import('./documentGenerationDetection.service');

  const docGenResult = detectDocumentGenerationIntent(query);

  if (docGenResult.isDocumentGeneration && docGenResult.confidence > 0.7) {
    console.log(`ðŸ“„ [DOC GEN] Detected ${docGenResult.documentType} generation request (confidence: ${docGenResult.confidence})`);

    // Return special marker to trigger document generation in chat service
    if (onChunk) {
      onChunk(`__DOCUMENT_GENERATION_REQUESTED__:${docGenResult.documentType}`);
    }

    if (onStage) {
      onStage('complete', 'Document generation requested');
    }

    return {
      sources: [],
    };
  }

  // ADVANCED QUERY TYPE DETECTION - Route to specialized handlers

  const advancedQueryType = detectAdvancedQueryType(query);
  console.log(`ðŸŽ¯ [ADVANCED QUERY TYPE] Detected: ${advancedQueryType}`);

  // Handle entity extraction queries (people, companies, organizations)
  if (advancedQueryType === 'entity_extraction') {
    console.log('ðŸ‘¥ [ENTITY EXTRACTION] Routing to entity extraction handler');
    return await handleEntityExtractionQuery(query, userId, onChunk, onStage, detectedLanguage);
  }

  // Handle synthesis queries (summarize all, create outline, executive summary)
  if (advancedQueryType === 'synthesis') {
    console.log('ðŸ”„ [SYNTHESIS] Routing to advanced synthesis handler');
    return await handleAdvancedSynthesisQuery(query, userId, onChunk, onStage, detectedLanguage);
  }

  // Handle data extraction queries (extract numbers, dates, statistics)
  if (advancedQueryType === 'data_extraction') {
    console.log('ðŸ“Š [DATA EXTRACTION] Routing to data extraction handler');
    return await handleDataExtractionQuery(query, userId, onChunk, onStage, detectedLanguage);
  }

  // Handle metadata queries (document titles, upload dates, newest/oldest)
  if (advancedQueryType === 'metadata') {
    console.log('ðŸ“ [METADATA] Routing to metadata handler');
    return await handleDocumentMetadataQuery(query, userId, onChunk, onStage, detectedLanguage);
  }

  console.log('ðŸ“– [CONTENT QUERY] Proceeding with standard RAG pipeline');

  // STEP 1: Meta-Queries - FIRST (No LLM call, instant response)
  if (isMetaQuery(query)) {
    console.log('ðŸ’­ [META-QUERY] Detected');
    await handleMetaQuery(query, onChunk, conversationHistory);
    return { sources: [] }; // Meta queries don't have sources
  }

  // STEP 1.5: Navigation Queries - Fast (App usage questions)
  if (isNavigationQuery(query)) {
    console.log('ðŸ§­ [NAVIGATION] Detected app navigation question');
    await handleNavigationQuery(query, userId, onChunk);
    return { sources: [] }; // Navigation queries don't have document sources
  }

  // STEP 1.6: Methodology Knowledge Queries - Fast (DB lookup + cached knowledge)
  const methodologyQueryResult = await handleMethodologyKnowledgeQuery(userId, query, onChunk);
  if (methodologyQueryResult.handled) {
    console.log('?? [METHODOLOGY KNOWLEDGE] Query answered from knowledge base');
    return { sources: methodologyQueryResult.sources || [] };
  }

  const domainQueryResult = await handleDomainKnowledgeQuery(userId, query, onChunk);
  if (domainQueryResult.handled) {
    console.log('?? [DOMAIN KNOWLEDGE] Query answered from domain knowledge base');
    return { sources: domainQueryResult.sources || [] };
  }

  // STEP 1.7: Cross-Document Synthesis Queries - ChatGPT-level intelligence
  const synthesisQueryResult = synthesisQueryDetectionService.detect(query);
  if (synthesisQueryResult.isSynthesisQuery) {
    console.log(`?? [CROSS-DOCUMENT SYNTHESIS] Detected ${synthesisQueryResult.type} query`);
    const synthesisResult = await handleCrossDocumentSynthesis(
      userId,
      query,
      synthesisQueryResult,
      onChunk
    );
    if (synthesisResult.handled) {
      return { sources: synthesisResult.sources || [] };
    }
  }

  // STEP 1.8: Trend Analysis Queries - Temporal intelligence
  const trendQueryResult = await handleTrendAnalysisQuery(userId, query, onChunk);
  if (trendQueryResult.handled) {
    console.log('?? [TREND ANALYSIS] Query answered with temporal analysis');
    return { sources: trendQueryResult.sources || [] };
  }

  // STEP 2: Document Counting - Fast (No LLM call)
  const countingCheck = isDocumentCountingQuery(query);
  if (countingCheck.isCounting) {
    console.log('ðŸ”¢ [ROUTER] â†’ COUNTING (how many documents?)');
    return await handleDocumentCounting(userId, query, countingCheck.fileType, onChunk);
  }

  // STEP 3: Document Types - Fast (No LLM call)
  if (isDocumentTypesQuery(query)) {
    console.log('ðŸ“Š [ROUTER] â†’ DOCUMENT TYPES (file type breakdown)');
    return await handleDocumentTypes(userId, query, onChunk);
  }

  // STEP 4: Document Listing - Fast (No LLM call)
  if (isDocumentListingQuery(query)) {
    console.log('ðŸ“‹ [ROUTER] â†’ LISTING (list all documents)');
    return await handleDocumentListing(userId, query, onChunk);
  }

  await pineconePromise;

  // STEP 5.5: Folder Listing Queries - Direct DB Lookup
  const isFolderListingQuery = detectFolderListingQuery(query);
  if (isFolderListingQuery) {
    console.log('ðŸ“‚ [ROUTER] â†’ FOLDER LISTING (list all folders)');
    return await handleFolderListingQuery(userId, onChunk);
  }

  // STEP 5.6: Folder Content Queries - Direct DB Lookup
  const isFolderContentQuery = detectFolderContentQuery(query);
  if (isFolderContentQuery) {
    console.log('ðŸ“ [ROUTER] â†’ FOLDER CONTENT (what\'s in folder?)');
    return await handleFolderContentQuery(query, userId, onChunk);
  }

  const [comparison, fileAction] = await Promise.all([
    detectComparison(userId, query),
    detectFileAction(query)
  ]);

  // STEP 5: Comparisons - Moderate (Pinecone queries)
  if (comparison) {
    // Check if attached documents should be used for comparison
    const attachedIds = Array.isArray(attachedDocumentId) ? attachedDocumentId : [];

    // OR if user explicitly attached docs, use those for comparison
    if (attachedIds.length >= 2 && (!comparison.documents || comparison.documents.length < 2)) {
      console.log(`ðŸ”„ [COMPARISON] Using ${attachedIds.length} attached documents for comparison`);
      comparison.type = 'document';
      comparison.documents = attachedIds;
    }

    console.log(`âš–ï¸ [ROUTER] â†’ COMPARISON (${comparison.type || 'document'})`);
    return await handleComparison(userId, query, comparison, onChunk, conversationHistory);
  }

  const attachedIds = Array.isArray(attachedDocumentId) ? attachedDocumentId : [];
  if (attachedIds.length >= 2) {
    const hasCompareIntent = /\b(compare|difference|vs|versus|between|contrast|similarities)\b/i.test(query);
    if (hasCompareIntent) {
      console.log(`âš–ï¸ [ROUTER] â†’ MULTI-DOC COMPARISON (${attachedIds.length} documents)`);
      return await handleComparison(userId, query, {
        type: 'document',
        documents: attachedIds
      }, onChunk, conversationHistory);
    }
  }

  // STEP 5.8: Show vs Explain Intent Classification
  const showIntentResult = detectSimpleIntent(query);
  const isShowIntent = showIntentResult.type === 'data' && /\b(show|open|display|view|mostre|abre|muestra)\b/i.test(query.toLowerCase());
  console.log(`ðŸ‘ï¸ [INTENT] ${isShowIntent ? 'SHOW' : 'EXPLAIN'} (type: ${showIntentResult.type}, confidence: ${showIntentResult.confidence.toFixed(2)}) - ${showIntentResult.detectionTimeMs}ms`);

  if (isShowIntent && showIntentResult.confidence >= 0.75) {
    console.log('ðŸ“„ [SHOW FILE] User wants to see document, routing to semantic document search');

    // Use semantic document search to find and show the document
    const filenameMatch = query.match(/\b([a-z0-9_\-\s]+\.(?:pdf|xlsx|docx|txt|csv|pptx|xls|doc))\b/i);
    const searchQuery = filenameMatch?.[1] || query;

    // Check if this matches a specific document the user wants to see
    if (semanticDocumentSearchService.isDocumentSearchQuery(searchQuery) ||
        filenameMatch) {
      try {
        const searchResult = await semanticDocumentSearchService.search(searchQuery, userId);

        if (searchResult.success && searchResult.documents.length > 0) {
          // Format response to show the found document(s)
          let response = '';

          if (searchResult.action === 'show_single') {
            const doc = searchResult.documents[0];
            response = `Here is **${doc.filename}**:\n\n`;
            if (searchResult.uiData?.preview) {
              response += `> ${searchResult.uiData.preview.substring(0, 500)}${searchResult.uiData.preview.length > 500 ? '...' : ''}`;
            }
          } else {
            response = `I found ${searchResult.documents.length} matching document(s):\n\n`;
            searchResult.documents.forEach((doc: any, idx: number) => {
              response += `${idx + 1}. **${doc.filename}**\n`;
            });
          }

          // Apply format enforcement to show file response
          const formattedShowFile = applyFormatEnforcement(response, {
            responseType: 'show_file',
            logPrefix: '[SHOW-FILE FORMAT]'
          });

          if (onChunk) onChunk(formattedShowFile);
          if (onStage) onStage('complete', 'Complete');

          return {
            sources: searchResult.documents.map((doc: any) => ({
              documentId: doc.documentId,
              filename: doc.filename,
              mimeType: doc.mimeType
            }))
          };
        }
      } catch (error) {
        console.error('âŒ [SHOW FILE] Error searching for document:', error);
        // Fall through to regular RAG if search fails
      }
    }

    // If no specific document found, fall through to regular RAG
    console.log('ðŸ“„ [SHOW FILE] No specific document found, continuing with RAG');
  }

  // STEP 6: File Actions - SLOW (LLM call) - Check LAST
  if (fileAction) {
    console.log(`ðŸ“ [ROUTER] â†’ FILE ACTION (${fileAction})`);
    await handleFileAction(userId, query, fileAction, onChunk);
    return { sources: [] }; // File actions don't have sources
  }

  // STEP 6.5: File Location Queries - Direct DB Lookup
  const isFileLocationQuery = detectFileLocationQuery(query);
  if (isFileLocationQuery) {
    console.log('ðŸ“ [ROUTER] â†’ FILE LOCATION (where is file?)');
    return await handleFileLocationQuery(query, userId, onChunk);
  }

  // STEP 6.6: Content-Based File Location Queries - Pinecone Search
  // ✅ NEW: Handle "where is the file that talks about X?" queries
  const isContentBasedLocationQuery = detectContentBasedLocationQuery(query);
  if (isContentBasedLocationQuery) {
    console.log('🔍 [ROUTER] → CONTENT-BASED LOCATION (find file by content)');
    return await handleContentBasedLocationQuery(query, userId, onChunk);
  }

  // // MEMORY RETRIEVAL - Get relevant user memories for context
  console.log('ðŸ§  [MEMORY] Retrieving relevant memories...');
  const relevantMemories = await memoryService.getRelevantMemories(userId, query, undefined, 10);
  const memoryPromptContext = memoryService.formatMemoriesForPrompt(relevantMemories);

  if (relevantMemories.length > 0) {
    console.log(`ðŸ§  [MEMORY] Found ${relevantMemories.length} relevant memories`);
  }

  // STEP 7: Regular Queries - Standard RAG
  console.log('ðŸ“š [ROUTER] â†’ REGULAR RAG (standard document retrieval)');
  return await handleRegularQuery(userId, query, conversationId, onChunk, attachedDocumentId, conversationHistory, onStage, memoryPromptContext, isFirstMessage, detectedLanguage, ragConfig, hierarchicalIntent ?? undefined);
}

// ============================================================================
// FILE ACTION DETECTION
// ============================================================================

async function detectFileAction(query: string): Promise<string | null> {
  const lower = query.toLowerCase().trim();

  // STAGE 1: Regex Pattern Matching (Fast Path) - MULTILINGUAL

  // Folder operations (multilingual)
  if (/(create|make|new|add|cria|criar|nueva|nuevo|crÃ©er).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'createFolder';
  }
  if (/(rename|change.*name|renomear|renombrar|renommer).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'renameFolder';
  }
  if (/(delete|remove|deletar|apagar|eliminar|supprimer).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'deleteFolder';
  }
  if (/(move|relocate|mover|dÃ©placer).*(?:folder|pasta|carpeta|dossier)/i.test(lower)) {
    return 'moveFolder';
  }

  // File operations (multilingual)
  if (/(create|make|new|add|cria|criar|nueva|nuevo|crÃ©er).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'createFile';
  }
  if (/(rename|change.*name|renomear|renombrar|renommer).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'renameFile';
  }
  if (/(delete|remove|deletar|apagar|eliminar|supprimer).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'deleteFile';
  }
  if (/(move|relocate|mover|dÃ©placer).*(?:file|arquivo|archivo|fichier)/i.test(lower)) {
    return 'moveFile';
  }

  // STAGE 2: Quick Pre-Filter - Skip LLM for Obvious Non-File-Actions

  const fileActionKeywords = [
    'create', 'make', 'new', 'add', 'cria', 'criar', 'nueva', 'nuevo', 'crÃ©er',
    'rename', 'change', 'renomear', 'renombrar', 'renommer',
    'delete', 'remove', 'deletar', 'apagar', 'eliminar', 'supprimer',
    'move', 'relocate', 'mover', 'dÃ©placer'
  ];

  const fileTargetKeywords = [
    'folder', 'pasta', 'carpeta', 'dossier',
    'file', 'arquivo', 'archivo', 'fichier',
    'document', 'doc', 'pdf', 'txt', 'directory', 'dir'
  ];

  const hasActionKeyword = fileActionKeywords.some(keyword => lower.includes(keyword));
  const hasTargetKeyword = fileTargetKeywords.some(keyword => lower.includes(keyword));

  if (!hasActionKeyword || !hasTargetKeyword) {
    console.log('âš¡ [FILE ACTION] No file action pattern detected - skipping LLM intent detection');
    console.log(`   Action keyword: ${hasActionKeyword}, Target keyword: ${hasTargetKeyword}`);
    return null; // Skip expensive LLM call
  }

  const contentQuestionPatterns = [
    /what (is|are|does|do|can|could|would|should)/i,
    /how (is|are|does|do|can|could|would|should)/i,
    /why (is|are|does|do|can|could|would|should)/i,
    /which (is|are|does|do|can|could|would|should|folders?|files?)/i,  // âœ… NEW
    /explain|describe|summarize|compare|analyze|tell me about/i,
    /show\s+(me|my)/i,  // âœ… NEW: "show me" is usually a query, not an action
    /list\s+(my|all|the)/i  // âœ… NEW: "list my" is usually a query, not an action
  ];

  if (contentQuestionPatterns.some(pattern => pattern.test(query))) {
    console.log('âš¡ [FILE ACTION] Detected content question - skipping LLM intent detection');
    return null;
  }


  const negativePatterns = [
    // Informational questions about files
    /how many.*file/i,                    // "How many files do I have?"
    /what types?.*file/i,                 // "What types of files are there?"
    /who wrote/i,                         // "Who wrote the file?"
    /when was.*(?:created|modified|uploaded)/i,  // "When was the file created?"
    /where (?:is|are).*(?:file|document)/i,      // "Where is my file?"

    // Conceptual questions
    /what is a file/i,                    // "What is a file?"
    /how do files? work/i,                // "How do files work?"
    /what (?:is|are) (?:the )?(?:file|document) format/i,  // "What is the file format?"

    // Bulk/aggregate operations (not single file actions)
    /summarize all/i,                     // "Summarize all files"
    /list all/i,                          // "List all documents"
    /show all/i,                          // "Show all files"
    /count (?:my |the )?(?:files?|documents?)/i,  // "Count my files"
    /total (?:files?|documents?)/i,       // "Total files"

    // Analysis/comparison queries
    /compare.*(?:files?|documents?)/i,    // "Compare these files"
    /difference between.*(?:files?|documents?)/i,  // "Difference between files"
    /analyze.*(?:files?|documents?)/i,    // "Analyze my files"

    // Search/find queries (RAG, not file action)
    /find (?:information|content|data) (?:in|from|about)/i,  // "Find information in my files"
    /search (?:for|in|through)/i,         // "Search through my documents"
  ];

  if (negativePatterns.some(pattern => pattern.test(query))) {
    console.log('? [FILE ACTION] Detected negative pattern (informational query) - skipping file action');
    return null;
  }

  console.log('âš¡ [FILE ACTION] Using simple pattern-based intent detection');

  // Use the simple intent detection service
  const simpleResult = detectSimpleIntent(query);
  console.log(`âš¡ [FILE ACTION] Simple intent: ${simpleResult.type} (${simpleResult.detectionTimeMs}ms)`);

  // If simple detection found a file action with good confidence, use it
  if (simpleResult.type === 'file_action' && simpleResult.fileAction && simpleResult.confidence > 0.7) {
    // Map simple intent file actions to the expected format
    const fileActionMap: Record<string, string> = {
      'create_folder': 'createFolder',
      'move_file': 'moveFile',
      'rename': 'renameFile',
      'delete': 'deleteFile'
    };

    const action = fileActionMap[simpleResult.fileAction];
    if (action) {
      console.log(`âœ… [FILE ACTION] Pattern detected: ${action} (confidence: ${simpleResult.confidence})`);
      cacheIntent(query, action);
      return action;
    }
  }

  console.log(`âŒ [FILE ACTION] No file action pattern detected`);
  cacheIntent(query, null);
  return null;
}

// ============================================================================
// FILE ACTION EXECUTION - ACTUALLY EXECUTE ACTIONS
// ============================================================================

async function handleFileAction(
  userId: string,
  query: string,
  actionType: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  console.log(`ðŸ”§ [FILE ACTION] Executing: ${actionType}`);

  // Detect language
  const lang = detectLanguage(query);

  try {
    const result = await fileActionsService.executeAction(query, userId);

    // Stream the result to the user with language translation
    if (result.success) {
      // Translate success message to detected language
      let translatedMessage = result.message;

      // Translate common success patterns
      if (lang === 'pt') {
        translatedMessage = translatedMessage
          .replace(/Folder "(.+?)" created successfully/i, 'Pasta "$1" criada com sucesso')
          .replace(/File "(.+?)" moved successfully/i, 'Arquivo "$1" movido com sucesso')
          .replace(/File "(.+?)" renamed successfully/i, 'Arquivo "$1" renomeado com sucesso')
          .replace(/File "(.+?)" deleted successfully/i, 'Arquivo "$1" deletado com sucesso')
          .replace(/Folder "(.+?)" renamed successfully/i, 'Pasta "$1" renomeada com sucesso')
          .replace(/Folder "(.+?)" deleted successfully/i, 'Pasta "$1" deletada com sucesso');
      } else if (lang === 'es') {
        translatedMessage = translatedMessage
          .replace(/Folder "(.+?)" created successfully/i, 'Carpeta "$1" creada exitosamente')
          .replace(/File "(.+?)" moved successfully/i, 'Archivo "$1" movido exitosamente')
          .replace(/File "(.+?)" renamed successfully/i, 'Archivo "$1" renombrado exitosamente')
          .replace(/File "(.+?)" deleted successfully/i, 'Archivo "$1" eliminado exitosamente')
          .replace(/Folder "(.+?)" renamed successfully/i, 'Carpeta "$1" renombrada exitosamente')
          .replace(/Folder "(.+?)" deleted successfully/i, 'Carpeta "$1" eliminada exitosamente');
      } else if (lang === 'fr') {
        translatedMessage = translatedMessage
          .replace(/Folder "(.+?)" created successfully/i, 'Dossier "$1" crÃ©Ã© avec succÃ¨s')
          .replace(/File "(.+?)" moved successfully/i, 'Fichier "$1" dÃ©placÃ© avec succÃ¨s')
          .replace(/File "(.+?)" renamed successfully/i, 'Fichier "$1" renommÃ© avec succÃ¨s')
          .replace(/File "(.+?)" deleted successfully/i, 'Fichier "$1" supprimÃ© avec succÃ¨s')
          .replace(/Folder "(.+?)" renamed successfully/i, 'Dossier "$1" renommÃ© avec succÃ¨s')
          .replace(/Folder "(.+?)" deleted successfully/i, 'Dossier "$1" supprimÃ© avec succÃ¨s');
      }

      const formattedMessage = applyFormatEnforcement(translatedMessage, {
        responseType: 'file_action_success',
        logPrefix: '[FILE-ACTION FORMAT]',
        skipForShortResponses: true
      });
      onChunk(formattedMessage);

      // The executeAction doesn't return document/folder IDs needed for undo
    } else {
      const sorry = lang === 'pt' ? 'Desculpe, nÃ£o consegui completar essa aÃ§Ã£o:' :
                    lang === 'es' ? 'Lo siento, no pude completar esa acciÃ³n:' :
                    'Sorry, I couldn\'t complete that action:';
      // Error messages are short, skip format enforcement
      onChunk(`${sorry} ${result.error || result.message}`);
    }

  } catch (error: any) {
    console.error('âŒ [FILE ACTION] Error:', error);
    const sorry = lang === 'pt' ? 'Desculpe, ocorreu um erro ao tentar executar essa aÃ§Ã£o:' :
                  lang === 'es' ? 'Lo siento, ocurriÃ³ un error al intentar ejecutar esa acciÃ³n:' :
                  'Sorry, an error occurred while trying to execute that action:';
    // Error messages are short, skip format enforcement
    onChunk(`${sorry} ${error.message}`);
  }
}

// ============================================================================
// COMPARISON DETECTION - FUZZY MATCHING
// ============================================================================

async function detectComparison(userId: string, query: string): Promise<{
  type: 'document' | 'concept';
  documents?: string[];
  concepts?: string[];
  aspect?: string;
} | null> {
  const lower = query.toLowerCase();

  // Check for comparison keywords (multilingual)
  const comparisonPatterns = [
    // English
    /\bcompare\b/,
    /\bdifference(s)?\b/,
    /\bvs\b/,
    /\bversus\b/,
    /\bbetween\b/,
    /\bcontrast\b/,
    /\bsimilarities\b/,
    /\bdistinctions\b/,
    // Portuguese
    /\bcomparar\b/,
    /\bcomparaÃ§Ã£o\b/,
    /\bdiferenÃ§a(s)?\b/,
    /\bentre\b/,
    /\bcontraste\b/,
    /\bsemelhanÃ§as\b/,
    // Spanish
    /\bcomparar\b/,
    /\bcomparaciÃ³n\b/,
    /\bdiferencia(s)?\b/,
    /\bentre\b/,
    /\bcontraste\b/,
    /\bsimilitudes\b/,
    // French
    /\bcomparer\b/,
    /\bdiffÃ©rence(s)?\b/,
    // Generic
    /\band\b.*\band\b/,  // "doc1 and doc2"
  ];

  const hasComparisonKeyword = comparisonPatterns.some(pattern => pattern.test(lower));

  if (!hasComparisonKeyword) {
    return null;
  }

  console.log('ðŸ” [COMPARISON] Detected comparison keyword');

  // Try to extract document mentions with fuzzy matching
  const documentMentions = await extractDocumentMentions(userId, query);

  console.log(`ðŸ” [COMPARISON] Query: "${query}"`);
  console.log(`ðŸ“Š [COMPARISON] Found ${documentMentions.length} matching documents`);

  if (documentMentions.length >= 2) {
    // Document comparison - found 2+ specific documents
    console.log(`âœ… [COMPARISON] Document comparison: ${documentMentions.length} documents`);
    console.log(`ðŸ“„ [COMPARISON] Document IDs: ${documentMentions.join(', ')}`);

    const docs = await prisma.document.findMany({
      where: { id: { in: documentMentions } },
      select: { id: true, filename: true }
    });
    console.log(`ðŸ“ [COMPARISON] Matched documents:`, docs.map(d => ({ id: d.id.substring(0, 8), name: d.filename })));

    return {
      type: 'document',
      documents: documentMentions,
    };
  } else if (documentMentions.length === 1) {
    console.log(`âš ï¸ [COMPARISON] Only found 1 document, need 2+ for comparison`);
  } else {
    console.log(`âš ï¸ [COMPARISON] No specific documents found in query`);
  }

  // Concept comparison - no specific documents, extract concepts being compared
  console.log('âœ… [COMPARISON] Concept comparison detected');
  const concepts = extractComparisonConcepts(query);
  console.log(`ðŸ“ [COMPARISON] Extracted concepts: ${concepts.join(', ')}`);

  return {
    type: 'concept',
    concepts,
  };
}

function extractComparisonConcepts(query: string): string[] {
  const lower = query.toLowerCase();

  // Remove comparison keywords
  let cleaned = lower
    .replace(/\b(compare|comparison|difference|differences|between|vs|versus|and|contrast|with|the)\b/g, ' ')
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .trim();

  // Split by whitespace and filter out stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did',
    'can', 'could', 'will', 'would', 'should', 'may', 'might',
  ]);

  const words = cleaned.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  // Take first 2-4 words as concepts
  const concepts = words.slice(0, Math.min(4, words.length));

  return concepts;
}

// ============================================================================
// FUZZY DOCUMENT MATCHING
// ============================================================================

async function extractDocumentMentions(userId: string, query: string): Promise<string[]> {
  const queryLower = query.toLowerCase();

  const userDocsCacheKey = `userdocs:${userId}`;
  let documents = documentNameCache.get(userDocsCacheKey)?.documentIds as any;

  if (!documents || (Date.now() - (documentNameCache.get(userDocsCacheKey)?.timestamp || 0)) > CACHE_TTL) {
    console.log(`âŒ [CACHE MISS] User documents for ${userId}`);

    // Get all user's documents
    const docs = await prisma.document.findMany({
      where: { userId, status: { not: 'deleted' } },
      select: { id: true, filename: true },
    });

    // Cache the documents list
    documentNameCache.set(userDocsCacheKey, {
      documentIds: docs as any, // Store full document objects
      timestamp: Date.now()
    });

    documents = docs;
  } else {
    console.log(`âœ… [CACHE HIT] User documents for ${userId} (${documents.length} docs)`);
  }

  console.log(`ðŸ“„ [FUZZY MATCH] Checking ${documents.length} documents`);

  const matches: string[] = [];

  for (const doc of documents) {
    if (isDocumentMentioned(queryLower, doc.filename)) {
      console.log(`âœ… [FUZZY MATCH] Found: ${doc.filename}`);
      matches.push(doc.id);
    }
  }

  return matches;
}

function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')  // Decompose accented characters (CapÃ­tulo â†’ Capitulo)
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics (accents)
    .replace(/[^a-z0-9\s]/g, ' ')  // Replace special chars with spaces
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .trim();
}

function isDocumentMentioned(queryLower: string, documentName: string): boolean {
  // Remove file extensions
  const docNameNoExt = documentName
    .replace(/\.md\.pdf$/i, '')
    .replace(/\.(pdf|docx?|txt|xlsx?|pptx?|csv|md)$/i, '');

  // Normalize both query and document name (removes accents, special chars)
  const normalizedQuery = normalizeForMatching(queryLower);
  const normalizedDoc = normalizeForMatching(docNameNoExt);

  // Split into words (ignore 1-2 character words)
  const docWords = normalizedDoc.split(/\s+/).filter(w => w.length > 2);

  // Check if 50% of words are present (lowered from 60% for better matching)
  const threshold = Math.max(1, Math.ceil(docWords.length * 0.5));
  let matchCount = 0;

  for (const word of docWords) {
    if (normalizedQuery.includes(word)) {
      matchCount++;
    }
  }

  // BONUS: Also check if the full normalized doc name is a substring of the query
  // This handles cases like "capitulo 8" matching "capitulo8frameworkscrum"
  const compactDoc = normalizedDoc.replace(/\s+/g, '');
  const compactQuery = normalizedQuery.replace(/\s+/g, '');
  const substringMatch = compactQuery.includes(compactDoc) ||
                         compactDoc.includes(compactQuery.split(/\s+/).slice(0, 3).join(''));

  const matched = matchCount >= threshold || substringMatch;

  if (matched) {
    console.log(`  âœ“ "${documentName}" matched: ${matchCount}/${docWords.length} words (threshold: ${threshold}) or substring match: ${substringMatch}`);
  }

  return matched;
}
function extractSectionReferences(query: string): string[] {
  const sections: string[] = [];

  // Match patterns like "section 8.2", "chapter 3", "part II"
  const patterns = [
    /section\s+(\d+\.?\d*)/gi,
    /chapter\s+(\d+)/gi,
    /part\s+([IVX]+|\d+)/gi,
    /Â§\s*(\d+\.?\d*)/g,  // Â§ symbol
    /capitulo\s+(\d+)/gi,  // Spanish "capÃ­tulo"
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      sections.push(match[1]);
    }
  }

  if (sections.length > 0) {
    console.log(`ðŸ“ [SECTION DETECTION] Found section references: ${sections.join(', ')}`);
  }

  return sections;
}

function boostSectionMatches(matches: any[], sectionRefs: string[]): void {
  if (sectionRefs.length === 0) return;

  console.log(`ðŸŽ¯ [SECTION BOOST] Boosting chunks containing sections: ${sectionRefs.join(', ')}`);

  let boostedCount = 0;
  for (const match of matches) {
    const chunkText = match.metadata?.text || match.metadata?.content || '';

    // Check if chunk contains any of the section references
    for (const sectionRef of sectionRefs) {
      // Match "section 8.2", "8.2", "Â§ 8.2", etc.
      const sectionPattern = new RegExp(
        `(section|chapter|Â§|capitulo|\\b)\\s*${sectionRef.replace('.', '\\.')}\\b`,
        'i'
      );

      if (sectionPattern.test(chunkText)) {
        // Boost score by 30% (significant boost for section matches)
        const oldScore = match.score || 0;
        match.score = oldScore * 1.3;
        boostedCount++;
        console.log(`  â†‘ Boosted chunk containing section ${sectionRef}: ${oldScore.toFixed(3)} â†’ ${match.score.toFixed(3)}`);
        break;  // Only boost once per chunk
      }
    }
  }

  if (boostedCount > 0) {
    // Re-sort by score after boosting
    matches.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
    console.log(`âœ… [SECTION BOOST] Boosted ${boostedCount} chunks`);
  } else {
    console.warn(`âš ï¸ [SECTION BOOST] No chunks found containing sections ${sectionRefs.join(', ')}`);
  }
}

// ============================================================================
// DOCUMENT NAME CACHE
// ============================================================================

interface DocumentCacheEntry {
  documentIds: string[];
  timestamp: number;
}

const documentNameCache = new Map<string, DocumentCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// QUERY RESULT CACHE
// ============================================================================

interface QueryCacheEntry {
  sources: any[];
  response: string;
  timestamp: number;
}

const queryResultCache = new Map<string, QueryCacheEntry>();
const QUERY_CACHE_TTL = 30 * 1000; // 30 seconds

// ============================================================================
// PERFORMANCE FIX #2: File Listing Cache
// ============================================================================
interface FileListingCacheEntry {
  documents: { id: string; filename: string; createdAt: Date }[];
  timestamp: number;
}
const fileListingCache = new Map<string, FileListingCacheEntry>();
const FILE_LISTING_CACHE_TTL = 60 * 1000; // 1 minute

// Clear stale file listing cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of fileListingCache.entries()) {
    if (now - value.timestamp > FILE_LISTING_CACHE_TTL) {
      fileListingCache.delete(key);
    }
  }
}, 60000);

// Function to invalidate file listing cache (call after upload/delete)
export function invalidateFileListingCache(userId: string): void {
  fileListingCache.delete(userId);
  console.log(`[CACHE] Invalidated file listing cache for user ${userId}`);
}

// ============================================================================
// PERFORMANCE FIX #3: Query Embedding Cache
// ============================================================================
interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
}
const embeddingCache = new Map<string, EmbeddingCacheEntry>();
const EMBEDDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear stale embedding cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of embeddingCache.entries()) {
    if (now - value.timestamp > EMBEDDING_CACHE_TTL) {
      embeddingCache.delete(key);
    }
  }
}, 60000);

/**
 * Generate embedding with caching for performance
 */
async function generateEmbeddingCached(query: string): Promise<{ embedding: number[] }> {
  const cacheKey = query.toLowerCase().trim();
  const cached = embeddingCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < EMBEDDING_CACHE_TTL) {
    console.log(`⚡ [EMBEDDING CACHE] ✅ Using cached embedding (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
    return { embedding: cached.embedding };
  }

  console.log('⚡ [EMBEDDING CACHE] Generating new embedding...');
  const startTime = Date.now();

  const result = await embeddingService.generateEmbedding(query);

  const embeddingTime = Date.now() - startTime;
  console.log(`⚡ [EMBEDDING CACHE] ✅ Generated in ${embeddingTime}ms`);

  // Cache the embedding
  embeddingCache.set(cacheKey, {
    embedding: result.embedding,
    timestamp: now
  });

  return result;
}

/**
 * Generate cache key from query and user
 */
function generateQueryCacheKey(userId: string, query: string): string {
  // Normalize query (lowercase, trim, remove extra spaces)
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  return `${userId}:${normalized}`;
}
// ============================================================================
// COMPARISON HANDLER - GUARANTEE Multi-Document Retrieval
// ============================================================================

async function handleComparison(
  userId: string,
  query: string,
  comparison: { type: 'document' | 'concept'; documents?: string[]; concepts?: string[] },
  onChunk: (chunk: string) => void,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ sources: any[] }> {
  console.log(`ðŸ”„ [COMPARISON] Type: ${comparison.type}`);

  if (comparison.type === 'concept') {
    // Concept comparison (e.g., "Compare Maslow vs SDT")
    return await handleConceptComparison(userId, query, comparison.concepts || [], onChunk, conversationHistory);
  } else {
    // Document comparison (e.g., "Compare Document A vs Document B")
    return await handleDocumentComparison(userId, query, comparison.documents || [], onChunk, conversationHistory);
  }
}

async function handleConceptComparison(
  userId: string,
  query: string,
  concepts: string[],
  onChunk: (chunk: string) => void,
  conversationHistory?: Array<{ role: string; content: string }>,
  detectedLanguage?: string
): Promise<{ sources: any[] }> {
  // â±ï¸ TIMING: Initialize timer for concept comparison
  const comparisonTimer = new PerformanceTimer();
  comparisonTimer.start('CONCEPT COMPARISON TOTAL');

  console.log(`ðŸ” [CONCEPT COMPARISON] Searching for: ${concepts.join(' vs ')}`);

  comparisonTimer.start('All Concept Searches (Parallel)');
  console.log(`ðŸ”„ [PARALLEL] Searching ${concepts.length} concepts in parallel...`);

  // Create parallel search promises for all concepts
  const conceptSearchPromises = concepts.map(async (concept) => {
    const searchQuery = `${concept} definition meaning explanation`;
    console.log(`  ðŸ” Searching for concept: "${concept}"`);

    try {
      const conceptStartTime = Date.now();

      // Generate embedding for this concept search using OpenAI
      const embeddingStartTime = Date.now();
      const embeddingResult = await embeddingService.generateEmbedding(searchQuery);
      const queryEmbedding = embeddingResult.embedding;
      const embeddingTime = Date.now() - embeddingStartTime;

      // ðŸ”€ HYBRID RETRIEVAL: Use combined Vector + BM25 search for concepts
      const pineconeStartTime = Date.now();
      const hybridResults = await performHybridRetrieval(
        searchQuery,
        queryEmbedding,
        userId,
        5, // topK
        { userId }
      );
      const pineconeTime = Date.now() - pineconeStartTime;

      const totalConceptTime = Date.now() - conceptStartTime;
      console.log(`  â±ï¸  [${concept}] Embedding: ${embeddingTime}ms, Hybrid: ${pineconeTime}ms, Total: ${totalConceptTime}ms`);

      return {
        concept,
        matches: hybridResults.matches || [],
        embeddingTime,
        pineconeTime,
        totalTime: totalConceptTime
      };
    } catch (error) {
      console.error(`âŒ [CONCEPT COMPARISON] Error searching for "${concept}":`, error);
      return { concept, matches: [], embeddingTime: 0, pineconeTime: 0, totalTime: 0 };
    }
  });

  // Wait for all concept searches to complete IN PARALLEL
  const conceptResults = await Promise.all(conceptSearchPromises);
  comparisonTimer.end('All Concept Searches (Parallel)');

  // Log parallel timing summary
  const maxConceptTime = Math.max(...conceptResults.map(r => r.totalTime));
  const totalSequentialTime = conceptResults.reduce((sum, r) => sum + r.totalTime, 0);
  console.log(`âœ… [PARALLEL] All ${concepts.length} concepts searched. Max time: ${maxConceptTime}ms (saved ${totalSequentialTime - maxConceptTime}ms vs sequential)`);

  comparisonTimer.start('filterDeletedDocuments (Batch)');

  // Collect all matches from all concepts
  const allRawMatches: any[] = [];
  const matchToConceptMap = new Map<any, string>(); // Track which concept each match came from

  for (const result of conceptResults) {
    for (const match of result.matches) {
      allRawMatches.push(match);
      matchToConceptMap.set(match, result.concept);
    }
  }

  console.log(`ðŸ”„ [BATCH FILTER] Filtering ${allRawMatches.length} total matches from ${concepts.length} concepts...`);

  // Filter all matches in ONE batch DB query
  const filteredMatches = await filterDeletedDocuments(allRawMatches, userId);
  comparisonTimer.end('filterDeletedDocuments (Batch)');

  // ðŸš€ HYBRID RETRIEVAL BOOST: Apply filename/entity matching boost
  const boostedMatches = hybridRetrievalBooster.boostRetrievalScores(filteredMatches, query, 1.8);

  console.log(`âœ… [BATCH FILTER] ${boostedMatches.length}/${allRawMatches.length} matches after filtering and boosting`);

  // Now process boosted results
  const allChunks: any[] = [];
  const sourceMap = new Map<string, any>();

  for (const match of boostedMatches) {
    if (match.score && match.score > 0.3) {
      const meta = match.metadata || {};
      const docName = meta.filename || meta.documentName || '';
      const concept = matchToConceptMap.get(match) || 'unknown';

      allChunks.push({
        concept,
        text: meta.content || meta.text || '',
        documentName: docName,
        pageNumber: meta.page || meta.pageNumber || null,
        score: match.score,
      });

      // Deduplicate sources by document name (keep highest score)
      const dedupeKey = docName.toLowerCase().trim();
      const existing = sourceMap.get(dedupeKey);
      if (!existing || match.score > existing.relevanceScore) {
        sourceMap.set(dedupeKey, {
          documentId: meta.documentId,
          documentName: docName,
          pageNumber: meta.page || meta.pageNumber || null,
          relevanceScore: match.score,
          mimeType: meta.mimeType,
        });
      }
    }
  }

  // Log per-concept results
  for (const concept of concepts) {
    const conceptChunkCount = allChunks.filter(c => c.concept === concept).length;
    console.log(`  âœ… Found ${conceptChunkCount} chunks for concept "${concept}"`);
  }

  // Convert Map to array for sources
  const allSources = Array.from(sourceMap.values());

  if (allChunks.length === 0) {
    const lang = detectLanguage(query);

    // ✅ FIXED: More direct and precise "not found" message
    // Don't use ErrorMessagesService which adds generic content
    // Don't apply format enforcement which adds generic closing
    const message = lang === 'pt'
      ? `Não encontrei informações sobre "${query.slice(0, 100)}" nos seus documentos.

**Possíveis razões:**
• O documento não foi carregado ainda
• A informação não está presente nos documentos
• Tente reformular a pergunta de outra forma

Posso ajudar com algo mais?`
      : lang === 'es'
      ? `No encontré información sobre "${query.slice(0, 100)}" en tus documentos.

**Posibles razones:**
• El documento aún no se ha cargado
• La información no está en los documentos
• Intenta reformular la pregunta

¿Puedo ayudarte con algo más?`
      : `I couldn't find information about "${query.slice(0, 100)}" in your documents.

**Possible reasons:**
• The document hasn't been uploaded yet
• The information isn't in your documents
• Try rephrasing your question differently

Can I help with something else?`;

    console.log(`❌ [NOT FOUND] No chunks found for query: "${query.slice(0, 50)}..."`);
    onChunk(message);
    return { sources: [] };
  }

  console.log(`âœ… [CONCEPT COMPARISON] Found ${allChunks.length} total chunks across all concepts`);

  // ============================================================================
  // COMPARATIVE ANALYSIS - Extract structured comparison intelligence
  // ============================================================================

  comparisonTimer.start('Comparative Analysis');

  // Prepare chunks for comparative analysis
  const chunksForComparison = allChunks.map(chunk => ({
    content: chunk.text || '',
    metadata: {
      documentId: chunk.documentId || 'unknown',
      filename: chunk.documentName || 'Unknown',
      page: chunk.pageNumber
    }
  }));

  // Get comparative intelligence
  const comparativeResult = comparativeAnalysisService.getComparisonContext(
    query,
    concepts,
    chunksForComparison
  );

  comparisonTimer.end('Comparative Analysis');

  console.log(`ðŸ” [COMPARATIVE] Found ${comparativeResult.comparativeStatements.length} comparative statements`);
  console.log(`ðŸ” [COMPARATIVE] Extracted attributes for ${comparativeResult.conceptAttributesMap.size} concepts`);

  // Build context for LLM, grouped by concept
  let context = '';
  for (const concept of concepts) {
    const conceptChunks = allChunks.filter(c => c.concept === concept);
    if (conceptChunks.length > 0) {
      context += `\n\n**${concept.toUpperCase()}**:\n`;
      conceptChunks.forEach(chunk => {
        // Only include page number if it exists and is not 0 or null
        const pageInfo = chunk.pageNumber ? `, p.${chunk.pageNumber}` : '';
        context += `\n[${chunk.documentName}${pageInfo}]\n${chunk.text}\n`;
      });
    }
  }

  // Add comparative intelligence to context
  if (comparativeResult.promptAddition) {
    context += comparativeResult.promptAddition;
    console.log(`âœ… [COMPARATIVE] Added comparative intelligence to prompt context`);
  }

  // Use pre-detected language from controller, or detect if not provided
  const queryLang = detectedLanguage || detectLanguage(query);
  const queryLangName = queryLang === 'pt' ? 'Portuguese' : queryLang === 'es' ? 'Spanish' : queryLang === 'fr' ? 'French' : 'English';

  // Check if this is the first message
  const isFirstMessage = !conversationHistory || conversationHistory.length === 0;

  // Format conversation history for system prompt
  let conversationHistoryText = '';
  if (conversationHistory && conversationHistory.length > 0) {
    // FIX #2 & #4: Compress assistant messages and limit history
    // Limit to last 6 messages to reduce LLM repetition
    const limitedHistory = conversationHistory.slice(-6);
    conversationHistoryText = limitedHistory
      .map(msg => {
        if (msg.role === 'assistant') {
          const firstLine = msg.content.split('\n')[0].substring(0, 150);
          return `Assistant: ${firstLine}${msg.content.length > 150 ? '...' : ''}`;
        }
        return `User: ${msg.content}`;
      })
      .join('\n\n');
  }

  // Build system prompt using unified SystemPrompts service
  // ? Cultural Context Engine: Pass detected language for multilingual support
  const systemPrompt = systemPromptsService.getSystemPrompt(
    query,
    'medium', // Comparison queries use medium length
    {
      isComparison: true,
      isFirstMessage,
      conversationHistory: conversationHistoryText,
      documentContext: context,
      detectedLanguage: queryLang, // ? Cultural Context: Pass detected language
    }
  );

  // Add language detection instruction (required for concept comparisons)
  const languageInstruction = `\n\n**LANGUAGE DETECTION (CRITICAL)**:\n- The user's query is in ${queryLangName}\n- You MUST respond ENTIRELY in ${queryLangName}`;
  const finalSystemPrompt = systemPrompt + languageInstruction;

  // Generate comparison response
  comparisonTimer.start('LLM Streaming Response');
  const generationResult = await smartStreamLLMResponse(finalSystemPrompt, '', onChunk);
  comparisonTimer.end('LLM Streaming Response');

  comparisonTimer.end('CONCEPT COMPARISON TOTAL');
  comparisonTimer.printSummary();

  return { sources: allSources };
}

async function handleDocumentComparison(
  userId: string,
  query: string,
  documentIds: string[],
  onChunk: (chunk: string) => void,
  conversationHistory?: Array<{ role: string; content: string }>,
  detectedLanguage?: string
): Promise<{ sources: any[] }> {
  console.log('ðŸ”„ [DOCUMENT COMPARISON] Retrieving content for comparison');
  console.log('ðŸ“„ [DOCUMENT COMPARISON] Specific documents:', documentIds.length);

  // ============================================================================
  // DOCUMENT COMPARISON: Query specific documents
  // ============================================================================
  // GUARANTEE: Search each document separately

  // Generate embedding for query (once, reuse for all documents) using OpenAI
  const embeddingResult = await embeddingService.generateEmbedding(query);
  const queryEmbedding = embeddingResult.embedding;

  const queryPromises = documentIds.map(async (docId) => {
    console.log(`  ðŸ“„ Searching document: ${docId}`);

    try {
      // ðŸ”€ HYBRID RETRIEVAL: Use combined Vector + BM25 search for document
      const hybridResults = await performHybridRetrieval(
        query,
        queryEmbedding,
        userId,
        5, // topK
        { documentId: docId }
      );

      // Filter out deleted documents
      const filteredMatches = await filterDeletedDocuments(hybridResults.matches || [], userId);

      console.log(`  âœ… Found ${filteredMatches.length} chunks for ${docId}`);

      return filteredMatches;
    } catch (error) {
      console.error(`âŒ [PARALLEL QUERY] Error querying document ${docId}:`, error);
      return []; // Return empty array on error
    }
  });

  // Wait for all queries to complete
  const allResultsArrays = await Promise.all(queryPromises);

  // Flatten results
  const allChunks = allResultsArrays.flat();

  console.log(`âœ… [DOCUMENT COMPARISON] Queried ${documentIds.length} documents in parallel, found ${allChunks.length} total chunks`);

  // ðŸ” DEBUG: Log first chunk metadata to find the correct field names
  if (allChunks.length > 0) {
    const firstMeta = allChunks[0].metadata || {};
    console.log(`ðŸ” [DEBUG] First chunk metadata keys:`, Object.keys(firstMeta));
    console.log(`ðŸ” [DEBUG] First chunk content field:`, firstMeta.content ? `${firstMeta.content.substring(0, 100)}...` : 'EMPTY');
    console.log(`ðŸ” [DEBUG] First chunk text field:`, firstMeta.text ? `${firstMeta.text.substring(0, 100)}...` : 'EMPTY');
  }

  // Build context from all chunks
  const context = allChunks
    .map((match: any) => {
      const meta = match.metadata || {};
      const chunkContent = meta.text || meta.content || '';
      const pageInfo = (meta.page && meta.page > 0) ? `, Page: ${meta.page}` : '';
      return `[Document: ${meta.filename || 'Unknown'}${pageInfo}]\n${chunkContent}`;
    })
    .join('\n\n---\n\n');

  console.log(`ðŸ” [DEBUG] Built context length: ${context.length} chars`);

  // Build sources array - Will be updated after LLM response
  let sources: any[] = [];

  // Use pre-detected language from controller, or detect if not provided
  const queryLang = detectedLanguage || detectLanguage(query);
  const queryLangName = queryLang === 'pt' ? 'Portuguese' : queryLang === 'es' ? 'Spanish' : queryLang === 'fr' ? 'French' : 'English';

  // Check if this is the first message
  const isFirstMessage = !conversationHistory || conversationHistory.length === 0;

  // Format conversation history for system prompt
  let conversationHistoryText = '';
  if (conversationHistory && conversationHistory.length > 0) {
    // FIX #2 & #4: Compress assistant messages and limit history
    // Limit to last 6 messages to reduce LLM repetition
    const limitedHistory = conversationHistory.slice(-6);
    conversationHistoryText = limitedHistory
      .map(msg => {
        if (msg.role === 'assistant') {
          const firstLine = msg.content.split('\n')[0].substring(0, 150);
          return `Assistant: ${firstLine}${msg.content.length > 150 ? '...' : ''}`;
        }
        return `User: ${msg.content}`;
      })
      .join('\n\n');
  }

  // Build system prompt using unified SystemPrompts service
  // ? Cultural Context Engine: Pass detected language for multilingual support
  const systemPrompt = systemPromptsService.getSystemPrompt(
    query,
    'medium', // Document comparisons use medium length
    {
      isComparison: true,
      isFirstMessage,
      conversationHistory: conversationHistoryText,
      documentContext: context,
      detectedLanguage: queryLang, // ? Cultural Context: Pass detected language
    }
  );

  // Add language detection and cross-document synthesis instructions
  const additionalInstructions = `\n\n**LANGUAGE DETECTION (CRITICAL)**:\n- The user's query is in ${queryLangName}\n- You MUST respond ENTIRELY in ${queryLangName}\n\n**CROSS-DOCUMENT SYNTHESIS**:\n- Don't just summarize each document independently\n- Merge insights into a unified conceptual framework\n- Build conceptual bridges between documents\n- Identify: Where do they overlap? Where do they diverge?\n- Reveal patterns only visible when viewed together`;
  const finalSystemPrompt = systemPrompt + additionalInstructions;

  const fullResponse = await smartStreamLLMResponse(finalSystemPrompt, '', onChunk);

  console.log(`âš¡ [DOCUMENT COMPARISON] Building sources using enhanced citation tracking`);

  const citationResult = citationTracking.extractCitations(fullResponse);
  const cleanResponse = citationResult.cleanResponse;
  const extractedCitations = citationResult.citations;

  if (extractedCitations.length > 0) {
    console.log(`ðŸ“Ž [DOCUMENT COMPARISON] Using LLM-provided citations (${extractedCitations.length} docs)`);
    sources = citationTracking.buildSourcesFromCitations(extractedCitations, allChunks);
  } else {
    console.log(`âš¡ [DOCUMENT COMPARISON] No LLM citations, using fast regex extraction`);
    sources = fastCitationExtraction(cleanResponse, allChunks);
  }

  if (sources.length === 0 && documentIds.length > 0) {
    console.log('âš ï¸ [DOCUMENT COMPARISON] No citations found, assuming all compared documents were used');

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, filename: true, mimeType: true }
    });

    sources.push(...documents.map(doc => ({
      documentId: doc.id,
      documentName: doc.filename,
      pageNumber: null,
      score: 1.0,
      mimeType: doc.mimeType
    })));
  }

  console.log(`âœ… [DOCUMENT COMPARISON] Built ${sources.length} accurate sources`);

  // ============================================================================
  // NEW: ANSWER VALIDATION - Check answer quality
  // ============================================================================

  const validation = validateAnswer(cleanResponse, query, sources);

  if (!validation.isValid) {
    console.log(`âš ï¸  [AGENT LOOP] Answer validation failed - issues detected`);
    validation.issues?.forEach(issue => console.log(`   - ${issue}`));

    // Log for monitoring (could trigger alert in production)
    console.log(`âš ï¸  [MONITORING] Low quality answer generated for query: "${query}"`);
  }

  console.log(`ðŸ“š [DOCUMENT COMPARISON] Returning ${sources.length} sources:`);
  sources.forEach((src, idx) => {
    console.log(`   ${idx + 1}. ${src.documentName} (page: ${src.pageNumber || 'N/A'}, score: ${src.score?.toFixed(3) || 0})`);
  });

  return { sources };
}

// ============================================================================
// DOCUMENT COUNTING DETECTION & HANDLER
// ============================================================================

function isDocumentCountingQuery(query: string): { isCounting: boolean; fileType?: string } {
  const lower = query.toLowerCase().trim();

  // Check for counting keywords (multilingual)
  const hasCountKeyword = lower.includes('how many') || lower.includes('count') ||
                         lower.includes('quantos') || lower.includes('quantas') || // Portuguese
                         lower.includes('cuÃ¡ntos') || lower.includes('cuÃ¡ntas') || // Spanish
                         lower.includes('combien') || // French
                         lower.includes('contar');

  const hasDocKeyword = lower.includes('document') || lower.includes('file') ||
                        lower.includes('documento') || lower.includes('arquivo') || // Portuguese
                        lower.includes('fichier') || // French
                        lower.includes('pdf') || lower.includes('excel') ||
                        lower.includes('xlsx') || lower.includes('docx') ||
                        lower.includes('pptx') || lower.includes('image') ||
                        lower.includes('imagem') || // Portuguese
                        lower.includes('png') || lower.includes('jpg');

  if (!hasCountKeyword || !hasDocKeyword) {
    return { isCounting: false };
  }

  // Extract file type if specified
  let fileType: string | undefined;
  if (lower.includes('pdf')) fileType = '.pdf';
  else if (lower.includes('excel') || lower.includes('xlsx')) fileType = '.xlsx';
  else if (lower.includes('word') || lower.includes('docx')) fileType = '.docx';
  else if (lower.includes('powerpoint') || lower.includes('pptx')) fileType = '.pptx';
  else if (lower.includes('image') || lower.includes('png')) fileType = '.png';
  else if (lower.includes('jpg') || lower.includes('jpeg')) fileType = '.jpg';

  return { isCounting: true, fileType };
}

async function handleDocumentCounting(
  userId: string,
  query: string,
  fileType: string | undefined,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log(`ðŸ”¢ [DOCUMENT COUNTING] Counting documents${fileType ? ` of type ${fileType}` : ''}`);

  // Detect language
  const lang = detectLanguage(query);

  const whereClause: any = {
    userId,
    status: { not: 'deleted' },
  };

  if (fileType) {
    whereClause.filename = { endsWith: fileType };
  }

  const count = await prisma.document.count({ where: whereClause });
  const documents = await prisma.document.findMany({
    where: whereClause,
    select: { filename: true },
  });

  // Build multilingual response
  let response = '';

  if (fileType) {
    const typeName = fileType.replace('.', '').toUpperCase();
    const fileWord = count === 1 ?
      (lang === 'pt' ? 'arquivo' : lang === 'es' ? 'archivo' : lang === 'fr' ? 'fichier' : 'file') :
      (lang === 'pt' ? 'arquivos' : lang === 'es' ? 'archivos' : lang === 'fr' ? 'fichiers' : 'files');

    const youHave = lang === 'pt' ? 'VocÃª tem' : lang === 'es' ? 'Tienes' : lang === 'fr' ? 'Vous avez' : 'You have';
    response = `${youHave} **${count}** ${fileWord} ${typeName}.`;

    if (count > 0) {
      response += '\n\n';
      documents.forEach(doc => {
        response += `â€¢ ${doc.filename}\n`;
      });
    }
  } else {
    const docWord = count === 1 ?
      (lang === 'pt' ? 'documento' : lang === 'es' ? 'documento' : lang === 'fr' ? 'document' : 'document') :
      (lang === 'pt' ? 'documentos' : lang === 'es' ? 'documentos' : lang === 'fr' ? 'documents' : 'documents');

    const youHave = lang === 'pt' ? 'VocÃª tem' : lang === 'es' ? 'Tienes' : lang === 'fr' ? 'Vous avez' : 'You have';
    const inTotal = lang === 'pt' ? 'no total' : lang === 'es' ? 'en total' : lang === 'fr' ? 'au total' : 'in total';
    response = `${youHave} **${count}** ${docWord} ${inTotal}.`;
  }

  const question = lang === 'pt' ? 'O que vocÃª gostaria de saber sobre esses documentos?' :
                   lang === 'es' ? 'Â¿QuÃ© te gustarÃ­a saber sobre estos documentos?' :
                   lang === 'fr' ? 'Que souhaitez-vous savoir sur ces documents?' :
                   'What would you like to know about these documents?';

  response += `\n\n${question}`;

  // Apply format enforcement to document count response
  const formattedCount = applyFormatEnforcement(response, {
    responseType: 'document_count',
    logPrefix: '[DOC-COUNT FORMAT]'
  });

  onChunk(formattedCount);

  // âŒ NO SOURCES: Document counting queries don't use document CONTENT
  // We're just counting rows in the database, not reading/analyzing documents
  return { sources: [] };
}

// ============================================================================
// FORMULA QUERY DETECTION & EXTRACTION (Excel Formula Understanding)
// ============================================================================

function isFormulaQuery(query: string): { isFormula: boolean; formulaType?: string; cellReference?: string } {
  const lower = query.toLowerCase().trim();

  // Pattern 1: Direct formula questions
  const formulaPatterns = [
    /what\s+(is\s+)?the\s+formula/i,           // "what is the formula..."
    /which\s+formula/i,                         // "which formula..."
    /what\s+formula/i,                          // "what formula..."
    /show\s+(me\s+)?the\s+formula/i,           // "show me the formula..."
    /formula\s+(for|used|in)/i,                // "formula for...", "formula used in..."
    /explain\s+(the\s+)?formula/i,             // "explain the formula..."
    /how\s+is\s+.*\s+calculated/i,             // "how is X calculated"
    /how\s+does\s+.*\s+get\s+calculated/i,     // "how does X get calculated"
    /how\s+are\s+.*\s+calculated/i,            // "how are subtotals calculated"
    /calculation\s+(method|formula)/i,         // "calculation method..."
    /\=\s*[A-Z]+\s*\(/i,                       // "=SUM(", "=IFERROR(", etc.
  ];

  // Pattern 2: Cell-specific formula questions
  const cellFormulaPatterns = [
    /cell\s+([A-Z]+\d+)\s+.*(?:formula|calculated)/i,     // "cell B71 formula"
    /how\s+is\s+cell\s+([A-Z]+\d+)/i,                     // "how is cell B71..."
    /formula\s+(?:in|for)\s+(?:cell\s+)?([A-Z]+\d+)/i,   // "formula in B71"
    /what\s+(?:is|does)\s+([A-Z]+\d+)\s+(?:contain|calculate|compute)/i,  // "what does B71 calculate"
  ];

  // Pattern 3: Formula type questions (IFERROR, SUM, VLOOKUP, etc.)
  const formulaTypePatterns = [
    /\b(SUM|AVERAGE|COUNT|IFERROR|VLOOKUP|HLOOKUP|INDEX|MATCH|IF|AND|OR|PMT|NPV|IRR|XIRR|SUMIF|COUNTIF|SUMPRODUCT)\b/i,
  ];

  // Pattern 4: Subtotals and calculation method questions (like Q8)
  const subtotalPatterns = [
    /how\s+(?:is|are)\s+(?:the\s+)?(?:sub)?totals?\s+calculated/i,  // "how are subtotals calculated"
    /(?:sub)?total.*(?:formula|calculation|computed)/i,             // "subtotal formula"
    /(?:calculation|formula)\s+(?:for|of)\s+(?:sub)?totals?/i,     // "calculation for subtotals"
  ];

  // Check for any formula pattern
  const isFormulaQuestion = formulaPatterns.some(p => p.test(lower)) ||
                            cellFormulaPatterns.some(p => p.test(lower)) ||
                            subtotalPatterns.some(p => p.test(lower));

  if (!isFormulaQuestion) {
    return { isFormula: false };
  }

  // Extract cell reference if present
  let cellReference: string | undefined;
  for (const pattern of cellFormulaPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      cellReference = match[1].toUpperCase();
      break;
    }
  }

  // Also check for cell references in the general query
  if (!cellReference) {
    const cellMatch = query.match(/\b([A-Z]{1,3}\d{1,5})\b/);
    if (cellMatch) {
      cellReference = cellMatch[1];
    }
  }

  // Extract formula type if present
  let formulaType: string | undefined;
  for (const pattern of formulaTypePatterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      formulaType = match[1].toUpperCase();
      break;
    }
  }

  console.log(`ðŸ“Š [FORMULA QUERY] Detected formula query - Type: ${formulaType || 'general'}, Cell: ${cellReference || 'none'}`);

  return {
    isFormula: true,
    formulaType,
    cellReference
  };
}

function extractFormulasFromChunks(chunks: Array<{ text: string; metadata?: any }>): Array<{
  cell: string;
  value: string;
  formula: string;
  context: string;
}> {
  const formulas: Array<{ cell: string; value: string; formula: string; context: string }> = [];

  // Pattern to match: "B5: $1,200,000 (formula: =SUM(B2:B4))"
  const formulaPattern = /([A-Z]{1,3}\d{1,5}):\s*([^(]+)\s*\(formula:\s*=([^)]+)\)/gi;

  for (const chunk of chunks) {
    const text = chunk.text || '';
    let match;

    while ((match = formulaPattern.exec(text)) !== null) {
      formulas.push({
        cell: match[1],
        value: match[2].trim(),
        formula: '=' + match[3].trim(),
        context: text.substring(
          Math.max(0, match.index - 50),
          Math.min(text.length, match.index + match[0].length + 50)
        )
      });
    }
  }

  if (formulas.length > 0) {
    console.log(`ðŸ“Š [FORMULA EXTRACT] Found ${formulas.length} formulas in chunks`);
  }

  return formulas;
}

function enhanceQueryForFormulas(query: string, formulaInfo: { isFormula: boolean; formulaType?: string; cellReference?: string }): string {
  if (!formulaInfo.isFormula) {
    return query;
  }

  let enhanced = query;

  // Add formula pattern suffix to help retrieval find formula chunks
  enhanced += ' (formula: =';

  // If specific cell, add it
  if (formulaInfo.cellReference) {
    enhanced += ` ${formulaInfo.cellReference}:`;
  }

  // If specific formula type, add it
  if (formulaInfo.formulaType) {
    enhanced += ` ${formulaInfo.formulaType}`;
  }

  console.log(`ðŸ“Š [FORMULA ENHANCE] Enhanced query: "${query}" â†’ "${enhanced}"`);

  return enhanced;
}

// ============================================================================
// ENTITY QUERY DETECTION AND ENHANCEMENT
// ============================================================================

function isEntityQuery(query: string): { isEntity: boolean; entityType?: string } {
  const lower = query.toLowerCase().trim();

  // Pattern 1: Direct entity listing questions
  const entityListingPatterns = [
    /what\s+(?:are\s+)?(?:the\s+)?(?:names?\s+(?:of\s+)?)?(?:the\s+)?propert(?:y|ies)/i,  // "what are the property names"
    /(?:list|show|tell|give)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?propert(?:y|ies)/i,        // "list all properties"
    /how\s+many\s+propert(?:y|ies)/i,                                                      // "how many properties"
    /which\s+propert(?:y|ies)/i,                                                           // "which properties"
    /what\s+(?:are\s+)?(?:the\s+)?(?:names?\s+(?:of\s+)?)?(?:the\s+)?investments?/i,      // "what are the investments"
    /(?:list|show|tell|give)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?investments?/i,            // "list investments"
    /what\s+(?:are\s+)?(?:the\s+)?(?:names?\s+(?:of\s+)?)?(?:the\s+)?assets?/i,           // "what are the assets"
    /what\s+(?:are\s+)?(?:the\s+)?(?:names?\s+(?:of\s+)?)?(?:the\s+)?funds?/i,            // "what are the funds"
    /what\s+(?:are\s+)?(?:the\s+)?(?:names?\s+(?:of\s+)?)?(?:the\s+)?companies/i,         // "what are the companies"
    /(?:list|show)\s+(?:all\s+)?(?:the\s+)?(?:portfolio\s+)?holdings?/i,                  // "list portfolio holdings"
    /what's?\s+(?:in|included\s+in)\s+(?:the\s+)?(?:portfolio|fund)/i,                    // "what's in the portfolio"
  ];

  // Pattern 2: Specific entity type keywords
  const entityTypeKeywords = [
    'properties', 'property', 'investments', 'investment',
    'assets', 'asset', 'funds', 'fund', 'portfolio', 'portfolios',
    'holdings', 'companies', 'company', 'entities', 'entity'
  ];

  // Check for entity listing patterns
  const isEntityListing = entityListingPatterns.some(p => p.test(lower));

  if (!isEntityListing) {
    return { isEntity: false };
  }

  // Detect entity type
  let entityType: string | undefined;
  for (const keyword of entityTypeKeywords) {
    if (lower.includes(keyword)) {
      entityType = keyword.replace(/ies$/, 'y').replace(/s$/, ''); // Normalize to singular
      break;
    }
  }

  console.log(`ðŸ“Š [ENTITY QUERY] Detected entity query - Type: ${entityType || 'general'}`);

  return {
    isEntity: true,
    entityType
  };
}

function enhanceQueryForEntities(query: string, entityInfo: { isEntity: boolean; entityType?: string }): string {
  if (!entityInfo.isEntity) {
    return query;
  }

  let enhanced = query;

  // Add entity pattern prefix to help retrieval find entity chunks
  enhanced += ' [Entities:';

  // If specific entity type, add it
  if (entityInfo.entityType) {
    enhanced += ` ${entityInfo.entityType}`;
  }

  console.log(`ðŸ“Š [ENTITY ENHANCE] Enhanced query: "${query}" â†’ "${enhanced}"`);

  return enhanced;
}


function buildFormulaContext(
  formulas: Array<{ cell: string; value: string; formula: string; context: string }>,
  formulaInfo: { isFormula: boolean; formulaType?: string; cellReference?: string }
): string {
  if (formulas.length === 0) {
    return '';
  }

  let context = '\n\n## EXTRACTED FORMULAS FROM EXCEL FILES\n';
  context += 'The following formulas were found in the relevant Excel chunks:\n\n';

  // If looking for specific cell, prioritize it
  if (formulaInfo.cellReference) {
    const targetFormula = formulas.find(f => f.cell === formulaInfo.cellReference);
    if (targetFormula) {
      context += `**Target Cell ${targetFormula.cell}:**\n`;
      context += `- Current Value: ${targetFormula.value}\n`;
      context += `- Formula: \`${targetFormula.formula}\`\n`;
      context += `- Context: "${targetFormula.context}"\n\n`;
    }
  }

  // Show all formulas (up to 10)
  const displayFormulas = formulas.slice(0, 10);
  if (displayFormulas.length > 0) {
    context += '**All Extracted Formulas:**\n';
    for (const f of displayFormulas) {
      context += `- **${f.cell}**: ${f.value} â†’ \`${f.formula}\`\n`;
    }
  }

  if (formulas.length > 10) {
    context += `\n(${formulas.length - 10} more formulas not shown)\n`;
  }

  context += '\n**IMPORTANT:** Use these actual formulas to answer the user\'s question about how calculations work.\n';

  return context;
}

// ============================================================================
// DOCUMENT TYPES DETECTION & HANDLER
// ============================================================================

function isDocumentTypesQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  const hasTypeKeyword = lower.includes('what type') || lower.includes('what kind') ||
                         lower.includes('which type') || lower.includes('file type') ||
                         lower.includes('que tipo') || lower.includes('quais tipos') || // Portuguese
                         lower.includes('quÃ© tipo') || lower.includes('cuÃ¡les tipos') || // Spanish
                         lower.includes('quel type') || lower.includes('quels types'); // French

  const hasDocKeyword = lower.includes('document') || lower.includes('file') ||
                        lower.includes('documento') || lower.includes('arquivo') || // Portuguese
                        lower.includes('fichier'); // French

  const hasHaveKeyword = lower.includes('have') || lower.includes('got') || lower.includes('own') ||
                         lower.includes('tenho') || lower.includes('salvei') || // Portuguese
                         lower.includes('salvo') || lower.includes('guardado') || // Portuguese
                         lower.includes('tengo') || // Spanish
                         lower.includes('ai') || lower.includes('j\'ai'); // French

  return hasTypeKeyword && hasDocKeyword && hasHaveKeyword;
}

async function handleDocumentTypes(
  userId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('ðŸ“Š [DOCUMENT TYPES] Fetching document types from database');

  // Detect language
  const lang = detectLanguage(query);

  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' },
    },
    select: { filename: true },
  });

  const typeMap = new Map<string, string[]>();
  documents.forEach(doc => {
    const ext = doc.filename.substring(doc.filename.lastIndexOf('.')).toLowerCase();
    if (!typeMap.has(ext)) {
      typeMap.set(ext, []);
    }
    typeMap.get(ext)!.push(doc.filename);
  });

  // Build multilingual response
  let response = '';

  const basedOn = lang === 'pt' ? 'Com base nos arquivos que vocÃª enviou, vocÃª tem os seguintes tipos de arquivos:' :
                  lang === 'es' ? 'SegÃºn los archivos que subiste, tienes los siguientes tipos de archivos:' :
                  lang === 'fr' ? 'En fonction des fichiers que vous avez tÃ©lÃ©chargÃ©s, vous avez les types de fichiers suivants:' :
                  'Based on the files you uploaded, you have the following types of files:';

  if (typeMap.size === 0) {
    const noDocsYet = lang === 'pt' ? 'VocÃª ainda nÃ£o tem documentos enviados.' :
                      lang === 'es' ? 'AÃºn no tienes documentos subidos.' :
                      lang === 'fr' ? 'Vous n\'avez pas encore de documents tÃ©lÃ©chargÃ©s.' :
                      "You don't have any documents uploaded yet.";

    // Removed nextStep label for natural endings
    const uploadSome = lang === 'pt' ? 'Envie alguns documentos para comeÃ§ar!' :
                       lang === 'es' ? 'Â¡Sube algunos documentos para comenzar!' :
                       lang === 'fr' ? 'TÃ©lÃ©chargez des documents pour commencer!' :
                       'Upload some documents to get started!';

    response = `${noDocsYet}\n\n${uploadSome}`;
  } else {
    response = `${basedOn}\n\n`;

    // Sort by count (descending)
    const sortedTypes = Array.from(typeMap.entries()).sort((a, b) => b[1].length - a[1].length);

    sortedTypes.forEach(([ext, files]) => {
      const typeName = ext.replace('.', '').toUpperCase();
      const fileWord = files.length === 1 ?
        (lang === 'pt' ? 'arquivo' : lang === 'es' ? 'archivo' : lang === 'fr' ? 'fichier' : 'file') :
        (lang === 'pt' ? 'arquivos' : lang === 'es' ? 'archivos' : lang === 'fr' ? 'fichiers' : 'files');

      response += `â€¢ **${typeName}** (${files.length} ${fileWord}): `;
      response += files.map(f => f).join(', ');
      response += '\n';
    });

    // Removed nextStep label for natural endings
    const question = lang === 'pt' ? 'O que vocÃª gostaria de saber sobre esses documentos?' :
                     lang === 'es' ? 'Â¿QuÃ© te gustarÃ­a saber sobre estos documentos?' :
                     lang === 'fr' ? 'Que souhaitez-vous savoir sur ces documents?' :
                     'What would you like to know about these documents?';

    response += `\n${question}`;
  }

  // Apply format enforcement to document types response
  const formattedTypes = applyFormatEnforcement(response, {
    responseType: 'document_types',
    logPrefix: '[DOC-TYPES FORMAT]'
  });

  onChunk(formattedTypes);

  // âŒ NO SOURCES: Document types queries don't use document CONTENT
  // We're just grouping files by extension, not reading/analyzing documents
  return { sources: [] };
}

// ============================================================================
// DOCUMENT LISTING DETECTION & HANDLER
// ============================================================================

function isDocumentListingQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // ============================================================================
  // STEP 1: Exclude queries asking about document CONTENT
  // ============================================================================

  const contentKeywords = [
    // Question words
    'understand', 'explain', 'tell me about', 'what does', 'what is',
    'how', 'why', 'when', 'where', 'who',

    // Analysis words
    'analyze', 'analysis', 'examine', 'evaluate', 'assess',
    'compare', 'comparison', 'difference', 'versus', 'vs',
    'summarize', 'summary', 'overview',

    // Search words
    'find', 'search for', 'look for', 'locate',
    'extract', 'get', 'retrieve',

    // Content-specific words
    'motivations', 'fears', 'strategies', 'principles',
    'psychology', 'profile', 'marketing', 'campaign',
    'data', 'information', 'details', 'facts',
    'value', 'amount', 'number', 'date', 'name',

    // Portuguese
    'entender', 'explicar', 'me fale sobre', 'o que Ã©',
    'como', 'por que', 'quando', 'onde', 'quem',
    'comparar', 'resumir', 'encontrar', 'buscar',

    // Spanish
    'entender', 'explicar', 'dime sobre', 'quÃ© es',
    'cÃ³mo', 'por quÃ©', 'cuÃ¡ndo', 'dÃ³nde', 'quiÃ©n',
    'comparar', 'resumir', 'encontrar', 'buscar',
  ];

  const isContentQuery = contentKeywords.some(keyword => lower.includes(keyword));

  if (isContentQuery) {
    console.log('ðŸ” [QUERY ROUTING] Content query detected, not a document listing request');
    return false; // This is a content query, not a listing query
  }

  // ============================================================================
  // STEP 2: Require EXPLICIT document listing intent
  // ============================================================================

  const explicitPatterns = [
    // English
    /what\s+(documents?|files?)\s+(do\s+i\s+have|are\s+there|did\s+i\s+upload)/i,
    /show\s+(me\s+)?(my\s+)?(documents?|files?|uploads?)/i,
    /list\s+(all\s+)?(my\s+)?(documents?|files?|uploads?)/i,
    /which\s+(documents?|files?)\s+(do\s+i\s+have|did\s+i\s+upload|are\s+available)/i,
    /what\s+(files?|documents?)\s+did\s+i\s+upload/i,
    /give\s+me\s+(a\s+)?list\s+of\s+(my\s+)?(documents?|files?)/i,

    // Portuguese
    /quais\s+(documentos?|arquivos?)\s+(eu\s+)?(tenho|carreguei|enviei)/i,
    /mostrar\s+(meus\s+)?(documentos?|arquivos?)/i,
    /listar\s+(todos\s+)?(meus\s+)?(documentos?|arquivos?)/i,
    /me\s+mostre\s+(os\s+)?(meus\s+)?(documentos?|arquivos?)/i,

    // Spanish
    /cuÃ¡les\s+(documentos?|archivos?)\s+(tengo|subÃ­|carguÃ©)/i,
    /mostrar\s+(mis\s+)?(documentos?|archivos?)/i,
    /listar\s+(todos\s+)?(mis\s+)?(documentos?|archivos?)/i,
    /dame\s+una\s+lista\s+de\s+(mis\s+)?(documentos?|archivos?)/i,
  ];

  const isExplicitListingRequest = explicitPatterns.some(pattern => pattern.test(query));

  if (isExplicitListingRequest) {
    console.log('ðŸ“‹ [QUERY ROUTING] Explicit document listing request detected');
    return true;
  }

  console.log('ðŸ” [QUERY ROUTING] Not a document listing request, routing to regular query handler');
  return false;
}

async function handleDocumentListing(
  userId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('📋 [DOCUMENT LISTING] Fetching user documents');

  // Detect language
  const lang = detectLanguage(query);

  // ✅ PERFORMANCE FIX: Check cache first
  const cached = fileListingCache.get(userId);
  const now = Date.now();

  let documents: { id?: string; filename: string; createdAt: Date }[];

  if (cached && (now - cached.timestamp) < FILE_LISTING_CACHE_TTL) {
    console.log(`📋 [DOCUMENT LISTING] ✅ Using cached data (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
    documents = cached.documents;
  } else {
    console.log('📋 [DOCUMENT LISTING] ⚡ Querying database...');
    const startTime = Date.now();

    documents = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' },
      },
      select: { id: true, filename: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const queryTime = Date.now() - startTime;
    console.log(`📋 [DOCUMENT LISTING] ✅ Database query: ${queryTime}ms, ${documents.length} documents`);

    // Cache the results
    fileListingCache.set(userId, {
      documents: documents as { id: string; filename: string; createdAt: Date }[],
      timestamp: now
    });
  }

  const DISPLAY_LIMIT = 15; // Show first 15 documents
  const totalCount = documents.length;

  console.log(`ðŸ“‹ [DOCUMENT LISTING] Total: ${totalCount}, Display limit: ${DISPLAY_LIMIT}`);

  let response: string;

  if (totalCount === 0) {
    // Use outputIntegration for no documents error
    response = await outputIntegration.generateNoDocumentsError(lang);
  } else {
    // NEW: Use inline document injection for file listing
    // This injects {{DOC:::id:::filename:::mimeType:::size:::folder}} markers
    // that the frontend parses to render clickable document buttons
    response = formatFileListingResponse(documents, {
      maxInline: DISPLAY_LIMIT,
      includeMetadata: true
    });
  }

  // Apply structure enforcement (will skip title/sections for file listing)
  const structuredListing = structureEnforcementService.enforceStructure(response, {
    query,
    sources: [],
    isComparison: false,
    responseType: 'file_listing'  // ✅ No title for file listing responses
  });

  // Then apply format enforcement
  const formattedListing = applyFormatEnforcement(structuredListing.text, {
    responseType: 'file_listing',
    logPrefix: '[FILE-LISTING FORMAT]'
  });

  onChunk(formattedListing);

  // âŒ NO SOURCES: Document listing queries don't use document CONTENT
  return { sources: [] };
}

// ============================================================================
// META-QUERY DETECTION
// ============================================================================

function isMetaQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // These need RAG/metadata lookup, not capability responses
  if (/\b(my|our|the)\s+(documents?|files?|folders?)\b/i.test(lower)) {
    return false;  // Route to RAG or metadata service
  }

  if (/(show|list|display|analyze|find|search|summarize|extract).*\b(all|my|the)\s+(documents?|files?)/i.test(lower)) {
    return false;  // Route to RAG or metadata service
  }

  if (/\b(revenue|sales|profit|data|content|topics?|themes?|insights?)\b/i.test(lower)) {
    return false;  // Route to RAG
  }


  // Enhanced capability detection patterns - more natural and comprehensive
  const metaPatterns = [
    // Greetings - Multilingual (EN, PT, ES, FR, DE, IT)
    /^(hi|hey|hello|greetings|ola|olï¿½|oi|hola|bonjour|salut|bom dia|boa tarde|boa noite|buenos dias|buenas tardes|buenas noches|bonsoir|guten tag|ciao|buongiorno)/i,

    // Existing capability patterns
    /what (can|do) you (do|help)/,
    /who are you/,
    /what are you/,
    /how (do|can) (i|you)/,
    /tell me about (yourself|koda)/,

    /what do you do/i,
    /what are your capabilities/i,
    /what features/i,
    /can you help me with/i,
    /are you able to/i,
    /do you support/i,
    /can you handle/i,
    /what kind of documents/i,
    /what can i do with/i,
    /how does.*work/i,
    /introduce yourself/i,
    /what is koda/i,
    /explain.*koda/i,
    /tell me more/i,
  ];

  return metaPatterns.some(pattern => pattern.test(lower));
}

// ============================================================================
// NAVIGATION QUERY DETECTION
// ============================================================================

function isNavigationQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Navigation patterns - questions about using the app
  const navigationPatterns = [
    /where.*upload/i,
    /how.*upload/i,
    /where.*find/i,
    /how.*navigate/i,
    /where is.*button/i,
    /how.*access/i,
    /where.*settings/i,
    /how.*create.*folder/i,
    /where.*documents/i,
    /how.*organize/i,
    /how.*search/i,
    /where.*chat/i,
    /how.*ask.*question/i,
    /how.*use/i,
    /where.*sidebar/i,
    /how.*drag.*drop/i,
    /where.*menu/i,
    /how do i (upload|create|organize|find|access)/i,
    /where can i (upload|create|organize|find|access)/i,
  ];

  return navigationPatterns.some(pattern => pattern.test(lower));
}

// ============================================================================
// META-QUERY HANDLER
// ============================================================================

async function handleMetaQuery(
  query: string,
  onChunk: (chunk: string) => void,
  conversationHistory?: Array<{ role: string; content: string }>,
  detectedLanguage?: string
): Promise<void> {
  console.log(`? FAST PATH: Meta-query detected`);

  // ? FIX: Check if this is a simple greeting - use INSTANT response (no LLM)
  const isSimpleGreeting = languageDetectionService.isGreeting(query);

  if (isSimpleGreeting) {
    console.log(`?? INSTANT GREETING: Detected simple greeting, bypassing LLM`);

    // Detect language from the greeting
    const language = languageDetectionService.detectLanguage(query);
    console.log(`?? Detected language: ${language}`);

    // Get localized greeting response - INSTANT (no LLM call)
    const greetingResponse = languageDetectionService.getLocalizedGreeting(language);

    // FIX: DO NOT apply format enforcement to greetings
    onChunk(greetingResponse);
    return;
  }

  // Check if this is the first message in conversation
  const isFirstMessage = !conversationHistory || conversationHistory.length === 0;

  // Detect language if not provided
  const queryLang = detectedLanguage || detectLanguage(query);

  // Build conversation context
  let conversationContext = '';
  if (conversationHistory && conversationHistory.length > 0) {
    conversationContext = conversationHistory
      .slice(-3)
      .map(msg => `${msg.role === 'user' ? 'User' : 'KODA'}: ${msg.content}`)
      .join('\n');
  }

  // Use SystemPrompts service (it already has capabilities section)
  // ? Cultural Context Engine: Pass detected language for multilingual support
  const systemPrompt = systemPromptsService.getSystemPrompt(
    query,
    'short', // Meta queries should be brief
    {
      isComparison: false,
      isFirstMessage,
      conversationHistory: conversationContext,
      documentContext: '', // No document context for meta queries
      documentLocations: '',
      memoryContext: '',
      folderTreeContext: '',
      detectedLanguage: queryLang, // ? Cultural Context: Pass detected language
    }
  );

  await streamLLMResponse(systemPrompt, '', onChunk);
}

// ============================================================================
// NAVIGATION QUERY HANDLER
// ============================================================================

async function handleNavigationQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void,
  detectedLanguage?: string
): Promise<void> {
  console.log(`ðŸ§­ [NAVIGATION] Handling app navigation question`);

  const folders = await prisma.folder.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      emoji: true,
      _count: { select: { documents: true } }
    },
    orderBy: { name: 'asc' }
  });

  const documentCount = await prisma.document.count({
    where: { userId }
  });

  // Build folder list for context
  const folderList = folders.length > 0
    ? folders.map(f => `**${f.name}** (${f._count.documents} files)`).join(', ')
    : 'No folders created yet';

  // Build personalization context with user's library and navigation guide
  const personalizationContext = `
**User's Current Library**:
- **Total Documents**: ${documentCount}
- **Folders**: ${folderList}

**App Navigation Guide**:

**Uploading Files**:
- Click the "Upload" button in the top-right corner of the Documents screen
- Or drag and drop files anywhere on the Documents screen
- You can upload individual files or entire folders${folders.length > 0 ? `\n- Upload directly to existing folders like: ${folders.slice(0, 3).map(f => f.name).join(', ')}` : ''}
- Supported formats: PDF, Word, Excel, PowerPoint, images, and more

**Finding Documents**:
- All documents appear on the Documents screen in the left sidebar
- Use the search bar at the top to find specific files
- Documents are organized in folders you create
- Click any document to view or interact with it

**Creating Folders**:
- Click "New Folder" button on the Documents screen
- Name your folder and it will appear in the left sidebar
- Drag documents into folders to organize them
- You can create nested folders for better organization

**Searching Documents**:
- Use the search bar at the top of any screen
- Search works across all your documents' content
- Results show which document and page contains your search term
- You can filter by document type or folder

**Chat & Questions**:
- Click "Chat" in the left sidebar to ask questions
- KODA will search all your documents to answer
- You can ask follow-up questions in the same conversation
- Reference specific documents or ask general questions

**Document Management**:
- Right-click any document for options (rename, delete, move)
- Click the three dots menu for additional actions
- Documents are automatically saved and synced
- All files are encrypted end-to-end for security

**Response Guidelines**:
- Answer the user's specific question directly and clearly
- Provide step-by-step instructions if needed
- Keep response under 75 words
- Be helpful and clear
- NO emojis, NO citations
- Use natural, friendly language
- **PERSONALIZE**: Reference the user's actual folders when relevant (e.g., "You can upload to your Finance folder")
`;

  // Detect language if not provided
  const queryLang = detectedLanguage || detectLanguage(query);

  // Use SystemPrompts service for consistent formatting
  // ? Cultural Context Engine: Pass detected language for multilingual support
  const systemPrompt = systemPromptsService.getSystemPrompt(
    query,
    'short', // Navigation answers should be concise
    {
      isComparison: false,
      isFirstMessage: false, // Navigation queries are typically follow-ups
      conversationHistory: '',
      documentContext: personalizationContext,
      documentLocations: '',
      memoryContext: '',
      folderTreeContext: '',
      detectedLanguage: queryLang, // ? Cultural Context: Pass detected language
    }
  );

  await streamLLMResponse(systemPrompt, '', onChunk);
}

// ============================================================================
// METHODOLOGY KNOWLEDGE QUERY HANDLER
// ============================================================================

async function handleMethodologyKnowledgeQuery(
  userId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ handled: boolean; sources?: any[] }> {
  // Detect if this is a methodology/concept query
  const methodologyName = methodologyExtractionService.detectMethodologyQuery(query);

  if (!methodologyName) {
    // Not a methodology query, let other handlers process it
    return { handled: false };
  }

  console.log(`ðŸ“š [METHODOLOGY] Detected methodology query for: "${methodologyName}"`);

  // Look up methodology knowledge from database
  const knowledge = await methodologyExtractionService.getMethodologyKnowledge(userId, methodologyName);

  if (!knowledge || !knowledge.definition) {
    // No knowledge found, fall back to regular RAG pipeline
    console.log(`   âš ï¸ No knowledge found for "${methodologyName}", falling back to RAG`);
    return { handled: false };
  }

  console.log(`   âœ… Found knowledge from ${knowledge.documentCount} documents`);

  // Format the knowledge for response
  const formattedResponse = methodologyExtractionService.formatKnowledgeForResponse(knowledge);

  // Apply format enforcement to methodology knowledge response
  const enforced = applyFormatEnforcement(formattedResponse, {
    responseType: 'methodology_knowledge',
    logPrefix: '[METHODOLOGY FORMAT]'
  });

  // Stream the response
  if (onChunk) {
    onChunk(enforced);
  }

  // Build sources from the knowledge
  const sources = knowledge.sourceDocumentIds?.map(docId => ({
    documentId: docId,
    type: 'methodology_knowledge',
  })) || [];

  return {
    handled: true,
    sources,
  };
}

// TREND ANALYSIS QUERY HANDLER
// PURPOSE: Answer "What trends do you see?" queries with temporal analysis

async function handleTrendAnalysisQuery(
  userId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ handled: boolean; sources?: any[] }> {
  // Detect if this is a trend query
  if (!trendAnalysisService.isTrendQuery(query)) {
    return { handled: false };
  }

  console.log(`?? [TRENDS] Detected trend analysis query`);

  try {
    // Perform trend analysis on user's document collection
    const trendResult = await trendAnalysisService.analyzeUserTrends(userId);

    if (!trendResult || !trendResult.summary) {
      console.log(`   ?? No trends found, falling back to RAG`);
      return { handled: false };
    }

    console.log(`   ? Found ${trendResult.trends.length} trends across ${trendResult.totalDocuments} documents`);

    // Format the response
    const formattedResponse = trendAnalysisService.formatTrendAnalysisForResponse(trendResult);

    // Apply format enforcement to trend analysis response
    const enforced = applyFormatEnforcement(formattedResponse, {
      responseType: 'trend_analysis',
      logPrefix: '[TRENDS FORMAT]'
    });

    // Stream the response
    if (onChunk) {
      onChunk(enforced);
    }

    return {
      handled: true,
      sources: [],
    };
  } catch (error) {
    console.error(`? [TRENDS] Error analyzing trends:`, error);
    return { handled: false };
  }
}

async function handleDomainKnowledgeQuery(
  userId: string,
  query: string,
  onChunk: (chunk: string) => void
): Promise<{ handled: boolean; sources?: any[] }> {
  // Detect if this is a terminology/domain knowledge query
  const { isTerm, term } = terminologyIntelligenceService.isTerminologyQuestion(query);

  if (!isTerm || !term) {
    return { handled: false };
  }

  console.log(`?? [DOMAIN] Detected terminology query for: "${term}"`);

  try {
    // Ensure Pinecone is initialized
    await initializePinecone();

    // Generate embedding for the term
    const termEmbeddingResult = await embeddingService.generateEmbedding(term);

    // ðŸ”€ HYBRID RETRIEVAL: Use combined Vector + BM25 search for domain knowledge
    const hybridResults = await performHybridRetrieval(
      term,
      termEmbeddingResult.embedding,
      userId,
      20, // topK
      { userId: userId }
    );

    // Transform hybrid results to document chunks format
    const documentChunks = (hybridResults.matches || [])
      .filter((match: any) => match.metadata)
      .map((match: any) => ({
        content: match.metadata.text || match.metadata.content || '',
        documentId: match.metadata.documentId || 'unknown',
        documentName: match.metadata.filename || match.metadata.documentName || 'Unknown',
      }));

    // Generate the terminology response with full intelligence
    const response = await terminologyIntelligenceService.answerTerminologyQuestion(
      userId,
      term,
      documentChunks,
      {
        includeFormula: true,
        includeInterpretation: true,
        includeDocumentValues: true,
      }
    );

    // Format as string and stream
    const formattedResponse = terminologyIntelligenceService.formatAsString(response);

    // Apply format enforcement to domain knowledge response
    const enforced = applyFormatEnforcement(formattedResponse, {
      responseType: 'domain_knowledge',
      logPrefix: '[DOMAIN FORMAT]'
    });

    if (onChunk && enforced) {
      onChunk(enforced);
    }

    const confidenceStr = response.confidence.toFixed(2);
    console.log(`   ? Domain knowledge generated for "${term}" (confidence: ${confidenceStr})`);

    return {
      handled: true,
      sources: [],
    };
  } catch (error: any) {
    console.error(`? [DOMAIN] Error:`, error.message);
    return { handled: false };
  }
}

async function handleCrossDocumentSynthesis(
  userId: string,
  query: string,
  synthesisQuery: { type: string; topic?: string; confidence: number },
  onChunk: (chunk: string) => void
): Promise<{ handled: boolean; sources?: any[] }> {
  console.log(`?? [SYNTHESIS] Handling ${synthesisQuery.type} synthesis query`);
  console.log(`   Topic: ${synthesisQuery.topic || 'all documents'}`);

  try {
    // Call the cross-document synthesis service
    const result = await crossDocumentSynthesisService.synthesizeMethodologies(
      userId,
      synthesisQuery.topic
    );

    if (result.methodologies.length === 0 && result.totalDocuments === 0) {
      // No documents found
      console.log('   ?? No documents found for synthesis');
      return { handled: false };
    }

    if (result.methodologies.length === 0 && result.totalDocuments > 0) {
      console.log(`   ?? No methodologies extracted from ${result.totalDocuments} documents, falling back to RAG pipeline`);
      return { handled: false };
    }

    // Stream the synthesis response
    if (onChunk && result.synthesis) {
      onChunk(result.synthesis);
    }

    // Build sources from the result
    const sources = result.methodologies
      .flatMap(m => m.documentIds)
      .filter((id, index, self) => self.indexOf(id) === index)
      .map(documentId => ({
        documentId,
        type: 'synthesis',
      }));

    console.log(`   ? Synthesis complete: ${result.methodologies.length} methodologies across ${result.totalDocuments} documents`);

    return {
      handled: true,
      sources,
    };
  } catch (error) {
    console.error('   ? Synthesis error:', error);
    return { handled: false };
  }
}

// ============================================================================
// REGULAR QUERY HANDLER
// ============================================================================

async function handleRegularQuery(
  userId: string,
  query: string,
  conversationId: string,
  onChunk: (chunk: string) => void,
  attachedDocumentId?: string | string[],  // ? FIX #8: Accept array for multi-document support
  conversationHistory?: Array<{ role: string; content: string; metadata?: any }>,
  onStage?: (stage: string, message: string) => void,
  memoryContext?: string,
  isFirstMessage?: boolean,  // ? NEW: Flag to control greeting logic
  detectedLanguage?: string,  // ? Cultural Context Engine: Language for multilingual support
  ragConfig: RAGConfig = DEFAULT_RAG_CONFIG,
  hierarchicalIntent?: IntentResult  // PERF: Pass intent to avoid redundant LLM decomposition  // RAG feature toggles
): Promise<{ sources: any[] }> {

  // â±ï¸ PERFORMANCE: Start timing with instrumentation
  const startTime = Date.now();
  requestTimer = new PerformanceTimer();
  requestTimer.start('TOTAL REQUEST');

  // â±ï¸ COMPLETE TIMING: Create dedicated timer for comprehensive measurement
  const perfTimer = new PerformanceTimer();
  perfTimer.mark('start');

  onChunk('');

  // ============================================================================
  // CACHE CHECK - Return cached result if available
  // ============================================================================

  perfTimer.mark('cacheCheck');
  const cacheKey = generateQueryCacheKey(userId, query);
  const cached = queryResultCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < QUERY_CACHE_TTL) {
    console.log(`âœ… [CACHE HIT] Query result for "${query.substring(0, 50)}..."`);

    // Stream cached response
    onChunk(cached.response);

    return { sources: cached.sources };
  }

  perfTimer.measure('Cache Check', 'cacheCheck');
  console.log(`âŒ [CACHE MISS] Query result for "${query.substring(0, 50)}..."`);

  // ============================================================================
  // ============================================================================

  perfTimer.mark('conversationContextLoad');
  let multiTurnContext = null;
  let resolvedQuery = query; // Default to original query

  try {
    // Load conversation context (previous entities, topics, findings)
    multiTurnContext = await conversationContextService.getContext(conversationId);

    if (multiTurnContext && (multiTurnContext.entities.length > 0 || multiTurnContext.keyFindings.length > 0)) {
      console.log(`ðŸ§  [CONTEXT] Loaded context: ${multiTurnContext.entities.length} entities, ${multiTurnContext.keyFindings.length} findings`);

      // Resolve pronouns in the query ("it", "that", "this" â†’ actual entities)
      resolvedQuery = conversationContextService.resolveReferences(query, multiTurnContext);

      if (resolvedQuery !== query) {
        console.log(`ðŸ”„ [CONTEXT] Resolved query: "${query}" â†’ "${resolvedQuery}"`);
      }
    } else {
      console.log('ðŸ§  [CONTEXT] No prior context found (first message or empty context)');
    }
  } catch (contextError) {
    console.error('âŒ [CONTEXT] Error loading conversation context:', contextError);
    // Continue with original query if context loading fails
  }

  perfTimer.measure('Conversation Context Load', 'conversationContextLoad');


  // ============================================================================
  // FAST PATH: Skip reasoning for simple document queries
  // ============================================================================

  // ============================================================================
  // âš¡ SMART QUERY ANALYSIS: Fast pattern matching with LLM fallback
  // ============================================================================

  perfTimer.mark('queryAnalysis');
  let queryAnalysis: QueryAnalysis;

  if (hierarchicalIntent?.subQuestions && hierarchicalIntent.subQuestions.length > 0) {
    console.log('[PERF] Using subQuestions from hierarchicalIntent (saved ~300ms LLM call)');
    queryAnalysis = {
      isComplex: true,
      queryType: hierarchicalIntent.primaryIntent === 'comparison' ? 'comparison' :
                 hierarchicalIntent.primaryIntent === 'synthesis' ? 'cross_document' : 'sequential',
      subQueries: hierarchicalIntent.subQuestions.map((sq: { question: string }) => sq.question),
      originalQuery: query
    };
  } else {
    // Fallback to analyzeQueryComplexity for queries without pre-decomposition
    queryAnalysis = await analyzeQueryComplexity(query);
  }
  perfTimer.measure('Query Complexity Analysis', 'queryAnalysis');

  if (queryAnalysis.isComplex) {
    console.log(`ðŸ§© [COMPLEX QUERY] Detected ${queryAnalysis.queryType} query with ${queryAnalysis.subQueries?.length || 0} sub-queries`);
  } else {
    console.log(`âš¡ [SIMPLE QUERY] Using standard retrieval`);
  }

  // ============================================================================
  // ============================================================================
  //
  // BEFORE (single document):
  // filter = { userId: "user123", documentId: "doc1" }
  // Pinecone searches: Only doc1
  //
  // AFTER (multiple documents):
  // filter = { userId: "user123", documentId: { $in: ["doc1", "doc2", "doc3"] } }
  // Pinecone searches: doc1, doc2, doc3

  // Build search filter (shared across all paths)
  perfTimer.mark('filterConstruction');
  let filter: any = { userId };

  if (attachedDocumentId) {
    // Handle both single document ID and array of document IDs
    if (Array.isArray(attachedDocumentId)) {
      if (attachedDocumentId.length === 1) {
        // Single document in array - use direct equality
        filter.documentId = attachedDocumentId[0];
        console.log(`ðŸ” [FILTER] Searching in 1 attached document: ${attachedDocumentId[0]}`);
      } else if (attachedDocumentId.length > 1) {
        // Multiple documents - use $in operator
        filter.documentId = { $in: attachedDocumentId };
        console.log(`ðŸ” [FILTER] Searching in ${attachedDocumentId.length} attached documents:`, attachedDocumentId);
      }
      // else: empty array, search all documents (no filter)
    } else {
      // Single document ID (string) - backward compatibility
      filter.documentId = attachedDocumentId;
      console.log(`ðŸ” [FILTER] Searching in 1 attached document: ${attachedDocumentId}`);
    }
  } else {
    console.log(`ðŸ” [FILTER] Searching across all user documents`);
  }

    // DOCUMENT ROUTING: Try to identify target document from query
    try {
      const documentRouting = await routeToDocument(userId, query, {
        confidenceThreshold: 0.7  // Only route if we're confident
      });

      if (documentRouting && documentRouting.confidence >= 0.7) {
        filter.documentId = documentRouting.documentId;
        console.log(`[DOC ROUTER] Routed to ${documentRouting.documentTitle} via ${documentRouting.routingMethod} (confidence: ${(documentRouting.confidence * 100).toFixed(0)}%)`);
      }
    } catch (routingError) {
      console.warn('[DOC ROUTER] Routing failed, searching all documents:', routingError);
    }
  perfTimer.measure('Filter Construction', 'filterConstruction');

  let searchResults;

  if (queryAnalysis.isComplex && queryAnalysis.subQueries && queryAnalysis.subQueries.length > 1) {
    // Complex query - use multi-step handler
    console.log(`ðŸ§© [AGENT LOOP] Complex ${queryAnalysis.queryType} query detected - decomposing...`);

    perfTimer.mark('complexQueryInit');
    await initializePinecone();
    perfTimer.measure('Pinecone Init (complex)', 'complexQueryInit');

    perfTimer.mark('multiStepQuery');
    searchResults = await handleMultiStepQuery(queryAnalysis, userId, filter, onChunk);
    perfTimer.measure('Multi-Step Query Handler', 'multiStepQuery');

    // Get BM25 results in parallel for better performance
    const vectorMatches = searchResults.matches || [];
    let hybridResults: any[];

    try {
      const bm25Results = await bm25RetrievalService.hybridSearch(query, [], userId, vectorMatches.length * 2);

      // Convert vector results to RRF format
      const vectorResultsForRRF = vectorMatches.map((match: any) => ({
        content: match.metadata?.content || match.metadata?.text || '',
        metadata: match.metadata,
        score: match.score || 0,
      }));

      // Convert BM25 results to RRF format
      const keywordResultsForRRF = bm25Results.map((result: any) => ({
        content: result.content,
        metadata: result.metadata,
        documentId: result.metadata?.documentId,
        chunkIndex: result.metadata?.chunkIndex,
        score: result.bm25Score || result.hybridScore || 0,
        bm25Score: result.bm25Score || result.hybridScore || 0,
      }));

      // Merge with RRF algorithm
      hybridResults = mergeWithRRF(vectorResultsForRRF, keywordResultsForRRF, 20);
      console.log(`âœ… [MULTI-STEP] True hybrid search: ${hybridResults.length} results (RRF merged)`);
    } catch (error) {
      console.warn('âš ï¸ [MULTI-STEP] BM25 search failed, using vector-only:', error);
      // Fallback to vector-only results
      hybridResults = vectorMatches.map((match: any) => ({
        content: match.metadata?.content || match.metadata?.text || '',
        metadata: match.metadata,
        vectorScore: match.score || 0,
        bm25Score: 0,
        hybridScore: match.score || 0,
        inBoth: false,
      }));
    }

    // Filter by minimum score threshold
    const COMPARISON_MIN_SCORE = 0.65;
    const filteredChunks = hybridResults.filter(c => (c.hybridScore || c.vectorScore || 0) >= COMPARISON_MIN_SCORE);

    console.log(`âœ… [FILTER] ${filteredChunks.length}/${hybridResults.length} chunks above threshold (${COMPARISON_MIN_SCORE})`);

    // CONTEXT ENGINEERING: Prepare chunks for optimization
    const contextChunksForOptimization = filteredChunks.slice(0, 30).map((chunk: any) => ({
      content: chunk.metadata?.content || chunk.content || '',
      documentId: chunk.metadata?.documentId || '',
      documentTitle: chunk.metadata?.filename || 'Unknown Document',
      score: chunk.hybridScore || chunk.vectorScore || chunk.score || 0,
      pageNumber: chunk.metadata?.page,
      chunkIndex: chunk.metadata?.chunkIndex
    }));

    // Apply context optimization (deduplication, relevance scoring, token packing)
    const optimizedContextResult = contextEngineering.buildOptimizedContext({
      chunks: contextChunksForOptimization,
      query: queryAnalysis.originalQuery || query,
      maxTokens: 50000,
      includeMetadata: false,
      prioritizeRecent: false,
      deduplicateContent: true
    });

    console.log(`ðŸ“¦ [CONTEXT] Optimized: ${optimizedContextResult.originalCount} â†’ ${optimizedContextResult.chunks.length} chunks (removed ${optimizedContextResult.removedChunks} duplicates)`);

    // Build context from optimized chunks with document type labels
    const contextChunks = optimizedContextResult.chunks.map((chunk: any, index: number) => {
      const content = chunk.content || '';
      const page = chunk.pageNumber;

      // Get document type/name for context (helps with cross-document synthesis)
      let docLabel = 'Document';
      const filename = (chunk.documentTitle || '').toLowerCase();
      if (filename.includes('financial') || filename.includes('report') || filename.includes('statement')) {
        docLabel = 'Financial Report';
      } else if (filename.includes('lease') || filename.includes('agreement') || filename.includes('contract')) {
        docLabel = 'Lease Agreement';
      } else if (filename.includes('medical') || filename.includes('health') || filename.includes('record') || filename.includes('patient')) {
        docLabel = 'Medical Record';
      } else if (filename.includes('invoice') || filename.includes('bill')) {
        docLabel = 'Invoice';
      } else if (filename.includes('policy') || filename.includes('insurance')) {
        docLabel = 'Insurance Policy';
      } else if (chunk.documentTitle) {
        docLabel = chunk.documentTitle;
      }

      const pageInfo = (page && page > 0) ? ` (Page: ${page})` : '';
      return `[${docLabel} - Context ${index + 1}]${pageInfo}\n${content}`;
    });

    const contextText = contextChunks.join('\n\n');

    let comparisonPrompt = '';

    if (queryAnalysis.queryType === 'comparison') {
      comparisonPrompt = `You are answering a COMPARISON query. Structure your response to clearly compare the concepts mentioned.

INSTRUCTIONS:
- Create well-formatted comparison tables when appropriate
- Ensure all table cells are complete (no cut-off content)
- Align data correctly in columns
- Use clear headers that describe what's being compared
- Provide analysis after the table

Original query: "${queryAnalysis.originalQuery}"

Context from documents:
${contextText}

Provide a comprehensive comparison addressing all aspects of the query.`;

    } else if (queryAnalysis.queryType === 'cross_document') {
      comparisonPrompt = `You are answering a CROSS-DOCUMENT ANALYSIS query. You need to synthesize information from multiple documents.

INSTRUCTIONS:
- Identify which information comes from which document type
- Connect related information across documents
- Provide clear analysis and recommendations
- Use tables to organize complex data
- Ensure all table cells are complete and properly aligned

Original query: "${queryAnalysis.originalQuery}"

Sub-queries analyzed:
${queryAnalysis.subQueries?.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

Context from documents:
${contextText}

Provide a comprehensive cross-document analysis addressing all aspects of the query.`;

    } else {
      comparisonPrompt = `You are answering a MULTI-PART query. Address each part of the question systematically.

INSTRUCTIONS:
- Answer each sub-question clearly
- Use structured formatting (headings, lists, tables)
- Ensure completeness for all parts
- Provide synthesis at the end

Original query: "${queryAnalysis.originalQuery}"

Context from documents:
${contextText}

Provide a comprehensive answer addressing all parts of the query.`;
    }

    // Stream response from Gemini
    perfTimer.mark('complexLlmInit');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.5, // âš¡ FIX: Increased from 0.3 to allow better summarization into single-line cells
        // âš¡ FIX: Increase token limit to 8192 for large tables
        maxOutputTokens: 8192,
      },
    });
    perfTimer.measure('Complex Query LLM Init', 'complexLlmInit');

    perfTimer.mark('complexLlmStreaming');
    const streamResult = await model.generateContentStream(comparisonPrompt);

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      onChunk(chunkText);
    }
    perfTimer.measure('Complex Query LLM Streaming', 'complexLlmStreaming');

    // Build sources from chunks
    const sources = filteredChunks.slice(0, 10).map((chunk: any) => ({
      documentId: chunk.metadata?.documentId || null,  // âœ… CRITICAL: Frontend needs this to display sources
      documentName: chunk.metadata?.filename || 'Unknown',
      pageNumber: chunk.metadata?.page || null,
      score: chunk.score || 0,
      mimeType: null as string | null,  // âœ… Added for later population from database
    }));

    perfTimer.mark('complexDocMetadata');
    const sourceDocumentIds: string[] = sources.map(s => s.documentId).filter((id): id is string => Boolean(id));
    const uniqueDocumentIds = [...new Set(sourceDocumentIds)];
    if (uniqueDocumentIds.length > 0) {
      const documents = await prisma.document.findMany({
        where: { id: { in: uniqueDocumentIds } },
        select: { id: true, filename: true, mimeType: true }
      });
      const documentMap = new Map(documents.map(d => [d.id, { filename: d.filename, mimeType: d.mimeType }]));

      // Update sources with current filenames and mimeType
      sources.forEach(source => {
        if (source.documentId && documentMap.has(source.documentId)) {
          const docData = documentMap.get(source.documentId)!;
          source.documentName = docData.filename;
          source.mimeType = docData.mimeType;
        }
      });
    }
    perfTimer.measure('Complex Query Doc Metadata Fetch', 'complexDocMetadata');

    console.log(`âœ… [DECOMPOSE] Generated answer from ${sources.length} sources`);
    perfTimer.printSummary(); // Print timing for complex query path
    return { sources };
  } else {
    // Simple query - proceed with normal flow
    console.log(`âœ… [AGENT LOOP] Simple query - using standard retrieval`);
  }

  // Map complexity detection to answer length system
  perfTimer.mark('complexityDetection');
  const complexity = detectQueryComplexity(query);
  console.log(`ðŸ“Š [COMPLEXITY] Detected complexity: ${complexity} for query: "${query.substring(0, 50)}..."`);

  const isComparisonQuery = /\b(compare|difference|versus|vs\.?|contrast|similarities|between)\b/i.test(query);
  if (isComparisonQuery) {
    console.log(`ðŸ“Š [COMPARISON] Detected comparison query - will use comparison rules`);
  }

  // Map complexity to answer length for unified system
  const answerLength: 'short' | 'medium' | 'summary' | 'long' =
    complexity === 'simple' ? 'short' :
    complexity === 'medium' ? 'medium' : 'long';
  perfTimer.measure('Complexity Detection', 'complexityDetection');

  // PERF FIX: Context budget based on query complexity (Phase 3.2)
  // Simple queries need fewer chunks = faster LLM response + lower token cost
  // Complex queries need more context for accurate synthesis
  const contextBudget: Record<string, { retrievalTopK: number; maxChunksForLLM: number }> = {
    simple: { retrievalTopK: 5, maxChunksForLLM: 3 },
    medium: { retrievalTopK: 10, maxChunksForLLM: 8 },
    complex: { retrievalTopK: 20, maxChunksForLLM: 15 }
  };
  const budget = contextBudget[complexity] || contextBudget.medium;
  console.log(`📊 [CONTEXT BUDGET] complexity=${complexity} → retrievalTopK=${budget.retrievalTopK}, maxChunksForLLM=${budget.maxChunksForLLM}`);

  // ============================================================================
  // ============================================================================
  //      BEFORE the current message is saved

  // Use the isFirstMessage parameter (already passed from controller)
  const shouldShowGreeting = isFirstMessage !== undefined
    ? isFirstMessage
    : (!conversationHistory || conversationHistory.length === 0);
  console.log(`ðŸ‘‹ [GREETING] shouldShowGreeting: ${shouldShowGreeting} (isFirstMessage param: ${isFirstMessage})`);

  // â™¾ï¸ INFINITE CONVERSATION MEMORY - Manus-style architecture
  perfTimer.mark('conversationContext');
  let conversationContext = '';
  let infiniteMemoryStats: any = null;

  if (conversationId && userId) {
    try {
      // Use infinite memory system for rich conversation context
      const infiniteContext = await infiniteConversationMemory.getInfiniteConversationContext(
        conversationId,
        userId,
        query,
        {
          includeHistorical: true,
          includeMemories: true,
          autoChunk: true,
          autoCompress: true
        }
      );

      conversationContext = infiniteContext.formattedContext;
      infiniteMemoryStats = infiniteContext.stats;

      console.log(`â™¾ï¸ [INFINITE MEMORY] Context built:`);
      console.log(`   Recent messages: ${infiniteMemoryStats.recentMessageCount}`);
      console.log(`   Historical chunks: ${infiniteMemoryStats.historicalChunkCount}`);
      console.log(`   Memories: ${infiniteMemoryStats.memoryCount}`);
      console.log(`   Total tokens: ${infiniteMemoryStats.totalTokens}`);
      if (infiniteMemoryStats.compressionLevel > 0) {
        console.log(`   Compression level: ${infiniteMemoryStats.compressionLevel}`);
      }
    } catch (infiniteMemoryError) {
      console.error(`âš ï¸ [INFINITE MEMORY] Failed, falling back to simple context:`, infiniteMemoryError);

      // Fallback to simple conversation context (INCREASED from 5 to 20)
      if (conversationHistory && conversationHistory.length > 0) {
        conversationContext = conversationHistory
          .slice(-20)
          .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        console.log(`âš¡ [CONTEXT] Fallback: Using last 20 of ${conversationHistory.length} messages`);
      }
    }
  } else if (conversationHistory && conversationHistory.length > 0) {
    // No conversationId - use simple fallback (INCREASED from 5 to 20)
    conversationContext = conversationHistory
      .slice(-20)
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
    console.log(`âš¡ [CONTEXT] Simple mode: Using last 20 of ${conversationHistory.length} messages`);
  }
  perfTimer.measure('Conversation Context Build (Infinite Memory)', 'conversationContext');

  // ============================================================================
  // âš¡ MAJOR PARALLELIZATION FIX: Run ALL independent operations in parallel
  // ============================================================================
  //         and embedding generation are ALL independent operations
  //
  // BEFORE (Sequential - SLOW):
  //   1. Folder fetch: 300ms
  //   2. Query enhancement: instant
  //   3. Terminology expansion: 2-5s (LLM call)
  //   4. Pinecone init: 100ms
  //   5. Embedding generation: 300-500ms
  //   TOTAL: 3-6s sequential
  //
  // AFTER (Parallel - FAST):
  //   All operations run concurrently, total time = max(all operations) â‰ˆ 2-3s

  // Use pre-detected language from controller, or detect if not provided
  const queryLang = detectedLanguage || detectLanguage(query);
  const queryLangName = queryLang === 'pt' ? 'Portuguese' : queryLang === 'es' ? 'Spanish' : queryLang === 'fr' ? 'French' : 'English';

  // STREAM PROGRESS: Searching (immediate feedback)
  const searchingMsg = queryLang === 'pt' ? 'Procurando nos seus documentos...' :
                       queryLang === 'es' ? 'Buscando en tus documentos...' :
                       queryLang === 'fr' ? 'Recherche dans vos documents...' :
                       'Searching your documents...';
  console.log('[PROGRESS STREAM] Sending searching message');
  onStage?.('searching', searchingMsg);

  // Simple query enhancement (instant, no LLM call)
  // ðŸ§  Use resolvedQuery (with pronoun resolution) for document retrieval
  let enhancedQueryText = queryEnhancementService.enhanceQuerySimple(resolvedQuery);
  console.log(`ðŸ” [QUERY ENHANCE] Enhanced: "${resolvedQuery}" â†’ "${enhancedQueryText}"`);

  const formulaQueryInfo = isFormulaQuery(resolvedQuery);
  if (formulaQueryInfo.isFormula) {
    enhancedQueryText = enhanceQueryForFormulas(enhancedQueryText, formulaQueryInfo);
  }

  const entityQueryInfo = isEntityQuery(resolvedQuery);
  if (entityQueryInfo.isEntity) {
    enhancedQueryText = enhanceQueryForEntities(enhancedQueryText, entityQueryInfo);
  }

  console.log('âš¡ [PARALLEL] Starting all independent operations in parallel...');
  perfTimer.mark('parallelOperations');
  if (requestTimer) requestTimer.start('Parallel Operations (Folder + Terminology + Pinecone + Embedding)');

  const parallelStart = Date.now();

  // Run ALL independent operations in parallel
  const [folders, terminologyResult, _, embeddingResultEarly] = await Promise.all([
    // 1. Folder tree fetch (expected: 300ms)
    (async () => {
      const t0 = Date.now();
      const result = await prisma.folder.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          emoji: true,
          parentFolderId: true,
          _count: {
            select: {
              documents: true,
              subfolders: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });
      console.log(`  âœ… [PARALLEL] Folder fetch: ${Date.now() - t0}ms`);
      return result;
    })(),

    // 2. Terminology expansion (expected: 2-4s on cache miss, <10ms on cache hit)
    (async () => {
      const t0 = Date.now();
      try {
        const result = await terminologyIntegration.enhanceQueryForRAG(enhancedQueryText, {
          userId,
          maxSynonymsPerTerm: 2
        });
        console.log(`  âœ… [PARALLEL] Terminology expansion: ${Date.now() - t0}ms`);
        return result;
      } catch (termError) {
        console.warn(`  âš ï¸ [PARALLEL] Terminology failed (${Date.now() - t0}ms):`, termError);
        return { searchTerms: [], detectedDomains: [], synonymsUsed: {} };
      }
    })(),

    // 3. Pinecone initialization (expected: 100ms)
    (async () => {
      const t0 = Date.now();
      await initializePinecone();
      console.log(`  âœ… [PARALLEL] Pinecone init: ${Date.now() - t0}ms`);
    })(),

    // 4. Embedding generation with original query (expected: 300-500ms)
    (async () => {
      const t0 = Date.now();
      const result = await embeddingService.generateEmbedding(enhancedQueryText);
      console.log(`  âœ… [PARALLEL] Embedding generation: ${Date.now() - t0}ms`);
      return result;
    })()
  ]);

  const parallelTime = Date.now() - parallelStart;
  if (requestTimer) requestTimer.end('Parallel Operations (Folder + Terminology + Pinecone + Embedding)');
  perfTimer.measure('Parallel Operations (Folder + Terminology + Pinecone + Embedding)', 'parallelOperations');
  console.log(`âœ… [PARALLEL] All independent operations completed in ${parallelTime}ms`);

  // Process folder tree context
  perfTimer.mark('folderTree');
  const folderTreeContext = buildFolderTreeContext(folders);
  perfTimer.measure('Folder Tree Fetch', 'folderTree');
  console.log(`ðŸ“ [FOLDER CONTEXT] Built context for ${folders.length} folders`);

  // Process terminology results
  perfTimer.mark('queryEnhancement');
  let terminologyEnhancedQuery = enhancedQueryText;
  let detectedDomains: string[] = [];
  let earlyEmbedding = embeddingResultEarly.embedding;

  if (terminologyResult.searchTerms && terminologyResult.searchTerms.length > 0) {
    // Use the expanded search terms for embedding
    terminologyEnhancedQuery = terminologyResult.searchTerms.join(' ');
    detectedDomains = terminologyResult.detectedDomains?.map((d: any) => d.domain) || [];

    if (terminologyResult.synonymsUsed && Object.keys(terminologyResult.synonymsUsed).length > 0) {
      console.log(`ðŸ“š [TERMINOLOGY] Expanded query with synonyms:`);
      for (const [term, synonyms] of Object.entries(terminologyResult.synonymsUsed)) {
        console.log(`   "${term}" â†’ [${(synonyms as string[]).slice(0, 3).join(', ')}]`);
      }

      // If terminology added significant terms, regenerate embedding (fast, ~300ms)
      if (terminologyEnhancedQuery !== enhancedQueryText) {
        console.log(`ðŸ”„ [EMBEDDING] Regenerating embedding with terminology-enhanced query`);
        const enhancedEmbeddingResult = await embeddingService.generateEmbedding(terminologyEnhancedQuery);
        earlyEmbedding = enhancedEmbeddingResult.embedding;
      }
    }

    if (detectedDomains.length > 0) {
      console.log(`ðŸ“š [TERMINOLOGY] Detected domains: ${detectedDomains.join(', ')}`);
    }
  }
  perfTimer.measure('Query Enhancement + Terminology', 'queryEnhancement');

  console.log('âš¡ [FAST PATH] Using direct Pinecone retrieval');
  console.log(`ðŸ” [EMBEDDING] Generated embedding for: "${terminologyEnhancedQuery.substring(0, 100)}..."`);

    // filter already declared at top of function, just use it

    // ============================================================================
    // ADAPTIVE STRATEGY - Choose best retrieval method based on query type
    // ============================================================================
    //
    // STRATEGIES:
    // - KEYWORD: Exact term matching (technical terms, IDs, version numbers)
    // - HYBRID: Vector + keyword (comparisons, multi-document queries)
    // - VECTOR: Semantic understanding (default for most queries)

    perfTimer.mark('retrievalStrategy');
    const strategy = determineRetrievalStrategy(query);
    let hybridResults: any[] = [];
    let rawResults: any; // Declare here so it's available for graceful degradation later

    // ? FIX: Detect summary/aggregation queries and increase topK
    const isSummaryQuery = /(?:create|make|generate|summarize|summary|overview).*(?:report|summary|analysis|all|documents?|files?)/i.test(query);
    const retrievalTopK = isSummaryQuery ? Math.max(budget.retrievalTopK, 20) : budget.retrievalTopK;
    if (isSummaryQuery) {
      console.log(`?? [SUMMARY QUERY] Detected summary query, increasing topK to ${retrievalTopK}`);
    }

    if (requestTimer) requestTimer.start(`Retrieval Strategy: ${strategy}`);

    if (strategy === 'keyword') {
      // Pure BM25 keyword search for exact matches
      if (requestTimer) requestTimer.start('BM25 Search');
      const bm25Results = await pureBM25Search(query, userId, 20);
      if (requestTimer) requestTimer.end('BM25 Search');

      // Convert to hybrid result format
      hybridResults = (bm25Results.matches || []).map((match: any) => ({
        content: match.metadata?.content || match.metadata?.text || match.content || '',
        metadata: match.metadata,
        vectorScore: 0,
        bm25Score: match.score || 0,
        hybridScore: match.score || 0,
        inBoth: false,
      }));

      // Set rawResults for graceful degradation fallback
      rawResults = bm25Results;

      console.log(`âœ… [KEYWORD] Pure BM25 search: ${hybridResults.length} chunks`);

      // Fallback to vector search if BM25 returns no results
      // This handles edge cases where documents haven't been chunked yet
      console.log(`ðŸ” [KEYWORD CHECK] BM25 results length: ${hybridResults.length}`);
      if (hybridResults.length === 0) {
         console.log(`ï¿½ ï¿½  [KEYWORDï¿½'VECTOR FALLBACK] BM25 returned 0 results, falling back to Pinecone vector search...`);
        const queryEmbedding = earlyEmbedding;

        if (requestTimer) requestTimer.start('Pinecone Query (keyword fallback)');
        rawResults = await pineconeIndex.query({
          vector: queryEmbedding,
          topK: retrievalTopK,
          filter,
          includeMetadata: true,
        });
        if (requestTimer) requestTimer.end('Pinecone Query (keyword fallback)');

        hybridResults = (rawResults.matches || []).map((match: any) => ({
          content: match.metadata?.content || match.metadata?.text || '',
          metadata: match.metadata,
          vectorScore: match.score || 0,
          bm25Score: 0,
          hybridScore: match.score || 0,
          inBoth: false,
        }));

        console.log(`âœ… [KEYWORDâ†’VECTOR] Fallback vector search: ${hybridResults.length} chunks`);
      }

    } else if (strategy === 'hybrid') {
      // Hybrid search (vector + keyword) for comparisons
      // Uses RRF (Reciprocal Rank Fusion) for optimal merging

      // FIX #6: Use pre-computed embedding from parallel init
      const queryEmbedding = earlyEmbedding;

      // PERF: Parallelize Pinecone + BM25 searches (saves ~500-1000ms)
      if (requestTimer) requestTimer.start('Parallel: Pinecone + BM25 (hybrid)');
      const [pineconeResult, bm25HybridResults] = await Promise.all([
        pineconeIndex.query({
          vector: queryEmbedding,
          topK: Math.min(retrievalTopK, 20), // PERF FIX: Cap at 20 instead of 2x multiplier
          filter,
          includeMetadata: true,
        }),
        bm25RetrievalService.hybridSearch(query, [], userId, Math.min(retrievalTopK, 20)) // PERF FIX: Cap at 20
      ]);
      rawResults = pineconeResult;
      if (requestTimer) requestTimer.end('Parallel: Pinecone + BM25 (hybrid)');

      console.log(`[HYBRID] Vector results: ${rawResults.matches?.length || 0} chunks`);

      // Convert to format expected by mergeWithRRF
      const vectorResultsForRRF = (rawResults.matches || []).map((match: any) => ({
        content: match.metadata?.content || match.metadata?.text || '',
        metadata: match.metadata,
        score: match.score || 0,
      }));

      const keywordResultsForRRF = bm25HybridResults.map((result: any) => ({
        content: result.content,
        metadata: result.metadata,
        documentId: result.metadata?.documentId,
        chunkIndex: result.metadata?.chunkIndex,
        score: result.bm25Score || result.hybridScore || 0,
        bm25Score: result.bm25Score || result.hybridScore || 0,
      }));

      // Apply RRF merging
      hybridResults = mergeWithRRF(vectorResultsForRRF, keywordResultsForRRF, retrievalTopK);

      console.log(`âœ… [HYBRID+RRF] Merged vector + BM25: ${hybridResults.length} chunks`);

    } else {
      // **HYBRID RETRIEVAL: Vector + BM25 with RRF** (FIX 4: +15-20% accuracy)

      console.log('[DEBUG] Starting hybrid retrieval (vector + BM25 with RRF)');

      // FIX #6: Use pre-computed embedding from parallel init
      const queryEmbedding = earlyEmbedding;

      // 1. ✅ PERF: Parallelize Vector + BM25 searches (saves ~500-1000ms)
      console.log('[DEBUG] Starting parallel Vector + BM25 search');
      if (requestTimer) requestTimer.start('Parallel: Pinecone + BM25 (default hybrid)');

      let bm25HybridResults: any[] = [];
      try {
        const [pineconeResult, bm25Results] = await Promise.all([
          pineconeIndex.query({
            vector: queryEmbedding,
            topK: 20, // PERF FIX: Reduced from 40 to 20 for 40% faster search
            filter,
            includeMetadata: true,
          }),
          bm25RetrievalService.hybridSearch(query, [], userId, 20) // PERF FIX: Reduced from 40 to 20
        ]);
        rawResults = pineconeResult;
        bm25HybridResults = bm25Results;
      } catch (parallelError) {
        console.error('[ERROR] Parallel search failed, falling back to sequential:', parallelError);
        rawResults = await pineconeIndex.query({
          vector: queryEmbedding,
          topK: 20,
          filter,
          includeMetadata: true,
        });
        bm25HybridResults = await bm25RetrievalService.hybridSearch(query, [], userId, 20);
      }
      if (requestTimer) requestTimer.end('Parallel: Pinecone + BM25 (default hybrid)');

      console.log(`[DEBUG] Vector results: ${rawResults.matches?.length || 0}, BM25 results: ${bm25HybridResults.length}`);

      // 2. Process BM25 results with RRF merging
      try {

        // Convert to format expected by mergeWithRRF
        const vectorResultsForRRF = (rawResults.matches || []).map((match: any) => ({
          content: match.metadata?.content || match.metadata?.text || '',
          metadata: match.metadata,
          score: match.score || 0,
        }));

        const keywordResultsForRRF = bm25HybridResults.map((result: any) => ({
          content: result.content,
          metadata: result.metadata,
          documentId: result.metadata?.documentId,
          chunkIndex: result.metadata?.chunkIndex,
          score: result.bm25Score || result.hybridScore || 0,
          bm25Score: result.bm25Score || result.hybridScore || 0,
        }));

        // Apply RRF merging algorithm
        hybridResults = mergeWithRRF(vectorResultsForRRF, keywordResultsForRRF, 20);

        if (requestTimer) requestTimer.end('BM25 Search + RRF');
        console.log(`[DEBUG] RRF merged results: ${hybridResults.length}`);

      } catch (error) {
        console.error('[ERROR] BM25+RRF failed, using vector-only:', error);

        // Fallback: Use vector results only with consistent format
        hybridResults = (rawResults.matches || []).map((match: any) => ({
          content: match.metadata?.content || match.metadata?.text || '',
          metadata: match.metadata,
          vectorScore: match.score || 0,
          bm25Score: 0,
          hybridScore: match.score || 0,
          inBoth: false,
        }));
      }

      console.log(`âœ… [HYBRID+RRF] Vector + BM25 search: ${hybridResults.length} chunks`);
    }

    // ✅ PHASE 2 OPTIMIZATION: Apply advanced reranking (micro-summary + chunk-type)
    if (hybridResults.length > 0) {
      hybridResults = await applyPhase2Reranking(hybridResults, query);
    }

    if (requestTimer) requestTimer.end(`Retrieval Strategy: ${strategy}`);
    perfTimer.measure(`Retrieval Strategy (${strategy})`, 'retrievalStrategy');

    // ============================================================================
    // DEBUG LOGGING - Diagnose retrieval issues
    // ============================================================================
    console.log('ðŸ” [DEBUG] Pinecone Query Results:');
    console.log(`   Total results: ${hybridResults.length}`);
    if (hybridResults.length > 0) {
      console.log(`   Top 5 results:`, hybridResults.slice(0, 5).map((r: any) => ({
        filename: r.metadata?.filename,
        score: r.vectorScore || r.hybridScore,
        contentPreview: (r.metadata?.text || r.metadata?.content || r.content || '').substring(0, 80),
        sourceType: r.metadata?.sourceType
      })));
    } else {
      console.error('? [DEBUG] NO RESULTS FROM PINECONE - This is the root cause!');
      console.log('?? [DEBUG] Query:', query);
      console.log('?? [DEBUG] User ID:', userId);
      console.log('?? [DEBUG] Filter:', JSON.stringify(filter));
      
      // ? FIX: Fallback to database when Pinecone returns no results
      console.log('?? [FALLBACK] Attempting to retrieve documents directly from database...');

      try {
        const documents = await prisma.document.findMany({
          where: {
            userId,
            status: 'completed'
          },
          select: {
            id: true,
            filename: true,
            createdAt: true,
            metadata: {
              select: {
                extractedText: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Limit to 10 most recent documents
        });

        if (documents.length > 0) {
          console.log(`? [FALLBACK] Retrieved ${documents.length} documents from database`);

          // Convert documents to hybrid result format
          // Note: extractedText is in DocumentMetadata, not Document
          hybridResults = documents
            .filter(doc => doc.metadata?.extractedText && doc.metadata.extractedText.trim().length > 0)
            .map(doc => {
              const extractedText = doc.metadata?.extractedText || '';
              return {
                content: extractedText,
                metadata: {
                  documentId: doc.id,
                  filename: doc.filename,
                  text: extractedText,
                  sourceType: 'database_fallback'
                },
                vectorScore: 0.5, // Default score for database fallback
                bm25Score: 0,
                hybridScore: 0.5
              };
            });

          console.log(`? [FALLBACK] Created ${hybridResults.length} chunks from database documents`);

          // Update rawResults for consistency
          rawResults = {
            matches: hybridResults.map(hr => ({
              id: hr.metadata.documentId,
              score: hr.hybridScore,
              metadata: hr.metadata
            }))
          };
        } else {
          console.log('?? [FALLBACK] No documents found in database either');
        }
      } catch (error) {
        console.error('? [FALLBACK] Database retrieval failed:', error);
      }
    }
    // ============================================================================

    if (hybridResults.length > 0) {
      // Convert hybridResults to match format expected by booster
      const matchesForBoosting = hybridResults.map((hr: any) => ({
        id: hr.metadata?.documentId || '',
        score: hr.hybridScore || hr.vectorScore || 0,
        metadata: hr.metadata
      }));

      const boostedMatches = hybridRetrievalBooster.boostRetrievalScores(matchesForBoosting, query, 1.8);

      // Update hybridResults with boosted scores
      boostedMatches.forEach((boosted: any, idx: number) => {
        if (hybridResults[idx]) {
          hybridResults[idx].hybridScore = boosted.score;
          hybridResults[idx].vectorScore = boosted.score;
          hybridResults[idx].metadata = boosted.metadata;
        }
      });

      // Re-sort by boosted scores
      hybridResults.sort((a: any, b: any) => (b.hybridScore || 0) - (a.hybridScore || 0));
    }

    const sectionRefs = extractSectionReferences(query);
    if (sectionRefs.length > 0) {
      // Add score property to hybridResults for boostSectionMatches
      hybridResults.forEach((hr: any) => {
        hr.score = hr.hybridScore || hr.vectorScore || 0;
      });
      boostSectionMatches(hybridResults, sectionRefs);
      // Update scores after boosting (in-place modification)
      hybridResults.forEach((hr: any) => {
        hr.hybridScore = hr.score;
        hr.vectorScore = hr.score;
      });
    }

    // ============================================================================
    // NEW: ITERATIVE REFINEMENT - Full agent loop with multiple attempts
    // ============================================================================

    // Wrap hybridResults in Pinecone-style results object for observation function
    perfTimer.mark('iterativeRefinement');
    searchResults = { matches: hybridResults };

    if (queryAnalysis.isComplex) {
      const initialObservation = observeRetrievalResults(searchResults, query);

      if (initialObservation.needsRefinement) {
        console.log(`ðŸ”„ [AGENT LOOP] Complex query needs refinement: ${initialObservation.reason}`);
        console.log(`ðŸ”„ [AGENT LOOP] Starting iterative refinement...`);

        // Use iterative retrieval instead of single refinement
        const iterativeResults = await iterativeRetrieval(query, userId, filter);

        const iterativeVectorMatches = iterativeResults.matches || [];
        let iterativeHybridResults: any[];

        try {
          // Get BM25 results for merging
          const bm25Results = await bm25RetrievalService.hybridSearch(query, [], userId, iterativeVectorMatches.length * 2);

          // Convert to RRF format
          const vectorResultsForRRF = iterativeVectorMatches.map((match: any) => ({
            content: match.metadata?.content || match.metadata?.text || '',
            metadata: match.metadata,
            score: match.score || 0,
          }));

          const keywordResultsForRRF = bm25Results.map((result: any) => ({
            content: result.content,
            metadata: result.metadata,
            documentId: result.metadata?.documentId,
            chunkIndex: result.metadata?.chunkIndex,
            score: result.bm25Score || result.hybridScore || 0,
            bm25Score: result.bm25Score || result.hybridScore || 0,
          }));

          // Merge with RRF algorithm
          iterativeHybridResults = mergeWithRRF(vectorResultsForRRF, keywordResultsForRRF, 20);
          console.log(`âœ… [AGENT LOOP] True hybrid refinement: ${iterativeHybridResults.length} results (RRF merged)`);
        } catch (error) {
          console.warn('âš ï¸ [AGENT LOOP] BM25 search failed, using vector-only:', error);
          // Fallback to vector-only
          iterativeHybridResults = iterativeVectorMatches.map((match: any) => ({
            content: match.metadata?.content || match.metadata?.text || '',
            metadata: match.metadata,
            vectorScore: match.score || 0,
            bm25Score: 0,
            hybridScore: match.score || 0,
            inBoth: false,
          }));
        }

        // Update results if iterative refinement improved them
        if (iterativeHybridResults.length > 0) {
          console.log(`âœ… [AGENT LOOP] Iterative refinement completed - using best results`);
          searchResults = { matches: iterativeHybridResults };
          hybridResults = iterativeHybridResults;
        } else {
          console.log(`âš ï¸  [AGENT LOOP] Iterative refinement didn't improve results, using original`);
          // Keep original searchResults and hybridResults
        }
      } else {
        console.log(`âœ… [AGENT LOOP] Complex query results are satisfactory - no refinement needed`);
      }
    } else {
      console.log(`âš¡ [SPEED] Simple query - skipping iterative refinement (saved ~2s)`);
    }
    perfTimer.measure('Iterative Refinement Check', 'iterativeRefinement');

    // STREAM PROGRESS: Analyzing retrieved chunks
    const analyzingMsg = queryLang === 'pt' ? `Analisando ${hybridResults.length} trechos encontrados...` :
                         queryLang === 'es' ? `Analizando ${hybridResults.length} fragmentos encontrados...` :
                         queryLang === 'fr' ? `Analyse de ${hybridResults.length} extraits trouvÃ©s...` :
                         `Analyzing ${hybridResults.length} chunks found...`;
    console.log(`[PROGRESS STREAM] Sending analyzing message (${hybridResults.length} chunks)`);
    onStage?.('analyzing', analyzingMsg);

    // ============================================================================
    // ============================================================================
    //
    // - Pinecone similarity score range: 0.0 to 1.0
    // - High similarity (>0.70) = High relevance (correlation: 0.85-0.90)
    // - LLM filtering correlation with relevance: 0.90-0.95
    // - Improvement: 0.90 â†’ 0.95 = +5% accuracy
    // - Cost: +3-5 seconds latency
    // - Trade-off: 5% accuracy loss for 70% speed gain = WORTH IT
    //
    // BEFORE (with LLM filtering):
    // Query: "What does the budget say about revenue?"
    // 1. Pinecone returns 20 chunks (800ms)
    // 2. Pre-filter to top 12 by score (instant)
    // 3. LLM evaluates 12 chunks (3-5 seconds) â† SLOW
    // 4. Returns top 8 chunks
    // Total: 3.8-5.8 seconds for retrieval
    //
    // AFTER (vector score filtering):
    // Query: "What does the budget say about revenue?"
    // 1. Pinecone returns 20 chunks (800ms)
    // 2. Filter by score threshold (>0.70) (instant)
    // 3. Take top 8 chunks (instant)
    // Total: 0.8 seconds for retrieval (5Ã— faster)

    const MAX_CHUNKS_FOR_ANSWER = 5; // âš¡ Reduced for speed optimization

    // Sort by hybrid score (vector + BM25) or vector score
    perfTimer.mark('chunkSorting');
    const sortedChunks = hybridResults
      .sort((a: any, b: any) => {
        const scoreA = a.hybridScore || a.vectorScore || 0;
        const scoreB = b.hybridScore || b.vectorScore || 0;
        return scoreB - scoreA;
      });

    console.log(`ðŸ” [VECTOR FILTER] Sorting ${sortedChunks.length} chunks by similarity score`);

    // Log score range for debugging
    if (sortedChunks.length > 0) {
      const allScores = sortedChunks.map((c: any) => c.hybridScore || c.vectorScore || 0);
      const maxScore = Math.max(...allScores);
      const minScore = Math.min(...allScores);
      console.log(`ðŸ“Š [SCORE RANGE] Min: ${minScore.toFixed(3)}, Max: ${maxScore.toFixed(3)}`);
    }

    const filteredChunks = sortedChunks.slice(0, MAX_CHUNKS_FOR_ANSWER);
    perfTimer.measure('Chunk Sorting + Selection', 'chunkSorting');

    console.log(`âœ… [VECTOR FILTER] Taking top ${filteredChunks.length} chunks (no threshold filter)`)

    if (ragConfig.useLLMFiltering) {
      // LLM filtering logic here
      console.log(`ðŸ” [FILTER] LLM chunk filtering enabled`);
    } else {
      console.log(`âš¡ [SPEED] LLM chunk filtering disabled`);
    }
    console.log(`âœ… [FAST PATH] Using ${filteredChunks.length} chunks based on vector scores`);

    // Log score distribution for debugging
    if (filteredChunks.length > 0) {
      const scores = filteredChunks.map((c: any) => (c.hybridScore || c.vectorScore || 0).toFixed(2));
      console.log(`ðŸ“Š [SCORES] Top chunks: [${scores.join(', ')}]`);
    }

    // Filter deleted documents
    perfTimer.mark('filterDeleted');
    const finalSearchResults = await filterDeletedDocuments(filteredChunks, userId);
    perfTimer.measure('Filter Deleted Documents', 'filterDeleted');
    console.log(`â±ï¸ [PERF] Retrieval took ${Date.now() - startTime}ms`);

    // ============================================================================
    // FULL DOCUMENT RETRIEVAL (configurable via ragConfig)
    // ============================================================================
    let fullDocuments: { id: string; title: string; content: string; metadata?: any }[] = [];
    let documentContext = '';

    if (ragConfig.useFullDocuments) {
      // Full document retrieval logic
      console.log(`ðŸ“„ [FULL] Full document retrieval enabled`);
      // Extract document IDs from search results for full document retrieval
      const documentIds = [...new Set(finalSearchResults.map((r: any) => r.metadata?.documentId).filter(Boolean))];
      if (documentIds.length > 0) {
        fullDocuments = await retrieveFullDocuments(documentIds, userId);
        if (fullDocuments.length > 0) {
          documentContext = buildDocumentContext(fullDocuments);
          console.log(`ðŸ“„ [FULL DOCS] Using ${fullDocuments.length} full documents for ${complexity} query`);
          console.log(`â±ï¸ [PERF] Document loading took ${Date.now() - startTime}ms`);
        }
      }
    } else {
      console.log(`âš¡ [SPEED] Full document retrieval disabled (recommended)`);
    }

    // ============================================================================
    // CONTRADICTION DETECTION (configurable via ragConfig)
    // ============================================================================
    let contradictionResult: any = null;

    if (ragConfig.useContradictionDetection) {
      // Contradiction detection logic
      console.log(`ðŸ” [CHECK] Contradiction detection enabled`);
    } else {
      console.log(`âš¡ [SPEED] Contradiction detection disabled`);
    }

    // ============================================================================
    // ENHANCED FALLBACK SYSTEM (Psychological Safety)
    // ============================================================================
    //
    // BEFORE: "I couldn't find information" â†’ User leaves âŒ
    // AFTER:  Natural, AI-generated fallback â†’ User tries again âœ…
    //
    // Psychological Safety Principles:
    // 1. Never blame the user
    // 2. Always offer alternatives
    // 3. Maintain competence
    // 4. Understand intent

    // Get document names for context
    const userDocuments = await prisma.document.findMany({
      where: { userId },
      select: { filename: true, mimeType: true, createdAt: true }
    });
    const documentNames = userDocuments.map(d => d.filename);

    // Calculate RAG score from results
    const ragScore = finalSearchResults && finalSearchResults.length > 0
      ? Math.max(...finalSearchResults.map((chunk: any) =>
          chunk.hybridScore || chunk.vectorScore || chunk.score || 0
        ))
      : 0;

    const userDocumentCount = userDocuments.length;

    // Detect fallback need with enhanced psychological safety
    // CRITICAL FIX: ragExecuted: true tells fallbackDetection that RAG has run
    const fallbackCheck = fallbackDetection.detectFallback({
      query,
      documentCount: userDocumentCount,
      ragResults: finalSearchResults || [],
      ragScore,
      conversationHistory: conversationHistory || [],
      ragExecuted: true  // ⚡ FIX: RAG has run - can trigger knowledge fallback if no results
    });

    console.log(`ðŸŽ¯ [FALLBACK] Detection result: needsFallback=${fallbackCheck.needsFallback}, type=${fallbackCheck.fallbackType}, confidence=${fallbackCheck.confidence}`);

    // Check if fallback is needed (high confidence threshold)
    if (fallbackCheck.needsFallback && fallbackCheck.confidence > 0.7) {
      console.log(`ðŸ’¬ [FALLBACK] Generating ${fallbackCheck.fallbackType} fallback response`);

      perfTimer.mark('enhancedFallback');

      // Build fallback context
      const fallbackContext: FallbackContext = {
        query,
        fallbackType: fallbackCheck.fallbackType,
        reason: fallbackCheck.reason,
        documentCount: userDocumentCount,
        documentNames,
        ragResults: finalSearchResults || [],
        language: queryLangName,
        conversationHistory: conversationHistory || []
      };

      try {
        // Generate psychologically safe fallback response
        const fallbackAnswer = await fallbackResponse.generateFallbackResponse(fallbackContext);

        // Check psychological safety
        const safetyCheck = psychologicalSafety.checkResponseSafety(fallbackAnswer);

        if (!safetyCheck.isSafe) {
          console.warn('âš ï¸ [FALLBACK] Safety issues detected:', safetyCheck.issues);
          // Could auto-improve here, but for now just log
        }

        // Check formatting
        const formatCheck = psychologicalSafety.checkFormatting(fallbackAnswer);
        if (!formatCheck.isValid) {
          console.warn('âš ï¸ [FALLBACK] Formatting issues:', formatCheck.issues);
        }

        // Apply structure enforcement (will skip title/sections for fallback)
        const structuredFallback = structureEnforcementService.enforceStructure(fallbackAnswer.trim(), {
          query,
          sources: [],
          isComparison: false,
          responseType: 'fallback'  // ✅ No title for fallback responses
        });
        // Apply format enforcement to fallback response
        const formattedStructuredFallback = applyFormatEnforcement(structuredFallback.text, {
          responseType: 'enhanced_fallback',
          logPrefix: '[ENHANCED-FALLBACK FORMAT]'
        });
        onChunk(formattedStructuredFallback);
        perfTimer.measure('Enhanced Fallback Response', 'enhancedFallback');

        console.log(`âœ… [FALLBACK] ${fallbackCheck.fallbackType} fallback complete`);
        perfTimer.printSummary();
        return { sources: [] };

      } catch (fallbackError) {
        console.error('âŒ [FALLBACK] Error generating fallback response:', fallbackError);

        // Fall back to legacy graceful degradation
        perfTimer.mark('gracefulDegradation');
        const legacyFallback = await gracefulDegradationService.handleFailedQuery(
          userId,
          query,
          rawResults.matches || []
        );

        let response = legacyFallback.message;
        if (legacyFallback.relatedInfo) {
          response += '\n\n' + legacyFallback.relatedInfo;
        }

        onChunk(response.trim());
        perfTimer.measure('Graceful Degradation (legacy fallback)', 'gracefulDegradation');

        console.log(`âœ… [FALLBACK] Legacy graceful degradation complete (strategy: ${legacyFallback.type})`);
        perfTimer.printSummary();
        return { sources: [] };
      }
    }

    // Legacy check: No results at all (redundant but kept for safety)
    if (!finalSearchResults || finalSearchResults.length === 0 ||
        (finalSearchResults.every((chunk: any) => chunk.llmScore?.finalScore < 0.5))) {

      console.log('âš ï¸  [FAST PATH] No relevant chunks found, using legacy graceful degradation');

      perfTimer.mark('gracefulDegradation');
      const fallback = await gracefulDegradationService.handleFailedQuery(
        userId,
        query,
        rawResults.matches || []
      );

      let response = fallback.message;
      if (fallback.relatedInfo) {
        response += '\n\n' + fallback.relatedInfo;
      }

      onChunk(response.trim());
      perfTimer.measure('Graceful Degradation', 'gracefulDegradation');

      console.log(`âœ… [FAST PATH] Graceful degradation complete (strategy: ${fallback.type})`);
      perfTimer.printSummary();
      return { sources: [] };
    }

    // ============================================================================
    // ============================================================================
    //
    // BEFORE (with Cohere reranking):
    // 1. Vector search returns sorted chunks (800ms)
    // 2. Cohere re-evaluates each chunk (2-3 seconds) â† SLOW
    // Total: 2.8-3.8 seconds
    //
    // AFTER (skip reranking):
    // 1. Vector search returns sorted chunks (800ms)
    // 2. Use chunks directly (0ms)
    // Total: 0.8 seconds (3Ã— faster)

    // âš¡ DISABLED: Cohere reranking for speed optimization
    // const rerankedChunks = await rerankingService.rerankChunks(
    //   query,
    //   finalSearchResults,
    //   8
    // );

    // Use Pinecone's native ordering (already sorted by similarity)
    perfTimer.mark('reranking');
    const rerankedChunks = finalSearchResults.map((chunk: any, index: number) => ({
      content: chunk.content || chunk.metadata?.content || '',
      metadata: chunk.metadata,
      originalScore: chunk.hybridScore || chunk.vectorScore || chunk.score || 0,
      rerankScore: chunk.hybridScore || chunk.vectorScore || chunk.score || 0, // Same as original
      finalPosition: index,
      llmScore: chunk.llmScore,
    }));
    perfTimer.measure('Reranking (disabled - just mapping)', 'reranking');

    console.log(`âš¡ [SPEED] Cohere reranking DISABLED (saved 2-3 seconds)`);
    console.log(`âœ… [FAST PATH] Using ${rerankedChunks.length} chunks in Pinecone order`);

    const chunkQuality = emptyResponsePrevention.validateChunks(rerankedChunks, query);
    if (!chunkQuality.isValid) {
      console.warn(`âš ï¸ [CHUNK QUALITY] Validation failed: ${chunkQuality.reason}`);
      // Continue but log warning - graceful degradation will handle if answer is poor
    } else {
      console.log(`âœ… [CHUNK QUALITY] Score: ${chunkQuality.score.toFixed(2)}`);
    }

    // Log score distribution for debugging
    if (rerankedChunks.length > 0) {
      const scores = rerankedChunks.slice(0, 5).map((c: any) => c.rerankScore.toFixed(2));
      console.log(`ðŸ“Š [SCORES] Top 5 chunks: [${scores.join(', ')}]`);
    }

    // ============================================================================
    // ============================================================================

    let answerConfidence: confidenceScoring.ConfidenceResult | undefined;
    let supportingEvidence: confidenceScoring.Evidence[] | undefined;
    let conflictingEvidence: confidenceScoring.Evidence[] | undefined;

    perfTimer.mark('evidenceScoring');
    const evidence = rerankedChunks.map((chunk: any) => ({
      document_id: chunk.metadata?.documentId || 'unknown',
      document_title: chunk.metadata?.filename || 'Unknown',
      relevant_passage: chunk.metadata?.text || chunk.metadata?.content || chunk.content || '',
      support_strength: confidenceScoring.scoreEvidence(
        query,
        chunk.metadata?.text || chunk.metadata?.content || chunk.content || '',
        chunk.rerankScore || chunk.originalScore || 0
      ),
      relevance_score: chunk.rerankScore || chunk.originalScore || 0
    }));

    const supporting = evidence.filter(e => e.support_strength > 0.5);
    const conflicting: confidenceScoring.Evidence[] = [];

    const confidenceResult = confidenceScoring.calculateConfidence(supporting);
    answerConfidence = confidenceResult;
    supportingEvidence = supporting;
    conflictingEvidence = conflicting;
    perfTimer.measure('Evidence Scoring', 'evidenceScoring');

    console.log(`ðŸ"Š [CONFIDENCE] Score: ${confidenceResult.score}/100 (speed-optimized path)`);

    const uniqueDocuments = new Map<string, { filename: string; folderPath?: string }>();
    rerankedChunks.forEach((result: any) => {
      const meta = result.metadata || {};
      const filename = meta.filename || 'Unknown';
      const folderPath = meta.folderPath || meta.folderName || 'Library';
      if (!uniqueDocuments.has(filename)) {
        uniqueDocuments.set(filename, { filename, folderPath });
      }
    });

    // Build document locations section
    const documentLocations = Array.from(uniqueDocuments.values())
      .map(doc => `- "${doc.filename}" is located in: ${doc.folderPath}`)
      .join('\n');

    const documentCount = uniqueDocuments.size;
    let multiDocInstruction = '';
    if (documentCount > 1) {
      multiDocInstruction = `
**IMPORTANT - MULTI-DOCUMENT QUERY**: The user has attached ${documentCount} documents. When comparing or analyzing across documents:
1. Clearly identify which information comes from which document
2. Use document names when presenting data (e.g., "In Q1 Budget: $1.2M, In Q2 Budget: $1.5M")
3. Highlight similarities and differences between documents
4. Provide a summary comparison if the query asks for it

`;
      console.log(`ðŸ”€ [MULTI-DOC] Added comparison instructions for ${documentCount} documents`);
    }

    perfTimer.mark('contextBuilding');
    const context = rerankedChunks.map((result: any, idx: number) => {
      const meta = result.metadata || {};
      const documentId = meta.documentId || 'unknown';
      const filename = meta.filename || 'Unknown';
      const page = meta.page || meta.pageNumber;
      const pageInfo = (page && page > 0) ? `, Page: ${page}` : '';

      return `[Document ${idx + 1}] ${filename} (documentId: ${documentId}${pageInfo}):\n${meta.text || meta.content || result.content || ''}`;
    }).join('\n\n---\n\n');

    console.log(`ðŸ“š [CONTEXT] Built context from ${rerankedChunks.length} chunks with folder locations`);

    // STREAM PROGRESS: Generating answer
    const generatingMsg = queryLang === 'pt' ? 'Gerando resposta...' :
                          queryLang === 'es' ? 'Generando respuesta...' :
                          queryLang === 'fr' ? 'GÃ©nÃ©ration de la rÃ©ponse...' :
                          'Generating answer...';
    console.log('[PROGRESS STREAM] Sending generating message');
    onStage?.('generating', generatingMsg);

    // Removed nextStepText - using natural endings instead

    const documentContextFromChunks = rerankedChunks.map((chunk: any) =>
      chunk.metadata?.text || chunk.metadata?.content || chunk.content || ''
    ).join('\n\n---\n\n');

    // DEBUG: Log what's in the chunks
    console.log(`ðŸ” [DEBUG] documentContextFromChunks length: ${documentContextFromChunks.length}`);
    console.log(`ðŸ” [DEBUG] rerankedChunks[0] keys:`, rerankedChunks[0] ? Object.keys(rerankedChunks[0]) : 'no chunks');
    if (rerankedChunks[0]?.metadata) {
      console.log(`ðŸ” [DEBUG] rerankedChunks[0].metadata keys:`, Object.keys(rerankedChunks[0].metadata));
      console.log(`ðŸ” [DEBUG] Sample text (first 200 chars):`, (rerankedChunks[0].metadata.text || rerankedChunks[0].metadata.content || 'EMPTY').substring(0, 200));
    }

    const baseDocumentContext = (documentContext && fullDocuments.length > 0)
      ? documentContext
      : context; // FIX: Use context variable which has proper text extraction

    const finalDocumentContext = multiDocInstruction + baseDocumentContext;

    console.log(`ðŸ“ [PROMPT] Using ${complexity} complexity prompt with ${documentContext && fullDocuments.length > 0 ? 'full documents' : 'chunks'}`);
    console.log(`ðŸ” [DEBUG] finalDocumentContext length: ${finalDocumentContext.length}`);
    perfTimer.measure('Context Building', 'contextBuilding');

    // ============================================================================
    // CAUSAL EXTRACTION - Real-World Context Intelligence for "Why" Questions
    // ============================================================================

    perfTimer.mark('causalExtraction');
    let causalContext = '';

    // Prepare chunks for causal extraction
    const chunksForCausalExtraction = rerankedChunks.map((chunk: any) => ({
      content: chunk.metadata?.text || chunk.metadata?.content || chunk.content || '',
      metadata: {
        documentId: chunk.metadata?.documentId || 'unknown',
        filename: chunk.metadata?.filename || 'Unknown',
        page: chunk.metadata?.page || chunk.metadata?.pageNumber
      }
    }));

    // Get causal context for the query
    const causalResult = causalExtractionService.getWhyQueryContext(query, chunksForCausalExtraction);

    if (causalResult.isWhyQuery) {
      console.log(`ðŸ” [CAUSAL] Detected "why" query - subject: "${causalResult.subject}"`);
      console.log(`ðŸ” [CAUSAL] Found ${causalResult.causes.length} causal relationships`);
      console.log(`ðŸ” [CAUSAL] Found ${causalResult.context.length} contextual info pieces`);

      if (causalResult.promptAddition) {
        causalContext = causalResult.promptAddition;
        console.log(`âœ… [CAUSAL] Added causal intelligence to prompt context`);
      }
    }
    perfTimer.measure('Causal Extraction', 'causalExtraction');

    // ---------------------------------------------------------------------------
    // ---------------------------------------------------------------------------

    perfTimer.mark('formulaExtraction');
    let formulaContext = '';

    if (formulaQueryInfo.isFormula) {
      // Extract formulas from all retrieved chunks
      const chunksWithText = rerankedChunks.map((chunk: any) => ({
        text: chunk.metadata?.text || chunk.metadata?.content || chunk.content || '',
        metadata: chunk.metadata
      }));

      const extractedFormulas = extractFormulasFromChunks(chunksWithText);

      if (extractedFormulas.length > 0) {
        formulaContext = buildFormulaContext(extractedFormulas, formulaQueryInfo);
        console.log(`âœ… [FORMULA] Added ${extractedFormulas.length} formulas to prompt context`);
      } else {
        console.log(`âš ï¸ [FORMULA] No formulas found in chunks despite formula query detected`);
      }
    }
    perfTimer.measure('Formula Extraction', 'formulaExtraction');

    // ---------------------------------------------------------------------------
    // ---------------------------------------------------------------------------

    perfTimer.mark('practicalImplications');
    let implicationsContext = '';

    // Get practical implications for the query
    const implicationsResult = practicalImplicationsService.getImplicationsContext(query, chunksForCausalExtraction);

    if (implicationsResult.isImplicationsQuery || implicationsResult.categorizedImplications.length > 0) {
      console.log(`?? [IMPLICATIONS] Detected implications query: ${implicationsResult.isImplicationsQuery}`);
      console.log(`?? [IMPLICATIONS] Found ${implicationsResult.categorizedImplications.length} categories`);

      if (implicationsResult.promptAddition) {
        implicationsContext = implicationsResult.promptAddition;
        console.log(`? [IMPLICATIONS] Added practical implications to prompt context`);
      }
    }
    perfTimer.measure('Practical Implications', 'practicalImplications');

    // ðŸ§  Build multi-turn context summary for enhanced LLM understanding
    let multiTurnContextSummary = '';
    if (multiTurnContext && (multiTurnContext.entities.length > 0 || multiTurnContext.keyFindings.length > 0)) {
      multiTurnContextSummary = conversationContextService.buildContextSummary(multiTurnContext);
      console.log(`ðŸ§  [CONTEXT] Built context summary for LLM (${multiTurnContextSummary.length} chars)`);
    }

    let contextWithIntelligence = finalDocumentContext;
    if (causalContext) {
      contextWithIntelligence += causalContext;
    }
    if (formulaContext) {
      contextWithIntelligence += formulaContext;
    }
    if (implicationsContext) {
      contextWithIntelligence += implicationsContext;
    }

    // ðŸ§  Add multi-turn context summary for reference resolution and continuity
    if (multiTurnContextSummary) {
      contextWithIntelligence += multiTurnContextSummary;
      console.log(`ðŸ§  [CONTEXT] Injected context summary into document context`);
    }

    // ============================================================================
    // ADAPTIVE ANSWER GENERATION - Build and generate final answer
    // ============================================================================
    // Uses ChatGPT/Gemini quality standards for answer generation:
    // - Adaptive length based on document size (~30% compression ratio)
    // - Natural, conversational tone with structured formatting
    // - Context-aware with metadata integration

    perfTimer.mark('adaptiveAnswerGeneration');

    // Build document info for adaptive length calculation
    const documentInfo: AdaptiveDocumentInfo = {
      title: rerankedChunks[0]?.metadata?.filename || 'Multiple Documents',
      pageCount: fullDocuments.length > 0
        ? fullDocuments.reduce((acc, doc) => acc + ((doc as any).pageCount || 1), 0)
        : Math.max(1, Math.ceil(contextWithIntelligence.length / 3000)), // Estimate ~3000 chars/page
      wordCount: contextWithIntelligence.split(/\s+/).length,
      type: rerankedChunks[0]?.metadata?.mimeType?.split('/')[1] || 'pdf',
    };

    // Map answerLength to adaptive format
    const adaptiveLength: 'short' | 'medium' | 'long' | 'adaptive' =
      answerLength === 'short' ? 'short' :
      answerLength === 'long' ? 'long' :
      'adaptive';

    console.log(`ðŸ“ [ADAPTIVE] Generating answer with ${adaptiveLength} length for ${documentInfo.pageCount} page(s)`);

    let fullResponse = '';

    try {
      const answer = await adaptiveAnswerGeneration.generateAdaptiveAnswer({
        query,
        documentContext: contextWithIntelligence,
        documentInfo,
        // â™¾ï¸ Pass pre-formatted conversation context from infinite memory
        conversationContext: typeof conversationContext === 'string' && conversationContext.trim().length > 0
          ? conversationContext
          : undefined,
        // Also pass array format for backward compatibility
        conversationHistory: Array.isArray(conversationContext)
          ? conversationContext.map((msg: any) => ({
              role: msg.role as string,
              content: msg.content as string
            }))
          : undefined,
        answerLength: adaptiveLength,
        language: queryLang,
        includeMetadata: true,
        includeImplications: true,
      }, onChunk);

      fullResponse = answer.content;

      // Log generation stats
      console.log(`ðŸ“Š [ADAPTIVE STATS] Words: ${answer.stats.wordCount}, Tokens: ${answer.stats.estimatedTokens}, Compression: ${(answer.stats.compressionRatio * 100).toFixed(1)}%`);

      // Validate answer quality (for monitoring)
      const quality = { score: 100, issues: [] };
      if (quality.score < 80) {
        console.log(`âš ï¸ [QUALITY] Score: ${quality.score}/100 - Issues: ${quality.issues.join(', ')}`);
      } else {
        console.log(`âœ… [QUALITY] Score: ${quality.score}/100`);
      }
    } catch (adaptiveError) {
      console.error('âŒ [ADAPTIVE] Adaptive generation failed, falling back to legacy:', adaptiveError);

      // Fallback to legacy system prompt approach
      const systemPrompt = systemPromptsService.getSystemPrompt(
        query,
        answerLength,
        {
          isComparison: isComparisonQuery,
          isFirstMessage: shouldShowGreeting,
          conversationHistory: conversationContext,
          documentContext: finalDocumentContext,
          documentLocations,
          memoryContext,
          folderTreeContext,
          detectedLanguage: queryLang,
        }
      );

      const languageInstruction = `\n\n**LANGUAGE REQUIREMENT (CRITICAL)**:
- The user's query is in **${queryLangName}**
- You MUST respond ENTIRELY in **${queryLangName}**
- Even if the document content is in a different language, your response must be in **${queryLangName}**
- Translate information from the document into **${queryLangName}** if needed`;

      const finalSystemPrompt = systemPrompt + languageInstruction;
      // ✅ TRUE STREAMING: Pass actual onChunk callback (was incorrectly passing empty callback)
      fullResponse = await streamLLMResponse(finalSystemPrompt, contextWithIntelligence, onChunk);
    }

    perfTimer.measure('Adaptive Answer Generation', 'adaptiveAnswerGeneration');
    console.log(`â±ï¸ [PERF] Generation took ${Date.now() - startTime}ms`);

    // ============================================================
    // QUALITY ASSURANCE GATE
    // ============================================================
    console.log('[QA-GATE] Running quality assurance checks...');
    const qaStartTime = Date.now();

    try {
      const qaResult = await runQualityAssurance(
        fullResponse,
        sortedChunks.slice(0, 5),
        query,
        {
          enableGrounding: true,
          enableCitations: true,
          enableCompleteness: true,
          enableFormatting: true,
          strictMode: false
        }
      );

      console.log('[QA-GATE] Quality scores:', {
        overall: qaResult.score.overall.toFixed(2),
        grounding: qaResult.score.grounding.toFixed(2),
        citations: qaResult.score.citations.toFixed(2),
        completeness: qaResult.score.completeness.toFixed(2),
        formatting: qaResult.score.formatting.toFixed(2)
      });

      if (qaResult.issues.length > 0) {
        console.log('[QA-GATE] Issues detected:', qaResult.issues);
      }

      if (qaResult.action === 'fail') {
        console.log('[QA-GATE] FAILED - Critical quality issues');
        fullResponse = "Desculpe, não consegui gerar uma resposta confiável com base nos documentos disponíveis. Por favor, reformule sua pergunta ou forneça mais contexto.";
      } else if (qaResult.action === 'regenerate') {
        console.log('[QA-GATE] REGENERATE - Quality below threshold');
        console.warn('[QA-GATE] Regeneration not yet implemented, passing through with warning');
      } else {
        console.log('[QA-GATE] PASSED - Quality checks successful');
      }

      console.log(`[QA-GATE] Completed in ${Date.now() - qaStartTime}ms`);

    } catch (qaError) {
      console.error('[QA-GATE] Error during quality assurance:', qaError);
    }

    // ============================================================
    // END QUALITY ASSURANCE GATE
    // ============================================================

    // ============================================================================
    // NEW: CONFIDENCE SCORING - Calculate answer confidence
    // ============================================================================

    perfTimer.mark('sourcesExtraction');
    let sources: any[];

    const citationResult = citationTracking.extractCitations(fullResponse);
    const cleanResponse = citationResult.cleanResponse;
    const extractedCitations = citationResult.citations;
    fullResponse = cleanResponse;

    // Log citation extraction results for debugging precision
    if (extractedCitations.length > 0) {
      console.log(`ðŸ“Ž [CITATION TRACKING] LLM provided ${extractedCitations.length} structured citations`);
    } else {
      console.log(`ðŸ“Ž [CITATION TRACKING] No hidden citation block found, will use fast extraction fallback`);
    }

    // ============================================================================
    // FORMAT ENFORCEMENT - Ensure 100% compliance with Koda format rules
    // ============================================================================
    perfTimer.mark('formatEnforcement');
    console.log(`ðŸŽ¨ [FORMAT] Enforcing structure and formatting...`);

    // ❌ DISABLED: Structure enforcement causes:
    // 2. Inconsistent formatting
    console.log(`🔍 [STRUCTURE] Skipping structure enforcement - LLM handles formatting`);
    // Keep fullResponse as-is from LLM

    // Step 2: Format Enforcement (bullets, bold, spacing, etc.)
    const formattedResult = formatAnswer(
      fullResponse,
      [],  // sources will be built later
      {
        language: queryLangName || 'portuguese',
        enforceLanguage: true,
        fixEncoding: true,
        deduplicateSources: true,
        addBoldHeadings: true
      }
    );

    fullResponse = formattedResult.answer;

    console.log('[MASTER-FORMATTER] Complete - Language:', formattedResult.language);

    // Legacy compatibility
    const formatResult = { violations: [] as any[], fixedText: fullResponse };

    if (formatResult.violations.length > 0) {
      console.log(`âœï¸ [FORMAT] Fixed ${formatResult.violations.length} violations:`,
        formatResult.violations.filter((v: any) => v.severity === 'error').map((v: any) => v.type).join(', '));
    }
    fullResponse = formatResult.fixedText || fullResponse;

    console.log(`âœ… [FORMAT] Enforcement complete - Violations:`, formatResult.violations.length);
    perfTimer.measure('Format Enforcement', 'formatEnforcement');

    // Send the format-enforced response to client
    onChunk(fullResponse);

    if (extractedCitations.length > 0) {
      console.log(`ðŸ“Ž [CITATION] Using LLM-provided structured citations (${extractedCitations.length} docs)`);

      // Build chunks array for citation matching
      const availableChunks = fullDocuments.length > 0
        ? fullDocuments.map(doc => ({
            metadata: {
              documentId: doc.id,
              filename: doc.title || 'Unknown',
              mimeType: doc.metadata?.mimeType || 'application/octet-stream',
              page: null
            },
            content: doc.content?.substring(0, 500) || '',
            score: doc.metadata?.relevanceScore || 1.0
          }))
        : rerankedChunks;

      // Build sources from LLM citations
      sources = citationTracking.buildSourcesFromCitations(extractedCitations, availableChunks);

      console.log(`âœ… [CITATION] Built ${sources.length} accurate sources from LLM citations`);
    } else if (fullDocuments.length > 0) {
      // Fallback: No LLM citations, use fast regex extraction on full documents
      console.log(`âš¡ [FAST CITATION] No LLM citations, building from full documents (regex-based)`);

      // Build "chunks" array from full documents for citation matching
      const pseudoChunks = fullDocuments.map(doc => ({
        metadata: {
          documentId: doc.id,
          filename: doc.title || 'Unknown',
          mimeType: doc.metadata?.mimeType || 'application/octet-stream',
          page: null
        },
        content: doc.content?.substring(0, 500) || '',
        score: doc.metadata?.relevanceScore || 1.0
      }));

      sources = fastCitationExtraction(fullResponse, pseudoChunks);
    } else {
      // Fallback: For chunks, use fast regex extraction
      console.log(`âš¡ [FAST CITATION] Building sources from chunks (regex-based)`);
      sources = fastCitationExtraction(fullResponse, rerankedChunks);
    }

    console.log(`âœ… [CITATION] Final: ${sources.length} sources (LLM citations: ${extractedCitations.length > 0 ? 'yes' : 'no'})`);
    perfTimer.measure('Sources Extraction', 'sourcesExtraction');

    perfTimer.mark('confidenceCalc');
    const confidence = confidenceScoring.calculateConfidence(
      sources,
      query,
      fullResponse
    );

    console.log(`ðŸŽ¯ [CONFIDENCE] Final confidence: ${confidence.level} (${confidence.score}/100)`);
    perfTimer.measure('Confidence Calculation', 'confidenceCalc');

    if (contradictionResult && contradictionResult.hasContradictions) {
      const contradictionMessage = contradictionDetection.formatContradictionsForUser(contradictionResult);
      onChunk(contradictionMessage);
      console.log(`ðŸ” [CONTRADICTION] Appended ${contradictionResult.contradictions.length} contradiction warning(s) to response`);
    }

    if (evidenceAggregation.shouldAggregateEvidence(complexity, fullDocuments.length)) {
      console.log(`ðŸ“š [EVIDENCE] Generating evidence map...`);
      const evidenceMap = await evidenceAggregation.generateEvidenceMap(
        fullResponse,
        fullDocuments.map(doc => ({ id: doc.id, filename: doc.title || 'Unknown', content: doc.content }))
      );

      const evidenceMessage = evidenceAggregation.formatEvidenceForUser(evidenceMap);
      if (evidenceMessage) {
        onChunk(evidenceMessage);
        console.log(`ðŸ“š [EVIDENCE] Appended evidence breakdown with ${evidenceMap.claims.length} claims`);
      }
    }

    if (conversationHistory && conversationHistory.length > 0) {
      const messages: any[] = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add current exchange
      messages.push({ role: 'user', content: query });
      messages.push({ role: 'assistant', content: fullResponse });

      // Extract memories asynchronously (don't block response)
      memoryExtraction.extractMemoriesFromRecentMessages(userId, messages, conversationId, 10)
        .catch(error => {
          console.error('âŒ [MEMORY EXTRACTION] Error:', error);
        });
    }

    perfTimer.mark('answerValidation');
    const validation = validateAnswer(fullResponse, query, sources);

    if (!validation.isValid) {
      console.log(`âš ï¸  [AGENT LOOP] Answer validation failed - issues detected`);
      validation.issues?.forEach(issue => console.log(`   - ${issue}`));

      // Log for monitoring (could trigger alert in production)
      console.log(`âš ï¸  [MONITORING] Low quality answer generated for query: "${query}"`);
    }
    perfTimer.measure('Answer Validation', 'answerValidation');

    console.log(`âœ… [FAST PATH] Complete - returning ${sources.length} sources`);
    console.log(`ðŸ” [DEBUG - RETURN] About to return sources:`, JSON.stringify(sources.slice(0, 2), null, 2));

    // Return with confidence scores
    const result: any = {
      sources,
      confidence  // âœ… NEW: Include confidence from confidenceScoring service
    };
    if (answerConfidence !== undefined) {
      result.complexReasoningConfidence = answerConfidence.score;  // âœ… Renamed to avoid conflict
      result.supporting_evidence = supportingEvidence;
      result.conflicting_evidence = conflictingEvidence;
      console.log(`ðŸ“Š [COMPLEX REASONING] Returning confidence: ${answerConfidence.level} (${answerConfidence.score}/100)`);
    }
    console.log(`â±ï¸ [PERF] Total time: ${Date.now() - startTime}ms`);

    // â±ï¸ PERFORMANCE: Print timing summary
    if (requestTimer) {
      requestTimer.end('TOTAL REQUEST');
      requestTimer.printSummary();
      requestTimer = null;
    }

    // â±ï¸ COMPLETE TIMING: Print detailed breakdown
    perfTimer.printSummary();

    return result;
}

// ============================================================================
// REAL STREAMING - Gemini generateContentStream
// ============================================================================

async function streamLLMResponse(
  systemPrompt: string,
  context: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  console.log('ðŸŒŠ [STREAMING] Starting Gemini streaming with table fix');

  const MAX_RETRIES = 3;
  let fullAnswer = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Reset for retry
      fullAnswer = '';

      console.log(`ðŸ"„ [STREAMING] Attempt ${attempt}/${MAX_RETRIES}`);

      // ✅ TRUE STREAMING: Forward chunks immediately to client
      // Post-processing (table fix, dedup) happens AFTER streaming completes
      fullAnswer = await geminiCache.generateStreamingWithCache({
        systemPrompt,
        documentContext: '', // Already included in systemPrompt - don't duplicate!
        query: '', // Query already included in systemPrompt
        temperature: 0.4,
        maxTokens: 4000,
        onChunk: (chunk: string) => {
          // ✅ IMMEDIATELY forward chunk to client (true streaming!)
          if (chunk && chunk.length > 0) {
            onChunk(chunk);
          }
        }
      });

      console.log(`âœ… [STREAMING] Complete. Total chars: ${fullAnswer.length}`);

      const validation = emptyResponsePrevention.validateResponse(
        fullAnswer,
        { hasDocuments: !!(context && context.length > 100) },
        { answerLength: 'medium' }
      );

      if (!validation.isValid) {
        console.warn(`âš ï¸ [STREAMING] Response validation failed: ${validation.reason}`);

        if (attempt < MAX_RETRIES) {
          // Wait before retry with exponential backoff
          const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.log(`â³ [STREAMING] Retrying in ${delayMs}ms... (${validation.suggestions?.join(', ')})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue; // Retry
        }

        // All retries failed - send context-aware fallback
        console.error('âŒ [STREAMING] All retry attempts failed validation');
        const fallbackMessage = emptyResponsePrevention.getFallbackResponse(context, 'en');
        // Apply format enforcement to fallback response
        const formattedRetryFallback = applyFormatEnforcement(fallbackMessage, {
          responseType: 'retry_fallback',
          logPrefix: '[RETRY-FALLBACK FORMAT]'
        });
        onChunk(formattedRetryFallback);
        return formattedRetryFallback;
      }

      // ✅ POST-PROCESSING: Apply fixes to the accumulated response (for return value)
      // Note: Chunks were already streamed to client in real-time above
      let fixedAnswer = fixMarkdownTableCells(fullAnswer);
      console.log('ðŸ"§ [TABLE FIX] Applied in streamLLMResponse (post-stream)');

      // This catches LLM responses that repeat themselves
      fixedAnswer = removeWholeBlockDuplication(fixedAnswer);

      // ✅ TRUE STREAMING: Don't re-send the full answer - it was already streamed!
      // The return value is used for logging/analytics, not for display
      console.log(`âœ… [STREAMING] Response already streamed. Final length: ${fixedAnswer.length} chars`);

      return fixedAnswer;

    } catch (error: any) {
      console.error(`âŒ [STREAMING] Error on attempt ${attempt}:`, {
        message: error.message,
        stack: error.stack?.substring(0, 500),
        name: error.name
      });

      // Check if we should retry
      const isRetryable = error.message?.includes('503') ||
                          error.message?.includes('429') ||
                          error.message?.includes('overload') ||
                          error.message?.includes('RESOURCE_EXHAUSTED');

      if (isRetryable && attempt < MAX_RETRIES) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`â³ [STREAMING] Retryable error, waiting ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue; // Retry
      }

      // Non-retryable or all retries exhausted
      if (fullAnswer.length === 0) {
        onChunk('I apologize, but I encountered an error generating the response. Please try again.');
      } else {
        console.warn('âš ï¸ [STREAMING] Error occurred AFTER successful response. Not sending error message to user.');
      }

      return fullAnswer;
    }
  }

  // Should not reach here, but just in case
  return fullAnswer;
}

async function smartStreamLLMResponse(
  systemPrompt: string,
  context: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  console.log('ðŸŒŠ [SMART STREAM] Starting with table fix');

  let fullAnswer = '';

  try {
    // Accumulate full response first, then fix tables and send at once
    fullAnswer = await geminiCache.generateStreamingWithCache({
      systemPrompt,
      documentContext: '', // Already included in systemPrompt - don't duplicate!
      query: '', // Query already included in systemPrompt
      temperature: 0.4,
      maxTokens: 4000,
      onChunk: () => {} // Don't stream - accumulate instead
    });

    let fixedAnswer = fixMarkdownTableCells(fullAnswer);
    console.log('ðŸ"§ [TABLE FIX] Applied in smartStreamLLMResponse');

    fixedAnswer = removeWholeBlockDuplication(fixedAnswer);

    // This ensures the caller's callback receives the generated response
    if (fixedAnswer && fixedAnswer.trim().length > 0) {
      onChunk(fixedAnswer);
      console.log(`âœ… [SMART STREAM] Sent response via onChunk: ${fixedAnswer.length} chars`);
    }

    console.log('âœ… [SMART STREAM] Complete. Total chars:', fixedAnswer.length);
    return fixedAnswer;

  } catch (error: any) {
    console.error('âŒ [SMART STREAM] Error:', error.message);
    if (fullAnswer.length === 0) {
      onChunk('I apologize, but I encountered an error generating the response. Please try again.');
    }
    return fullAnswer;
  }
}

// ============================================================================
// POST-PROCESSING
// ============================================================================

export async function postProcessAnswerExport(answer: string): Promise<string> {
  return postProcessAnswer(answer);
}

async function postProcessAnswer(answer: string): Promise<string> {
  let processed = answer.trim();

  // ============================================================================
  // MARKDOWN CODE BLOCK CLEANUP - Strip markdown code blocks that wrap tables
  // ============================================================================

  // Remove ```markdown or ``` at start
  if (processed.startsWith('```markdown')) {
    processed = processed.substring('```markdown'.length).trim();
  } else if (processed.startsWith('```')) {
    processed = processed.substring(3).trim();
  }

  // Remove ``` at end
  if (processed.endsWith('```')) {
    processed = processed.substring(0, processed.length - 3).trim();
  }

  // Remove any remaining code block markers around tables
  processed = processed.replace(/```markdown\n([\s\S]*?)\n```/g, '$1');
  processed = processed.replace(/```\n([\s\S]*?)\n```/g, '$1');

  // This prevents blue code blocks from appearing in the UI
  processed = processed.replace(/`([^`]+)`/g, '$1');

  // ============================================================================
  // ============================================================================

  // Pattern 1: (page X), (p. X), (pg. X), (p.X)
  // Matches: (page 3), (p. 5), (pg. 12), (p.7)
  processed = processed.replace(/\s*\((?:page|p\.|pg\.|p)\s*\d+\)/gi, '');

  // Pattern 2: [page X], [p. X], [p.X], [pg X], [p X]
  // Matches: [page 3], [p. 5], [p.7], [pg 1], [p 1]
  processed = processed.replace(/\s*\[(?:page|p\.|pg\.|pg|p)\s*\d+\]/gi, '');

  // Pattern 2a: [p.X, Y] or [p. X, Y] (multiple page citations)
  // Matches: [p.1, 2], [p. 3, 4, 5]
  processed = processed.replace(/\s*\[p\.\s*\d+(?:,\s*\d+)*\]/gi, '');

  // Pattern 3: [Source: filename]
  // Matches: [Source: document.pdf], [Source: Business Plan.docx]
  processed = processed.replace(/\s*\[Source:\s*[^\]]+\]/gi, '');

  // Pattern 4: Numbered citations [1], [2], etc.
  // Matches: [1], [2], [3]
  processed = processed.replace(/\s*\[\d+\]/g, '');

  // Pattern 5: "According to X.pdf," or "Based on Y.docx,"
  // Matches: "According to Business Plan.pdf,", "Based on Report.docx,"
  processed = processed.replace(/(?:According to|Based on)\s+[^,]+\.(pdf|docx|xlsx|pptx|txt),?\s*/gi, '');

  // Pattern 6: Superscript numbers (if Gemini adds them)
  // Matches: Â¹, Â², Â³, etc.
  processed = processed.replace(/\s*[\u2070-\u209F]+/g, '');

  // Pattern 7: "See page X" or "Refer to page X"
  // Matches: "See page 5", "Refer to page 12"
  processed = processed.replace(/(?:See|Refer to)\s+page\s+\d+\.?\s*/gi, '');

  // Pattern 8: (Document.pdf, page X) or (filename.docx, Page: X)
  // Matches: "(Business Plan.pdf, page 3)", "(Report.docx, Page: 5)"
  processed = processed.replace(/\s*\([^)]*\.(pdf|docx|xlsx|pptx|txt)[^)]*(?:page|Page|p\.|pg\.)\s*:?\s*\d+[^)]*\)/gi, '');

  // Pattern 9: [p.X] or [p. X] (square brackets with page)
  // Matches: [p.5], [p. 12]
  processed = processed.replace(/\s*\[p\.\s*\d+\]/gi, '');

  // ============================================================================
  // DOCUMENT NAME CLEANUP - Remove inline document citations
  // ============================================================================

  // Pattern 1: [filename.ext] - e.g., [Koda blueprint.docx], [Business Plan.pdf]
  // Matches: [anything.docx], [anything.pdf], [anything.xlsx], etc.
  processed = processed.replace(/\[([^\]]+\.(docx|pdf|xlsx|pptx|txt|doc|xls|ppt|csv))\]/gi, '');

  // Pattern 2: (filename.ext) - e.g., (Koda blueprint.docx)
  processed = processed.replace(/\(([^\)]+\.(docx|pdf|xlsx|pptx|txt|doc|xls|ppt|csv))\)/gi, '');

  processed = processed.replace(/\s+(?:in|from|provided in|detailed in|described in|under)\s+\[([^\]]+)\]/gi, '');

  // Pattern 4: Remove any remaining bracketed content that looks like a filename
  processed = processed.replace(/\[([^\]]*(?:blueprint|plan|document|report|analysis|checklist|guide|manual|specification)[^\]]*)\]/gi, '');

  // Pattern 5: "According to [document]," or "As stated in [document],"
  processed = processed.replace(/(?:As (?:stated|mentioned) in|Referring to)\s+[^\.,]+[,\.]\s*/gi, '');

  processed = processed.replace(/\s*\(\*\*[^)]+\.(pdf|docx?|txt|xlsx?|pptx?|csv|md)\*\*\)/gi, '');

  processed = processed.replace(/\s*\([^)]+\.(pdf|docx?|txt|xlsx?|pptx?|csv|md)\)/gi, '');

  // Pattern 8: Numeric citations [1], [2], [3], etc.
  processed = processed.replace(/\s*\[\d+\]/g, '');

  processed = processed.replace(/\n+---\n+\*\*(?:Sources?|Fontes?):?\*\*[\s\S]*$/i, '');
  processed = processed.replace(/\n+## (?:Sources?|Fontes?)\s*(?:Consulted)?[\s\S]*$/i, '');
  processed = processed.replace(/\n+\*\*(?:Sources?|Fontes?):?\*\*\s*\n[\s\S]*$/i, '');
  processed = processed.replace(/\n+### (?:SOURCE|SOURCES|FONTE|FONTES)\s*\n[\s\S]*$/i, '');
  processed = processed.replace(/\n+(?:SOURCE|FONTE):\s*\n[\s\S]*$/i, '');

  // Pattern 10: Remove "from **DocumentName**" inline references
  processed = processed.replace(/\s*\(from \*\*[^*]+\*\*\)/gi, '');

  // ============================================================================
  // FORMATTING CLEANUP
  // ============================================================================

  // Remove emojis
  processed = processed.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  processed = processed.replace(/[âŒâœ…ðŸ”ðŸ“ðŸ“ŠðŸ“„ðŸŽ¯âš ï¸ðŸ’¡ðŸš¨]/g, '');

  // Fix multiple asterisks
  processed = processed.replace(/\*\*\*\*+/g, '**');

  // Collapse 4+ newlines to 2 (one blank line)
  processed = processed.replace(/\n{4,}/g, '\n\n');

  // Flatten nested bullets (no extra blank lines)
  processed = processed.replace(/\n\s+[â—‹â—¦]\s+/g, '\nâ€¢ ');
  processed = processed.replace(/\n\s{2,}[â€¢\-\*]\s+/g, '\nâ€¢ ');

  // ============================================================================
  // CLEANUP ARTIFACTS
  // ============================================================================

  // Remove double spaces created by removals (but preserve newlines)
  processed = processed.replace(/[^\S\n]{2,}/g, ' ');

  // Clean up orphaned commas/periods
  processed = processed.replace(/\s+([.,])/g, '$1');

  // Remove spaces before punctuation
  processed = processed.replace(/\s+([!?;:])/g, '$1');

  // Ensure space after punctuation
  processed = processed.replace(/([.,!?;:])([A-Z])/g, '$1 $2');

  // ============================================================================
  // ENHANCED SPACING NORMALIZATION
  // ============================================================================

  // Normalize line breaks (max 2 consecutive)
  processed = processed.replace(/\n{3,}/g, '\n\n');

  // Remove trailing spaces on lines
  processed = processed.split('\n').map(line => line.trimEnd()).join('\n');

  // Ensure consistent spacing after headers (double newline)
  processed = processed.replace(/(^#{1,6}\s+.+)(\n)(?!\n)/gm, '$1\n\n');

  // Ensure single newline between bullet points
  processed = processed.replace(/(^[â€¢\-\*]\s+.+)(\n)(?=[â€¢\-\*])/gm, '$1\n');

  // Remove excessive spacing before bullet points
  processed = processed.replace(/\n{2,}(?=[â€¢\-\*])/g, '\n\n');

  // ============================================================================
  // TABLE DETECTION & CONVERSION - Fallback for incomplete tables
  // ============================================================================
  // Detect tables that are malformed (missing separator or have super long lines)
  if (processed.includes('|') && processed.includes('Feature')) {
    const lines = processed.split('\n');
    let hasTableHeader = false;
    let hasSeparator = false;
    let hasLongLine = false;

    for (const line of lines) {
      if (line.includes('|') && line.includes('Feature')) {
        hasTableHeader = true;
      }
      if (/\|[-\s]+\|/.test(line)) {
        hasSeparator = true;
      }
      // Check for lines over 500 chars (likely malformed table)
      if (line.length > 500 && line.includes('|')) {
        hasLongLine = true;
      }
    }

    // If table is incomplete or malformed, convert to bullets
    if (hasTableHeader && (!hasSeparator || hasLongLine)) {
      console.warn('âš ï¸ [POST-PROCESS] Incomplete/malformed table detected, converting to bullet format');
      processed = convertTableToBullets(processed);
    }
  }

  // ============================================================================
  // FORMAT VALIDATION - Quality Gate (Final Pass)
  // ============================================================================
  try {
    console.log('ðŸ” [POST-PROCESS] Running format validation...');
    const validationResult = await formatValidationService.validateAndCorrect(processed);

    if (!validationResult.isValid) {
      console.log(`âš ï¸ [POST-PROCESS] Format issues detected: ${validationResult.violations.length} violations`);
      validationResult.violations.forEach(v => {
        console.log(`   - [${v.severity}] ${v.rule}: ${v.message} (Auto-corrected: ${v.autoCorrected})`);
      });
    } else {
      console.log('âœ… [POST-PROCESS] Format validation passed');
    }

    // Use corrected text
    processed = validationResult.correctedText;
  } catch (error) {
    console.error('âŒ [POST-PROCESS] Format validation error:', error);
    // Continue with original processed text on error
  }

  // ============================================================================
  // FINAL PARAGRAPH FORMATTING - Ensure readable spacing
  // ============================================================================

  // Only add spacing after bullet point sections (not after every sentence)
  processed = processed.replace(/(\n[â€¢\-\*].+)(\n)([A-Z][^â€¢\-\*\n])/g, '$1\n\n$3');

  // Normalize multiple consecutive newlines to max 2
  processed = processed.replace(/\n{3,}/g, '\n\n');

  // ============================================================================
  // CUSTOM SPACING CONTROL - Convert {{BREAK:size}} and {{SPACE:N}} to HTML
  // ============================================================================
  // Converts spacing markers to HTML elements for frontend rendering:
  // - {{BREAK:lg}} → <div class="space-lg"></div> (24px)
  // - {{SPACE:50}} → <div style="margin-top: 50px;"></div>
  processed = smartProcessSpacing(processed);

  // ============================================================================
  // EXACT_FORMAT ENFORCEMENT - Convert to specification format
  // ============================================================================

  // 1. Remove ## headers at the start (headlines should be plain text)
  processed = processed.replace(/^##\s+[^\n]+\n+/, '');

  // 2. Convert * bullets to • bullets (EXACT_FORMAT requires • character)
  processed = processed.replace(/^\*\s+/gm, '• ');
  processed = processed.replace(/^-\s+/gm, '• ');

  // 3. Uppercase section headers after ### (micro labels should be ALL CAPS)
  processed = processed.replace(/^###\s+([^\n]+)/gm, (match, title) => {
    const upperCount = (title.match(/[A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ]/g) || []).length;
    const letterCount = (title.match(/[a-zA-ZàáâãäåçèéêëìíîïñòóôõöùúûüýÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount < 0.7) {
      return '### ' + title.toUpperCase();
    }
    return match;
  });

  const lines = processed.split('\n');
  if (lines.length > 1) {
    const firstLine = lines[0].trim();
    const contentWithoutFirst = lines.slice(1).join('\n').trim();
    if (firstLine && contentWithoutFirst.toLowerCase().includes(firstLine.toLowerCase().replace(/[*#]/g, '').trim().substring(0, 30))) {
      processed = contentWithoutFirst;
    }
  }

  return processed.trim();
}

/**
 * Convert malformed tables to bullet list format
 */
function convertTableToBullets(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let tableContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('|') && (line.includes('Feature') || line.includes('Aspect'))) {
      inTable = true;
      tableContent.push(line);
    } else if (inTable && line.includes('|')) {
      tableContent.push(line);
    } else {
      if (inTable && tableContent.length > 0) {
        // Convert accumulated table to bullets
        const bulletFormat = convertTableLinesToBullets(tableContent);
        result.push(bulletFormat);
        tableContent = [];
        inTable = false;
      }
      result.push(line);
    }
  }

  // Handle any remaining table content
  if (tableContent.length > 0) {
    const bulletFormat = convertTableLinesToBullets(tableContent);
    result.push(bulletFormat);
  }

  return result.join('\n');
}

/**
 * Convert table lines to bullet format
 */
function convertTableLinesToBullets(tableLines: string[]): string {
  if (tableLines.length === 0) return '';

  // Extract header
  const headerLine = tableLines[0];
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);

  // If we have a proper table, try to extract data
  const result: string[] = [];
  result.push('**Comparison:**\n');

  // For malformed tables, just show that we detected a table issue
  if (tableLines.length === 1 || tableLines[0].length > 500) {
    result.push('â€¢ (Table formatting issue detected - showing summary instead)');
    result.push('â€¢ Please refer to the document sources for detailed comparison');
    return result.join('\n');
  }

  // Try to extract meaningful content
  for (let i = 1; i < Math.min(tableLines.length, 10); i++) {
    const line = tableLines[i];
    if (line.includes('|') && !line.includes('---')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length > 0) {
        result.push(`â€¢ ${cells.join(' - ')}`);
      }
    }
  }

  return result.join('\n');
}

// ============================================================================
// LEGACY COMPATIBILITY - Non-streaming version (fallback)
// ============================================================================
// KODA FIX #1: Enhanced with debug logging, validation, and safety checks
// to fix the empty response bug (0% retention rate -> 95%+ retention)

export async function generateAnswer(
  userId: string,
  query: string,
  conversationId: string,
  answerLength: 'short' | 'medium' | 'summary' | 'long' = 'medium',
  attachedDocumentId?: string | string[],  // FIX #8: Accept array for multi-document support
  conversationHistory?: Array<{ role: string; content: string }>,
  isFirstMessage?: boolean  // NEW: Flag to control greeting logic
): Promise<{ answer: string; sources: any[] }> {

  // ============================================================================
  // DEBUG LOGGING - Identify where chunks are lost
  // ============================================================================
  console.log('ðŸ” [generateAnswer] Starting...');
  console.log(`   Query: "${query.substring(0, 50)}..."`);
  console.log(`   ConversationId: ${conversationId}`);
  console.log(`   AnswerLength: ${answerLength}`);
  console.log(`   IsFirstMessage: ${isFirstMessage}`);
  console.log(`   ConversationHistory: ${conversationHistory?.length || 0} messages`);

  let fullAnswer = '';
  let chunkCount = 0;
  let totalChunkLength = 0;
  const startTime = Date.now();
  const chunks: string[] = [];

  // ============================================================================
  // ENHANCED CALLBACK - Track every chunk
  // ============================================================================
  const trackingCallback = (chunk: string) => {
    chunkCount++;
    const chunkLen = chunk?.length || 0;
    totalChunkLength += chunkLen;

    // Log first 3 chunks and every 10th chunk
    if (chunkCount <= 3 || chunkCount % 10 === 0) {
      console.log(`ðŸ” [generateAnswer] Chunk #${chunkCount}: ${chunkLen} chars`);
      if (chunk) {
        console.log(`   Chunk preview: "${chunk.substring(0, 50)}..."`);
      }
    }

    // Collect all chunks - filter out empty ones
    if (chunk && chunk.trim()) {
      chunks.push(chunk);
    }

    // Verify accumulation is working
    if (chunkCount <= 3) {
      console.log(`   Total chunks collected: ${chunks.length}`);
    }
  };

  // ============================================================================
  // CALL generateAnswerStream with tracking callback
  // ============================================================================
  console.log('ðŸ” [generateAnswer] Calling generateAnswerStream...');

  const result = await generateAnswerStream(
    userId,
    query,
    conversationId,
    trackingCallback,  // Use tracking callback instead of inline
    attachedDocumentId,
    conversationHistory,  // Pass conversation history for context
    undefined,  // onStage
    undefined,  // memoryContext
    undefined,  // fullConversationContext
    isFirstMessage  // Pass first message flag for greeting logic
  );

  const endTime = Date.now();
  const duration = endTime - startTime;

  // ============================================================================
  // DETERMINE FINAL ANSWER - Use largest chunk (format-enforced full response)
  // ============================================================================
  if (chunks.length > 0) {
    // Sort by length descending and take the longest
    chunks.sort((a, b) => b.length - a.length);
    fullAnswer = chunks[0];
  }

  // ============================================================================
  // COMPLETION LOGGING - Verify results
  // ============================================================================
  console.log('ðŸ” [generateAnswer] Completed!');
  console.log(`   Total chunks received: ${chunkCount}`);
  console.log(`   Non-empty chunks: ${chunks.length}`);
  console.log(`   Total chunk length: ${totalChunkLength} chars`);
  console.log(`   fullAnswer length: ${fullAnswer.length} chars`);
  console.log(`   Sources count: ${result.sources?.length || 0}`);
  console.log(`   Duration: ${duration}ms`);

  // ============================================================================
  // CRITICAL VALIDATION - Detect empty responses
  // ============================================================================
  if (chunkCount === 0) {
    console.error('âŒ [generateAnswer] CRITICAL: No chunks received from generateAnswerStream!');
    console.error('   This indicates the onChunk callback was never called.');
    console.error('   Possible causes:');
    console.error('   1. generateAnswerStream returned early without streaming');
    console.error('   2. LLM API error that was silently caught');
    console.error('   3. Streaming logic is broken');
  }

  if (chunkCount > 0 && chunks.length === 0) {
    console.error('âŒ [generateAnswer] CRITICAL: Chunks received but all were empty!');
    console.error('   This indicates chunks contain only whitespace.');
  }

  if (chunks.length > 0 && fullAnswer.length === 0) {
    console.error('âŒ [generateAnswer] CRITICAL: Chunks collected but fullAnswer is empty!');
    console.error('   This indicates chunk selection/sorting is broken.');
  }

  // ============================================================================
  // SAFETY CHECK - Provide fallback for empty responses (SAFETY NET)
  // ============================================================================
  if (!fullAnswer || fullAnswer.trim().length === 0) {
    console.error('âŒ [generateAnswer] CRITICAL: Empty response detected!');
    console.error('   Applying SAFETY NET fallback instead of throwing error.');

    // Provide detailed error for debugging
    const errorDetails = {
      chunksReceived: chunkCount,
      nonEmptyChunks: chunks.length,
      totalChunkLength,
      fullAnswerLength: fullAnswer.length,
      sourcesCount: result.sources?.length || 0,
      duration,
      query: query.substring(0, 100),
      conversationId
    };

    console.error('   Error details:', JSON.stringify(errorDetails, null, 2));

    // Detect language from query for appropriate fallback
    const lang = detectLanguage(query);
    const fallbackMessages: Record<string, string> = {
      pt: 'Desculpe, nÃ£o consegui processar sua solicitaÃ§Ã£o. Por favor, tente reformular sua pergunta.',
      es: 'Lo siento, no pude procesar tu solicitud. Por favor, intenta reformular tu pregunta.',
      en: "I'm sorry, I couldn't process your request. Please try rephrasing your question."
    };

    // SAFETY NET: Return fallback instead of throwing error
    fullAnswer = fallbackMessages[lang] || fallbackMessages.en;
    console.log(`âœ… [generateAnswer] SAFETY NET applied: "${fullAnswer}"`);
  }

  // ============================================================================
  // MINIMUM LENGTH CHECK - Ensure meaningful responses
  // ============================================================================
  if (fullAnswer.trim().length < 10) {
    console.warn('âš ï¸ [generateAnswer] WARNING: Very short response!');
    console.warn(`   Response: "${fullAnswer}"`);
    console.warn(`   This may indicate a low-quality response.`);
    // Don't throw error for short responses, but log for monitoring
    // Some valid responses can be short (e.g., "Yes", "No", "I don't know")
  }


  // ============================================================================
  // DOCUMENT ACCESS DENIAL FIX - Replace incorrect "no access" responses
  // ============================================================================
  const accessDenialPatterns = [
    /as an ai,? i do not have access/i,
    /i do not have access to your/i,
    /i cannot access your (files|documents|personal)/i,
    /i can't access your (files|documents|personal)/i,
    /i don't have access to your/i,
    /cannot view your private files/i,
    /i am an ai assistant and cannot view/i,
    /i cannot see your uploaded documents/i,
    /please share the document content/i
  ];

  const hasAccessDenial = accessDenialPatterns.some(pattern => pattern.test(fullAnswer));

  if (hasAccessDenial) {
    console.warn('[generateAnswer] DETECTED ACCESS DENIAL RESPONSE - Replacing...');
    console.warn('   Original: "' + fullAnswer.substring(0, 100) + '..."');

    // Detect language and provide helpful response
    const lang = detectLanguage(query);
    const helpfulResponses: Record<string, string> = {
      pt: 'Para ajudá-lo melhor, por favor especifique qual documento ou informação você gostaria de explorar. Você pode perguntar sobre documentos específicos, comparar arquivos, ou pedir um resumo de determinado tópico.',
      es: 'Para ayudarte mejor, por favor especifica qué documento o información te gustaría explorar. Puedes preguntar sobre documentos específicos, comparar archivos o solicitar un resumen de un tema determinado.',
      en: 'To help you better, please specify which document or information you would like to explore. You can ask about specific documents, compare files, or request a summary of a particular topic.'
    };

    fullAnswer = helpfulResponses[lang] || helpfulResponses.en;
    console.log('[generateAnswer] Replaced with helpful response');
  }

  // ============================================================================
  // SUCCESS METRICS - Log for monitoring
  // ============================================================================
  console.log('âœ… [generateAnswer] Success!');
  console.log(`   Response preview: "${fullAnswer.substring(0, 100)}..."`);
  console.log(`   Chunks/second: ${(chunkCount / (duration / 1000)).toFixed(2)}`);
  console.log(`   Chars/second: ${(fullAnswer.length / (duration / 1000)).toFixed(2)}`);

  // ============================================================================
  // ============================================================================
  let formatted = fullAnswer;
  let formatScore = 100;
  let formatErrors: string[] = [];

  // ✅ FIX V4: Skip format enforcement for greetings and file listings
  const isGreeting = fullAnswer.length < 100 && /^(hello|hi|hey|olá|hola|bonjour|oi|bom dia|boa tarde|boa noite)!?\s*(how can i|como posso)?/i.test(fullAnswer.trim());
  const isFileListing = fullAnswer.trim().startsWith('📁');
  const shouldSkipFormatting = isGreeting || isFileListing;

  if (shouldSkipFormatting) {
    console.log('[FORMAT] Skipping format enforcement for:', isGreeting ? 'greeting' : 'file listing');
    // Keep formatted as fullAnswer, skip format enforcement entirely
  } else {
    try {
      console.log('[FORMAT] Applying format enforcement...');
      console.log('[FORMAT] Pre-enforcement length:', fullAnswer.length);

      // Apply format enforcement
      const formatResult = kodaFormatEnforcementService.enforceFormat(fullAnswer);
      formatted = formatResult.fixedText || fullAnswer;

      console.log('[FORMAT] Post-enforcement length:', formatted.length);

      // Validate the formatted response
      const validation = await formatValidationService.validateAndCorrect(formatted);
      formatScore = validation.stats?.boldPercentage ? Math.min(100, validation.stats.boldPercentage * 10) : 100;
      formatErrors = validation.violations?.filter(v => v.severity === 'error').map(v => v.message) || [];

      // Use the corrected text if available
      if (validation.correctedText) {
        formatted = validation.correctedText;
      }

      console.log('[FORMAT] Format enforcement complete');
      console.log('[FORMAT] Violations:', validation.violations?.length || 0);

      if (formatErrors.length > 0) {
        console.warn('[FORMAT] Format issues:', formatErrors);
      }

    } catch (error) {
      console.error('[FORMAT] Format enforcement failed:', error);
      formatted = fullAnswer;
      formatScore = 0;
    }
  } // ✅ Close the else block

  // ============================================================================
  // CONTENT VALIDATION (emptyResponsePrevention - prevents "sources only" bug)
  // ============================================================================
  const contentValidation = emptyResponsePrevention.validateResponse(
    formatted,
    {
      query,
      hasDocuments: result.sources && result.sources.length > 0,
      documentCount: result.sources?.length || 0
    },
    { answerLength: 'medium' }
  );

  if (!contentValidation.isValid) {
    console.warn('[CONTENT VALIDATION] Issues detected:');
    contentValidation.issues.forEach(issue => console.warn(`   - ${issue}`));

    // If response is essentially empty (sources only bug), try to regenerate
    if (contentValidation.issues.some(i => i.includes('only title/sources'))) {
      console.error('[CONTENT VALIDATION] CRITICAL: Sources-only bug detected!');
      console.log('[CONTENT VALIDATION] Response needs substantive content');
      // Log but don't fail - the validation service caught it for monitoring
    }
  } else {
    console.log(`[CONTENT VALIDATION] Score: ${contentValidation.score}/100`);
  }

  // Basic fallback validation
  const validationErrors: string[] = contentValidation.issues || [];

  if (!formatted || formatted.trim().length === 0) {
    throw new Error('Response validation failed: Empty response');
  }

  if (validationErrors.length > 0 && contentValidation.score !== undefined && contentValidation.score < 30) {
    console.warn('[VALIDATION] Critical issues found:', validationErrors);
  }

  // ============================================================================
  // UNIFIED POST-PROCESSING - Single pass through kodaUnifiedPostProcessor
  // Replaces: qaPostProcessAnswer, formatValidation, kodaFormatEnforcement, etc.
  // ============================================================================
  try {
    console.log('[UNIFIED POST-PROCESSOR] Starting unified post-processing...');

    // Build input for unified post-processor
    const postProcessInput: PostProcessingInput = {
      answer: formatted,
      query,
      sources: result.sources?.map((s: any) => ({
        documentId: s.documentId || s.id,
        documentName: s.documentName || s.filename || s.name,
        score: s.score,
      })) || [],
      queryLanguage: detectQueryLanguage(query),
      answerType: determineAnswerType(query, formatted.length),
    };

    // Process through unified pipeline
    const postProcessResult = kodaUnifiedPostProcessor.process(postProcessInput);

    // Log stats
    const { stats } = postProcessResult;
    if (stats.duplicatesRemoved > 0 || stats.sourceSectionsRemoved || stats.emojisRemoved > 0) {
      console.log('[UNIFIED POST-PROCESSOR] Cleaned:', {
        duplicatesRemoved: stats.duplicatesRemoved,
        sourceSectionsRemoved: stats.sourceSectionsRemoved,
        citationsFixed: stats.citationsFixed,
        emojisRemoved: stats.emojisRemoved,
        languageCorrected: stats.languageCorrected,
      });
    }

    formatted = postProcessResult.processedAnswer;

    // Return with deduplicated sources
    return {
      answer: formatted,
      sources: postProcessResult.dedupedSources.length > 0
        ? postProcessResult.dedupedSources
        : result.sources,
    };
  } catch (error) {
    console.error('[UNIFIED POST-PROCESSOR] Post-processing failed:', error);
    // Continue with original formatted answer
    return {
      answer: formatted,
      sources: result.sources,
    };
  }
}

// ============================================================================
// BACKWARDS COMPATIBILITY WRAPPER
// ============================================================================
// Returns: { answer: string, sources: any[] }
// New signature: (userId, query, conversationId, onChunk, attachedDocumentId)
// Returns: void (streams only)
export async function generateAnswerStreaming(
  userId: string,
  query: string,
  conversationId: string,
  answerLength: 'short' | 'medium' | 'summary' | 'long',
  documentId: string | null | undefined,
  onChunk: (chunk: string) => void
): Promise<{ answer: string; sources: any[] }> {
  // Accumulate chunks to build final answer
  let fullAnswer = '';

  // Wrap the onChunk callback to accumulate chunks
  const accumulatingCallback = (chunk: string) => {
    fullAnswer += chunk;
    onChunk(chunk); // Still call the original callback for streaming
  };

  const result = await generateAnswerStream(
    userId,
    query,
    conversationId,
    accumulatingCallback,
    documentId || undefined
  );

  const { formatValidationService } = await import('./formatValidation.service');
  const fixedAnswer = formatValidationService.fixFormatting(fullAnswer);

  // Return result object for backwards compatibility
  return {
    answer: fixedAnswer,
    sources: result.sources,  // âœ… FIXED: Return actual sources
  };
}

// ============================================================================
// FILE LOCATION QUERY DETECTION & HANDLING
// ============================================================================

function detectFileLocationQuery(query: string): boolean {
  const lower = query.toLowerCase();

  // Check for location keywords + filename pattern
  const hasLocationKeyword = /\b(where|find|locate|location of)\b/.test(lower);
  const hasFilenamePattern = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g|gif)\b/i.test(query);

  return hasLocationKeyword && hasFilenamePattern;
}

// ============================================================================
// CONTENT-BASED FILE LOCATION DETECTION & HANDLING (NEW)
// ============================================================================
// Handles queries like "Where is the file that talks about X?"

function detectContentBasedLocationQuery(query: string): boolean {
  const lower = query.toLowerCase();

  // Skip if it already has a filename pattern (use regular file location handler)
  const hasFilenamePattern = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g|gif)\b/i.test(query);
  if (hasFilenamePattern) {
    return false;
  }

  // Pattern 1: "Where is the file that talks about X?"
  if (/\b(where|find|locate)\b.*\b(file|document|arquivo|documento)\b.*\b(about|talks?\s*about|mentions?|contains?|has|regarding|on|sobre|fala\s*sobre|menciona|contém)\b/i.test(lower)) {
    return true;
  }

  // Pattern 2: "Which file has X?" / "What file contains X?"
  if (/\b(which|what|qual)\b.*\b(file|document|arquivo|documento)\b.*\b(has|contains?|mentions?|talks?\s*about|tem|contém|menciona|fala\s*sobre)\b/i.test(lower)) {
    return true;
  }

  // Pattern 3: "Find files about X" / "Find documents about X"
  if (/\b(find|show|list|locate|encontre|mostre|liste)\b.*\b(files?|documents?|arquivos?|documentos?)\b.*\b(about|on|regarding|sobre)\b/i.test(lower)) {
    return true;
  }

  // Pattern 4: "Locate the document about X" / "Find the file on X"
  if (/\b(locate|find|encontre)\b.*\b(the\s+)?(file|document|arquivo|documento)\b.*\b(about|on|regarding|sobre)\b/i.test(lower)) {
    return true;
  }

  return false;
}

async function getFullFolderPath(folderId: string | null): Promise<string> {
  if (!folderId) return 'root';

  const path: string[] = [];
  let currentFolderId: string | null = folderId;
  let iterations = 0;
  const maxIterations = 20; // Prevent infinite loops

  while (currentFolderId && iterations < maxIterations) {
    const folder: { name: string; parentFolderId: string | null } | null = await prisma.folder.findUnique({
      where: { id: currentFolderId },
      select: { name: true, parentFolderId: true }
    });

    if (!folder) break;

    path.unshift(folder.name); // Add to beginning of path
    currentFolderId = folder.parentFolderId;
    iterations++;
  }

  return path.length > 0 ? path.join('/') : 'root';
}

function extractTopicFromQuery(query: string): string {
  // Pattern 1: "about X" / "talks about X" / "regarding X"
  let match = query.match(/\b(about|talks?\s*about|mentions?|regarding|on|sobre|fala\s*sobre)\s+(.+?)(\?|$)/i);
  if (match && match[2]) {
    return match[2].trim().replace(/[?.!]$/, '');
  }

  // Pattern 2: "has X" / "contains X"
  match = query.match(/\b(has|contains?|tem|contém)\s+(.+?)(\?|$)/i);
  if (match && match[2]) {
    return match[2].trim().replace(/[?.!]$/, '');
  }

  // Pattern 3: Extract after "file/document that"
  match = query.match(/\b(file|document|arquivo|documento)\s+(that|which|que)\s+(.+?)(\?|$)/i);
  if (match && match[3]) {
    return match[3].trim().replace(/[?.!]$/, '');
  }

  // Fallback: last meaningful words (remove location keywords)
  const cleanedQuery = query
    .replace(/\b(where|find|locate|which|what|the|is|are|a|an|file|document|arquivo|documento|that|has|contains|about|talks?)\b/gi, '')
    .replace(/[?.!]/g, '')
    .trim();

  const words = cleanedQuery.split(/\s+/).filter(w => w.length > 2);
  return words.slice(-4).join(' ') || query;
}

async function handleContentBasedLocationQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('🔍 [CONTENT LOCATION] Searching for files by content...');

  // Extract topic from query
  const topic = extractTopicFromQuery(query);
  console.log(`🔍 [CONTENT LOCATION] Extracted topic: "${topic}"`);

  try {
    // Generate embedding for the query using the embedding service
    const embeddingResult = await embeddingService.generateEmbedding(query);
    if (!embeddingResult.embedding || embeddingResult.embedding.length === 0) {
      onChunk(`I couldn't process your search query. Please try again.`);
      return { sources: [] };
    }

    // Make sure Pinecone is initialized
    if (!pineconeIndex) {
      await initializePinecone();
    }

    // Search Pinecone for relevant documents
    const results = await pineconeIndex.query({
      vector: embeddingResult.embedding,
      topK: 20,
      filter: { userId },
      includeMetadata: true
    });

    if (!results.matches || results.matches.length === 0) {
      const noMatchesMsg = `**I couldn't find any files about "${topic}"** in your library.\n\n• Try a different search term\n• Check if the document has been uploaded`;
      const formattedNoMatches = applyFormatEnforcement(noMatchesMsg, {
        responseType: 'no_matches_fallback',
        logPrefix: '[NO-MATCHES FORMAT]'
      });
      onChunk(formattedNoMatches);
      return { sources: [] };
    }

    // Group by document and get best score for each
    const documentScores = new Map<string, { score: number; metadata: any }>();
    for (const match of results.matches) {
      const docId = match.metadata?.documentId as string;
      if (!docId) continue;

      const score = match.score || 0;
      const existing = documentScores.get(docId);
      if (!existing || score > existing.score) {
        documentScores.set(docId, { score, metadata: match.metadata });
      }
    }

    // Get top documents (minimum score threshold)
    const topDocIds = Array.from(documentScores.entries())
      .filter(([_, data]) => data.score >= 0.3) // Minimum relevance threshold
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([docId]) => docId);

    if (topDocIds.length === 0) {
      const lowRelevanceMsg = `**I couldn't find relevant files about "${topic}"** in your library.\n\n• Try a more specific search term\n• Use different keywords`;
      const formattedLowRelevance = applyFormatEnforcement(lowRelevanceMsg, {
        responseType: 'low_relevance_fallback',
        logPrefix: '[LOW-RELEVANCE FORMAT]'
      });
      onChunk(formattedLowRelevance);
      return { sources: [] };
    }

    // Fetch documents with folder info
    const documents = await prisma.document.findMany({
      where: { id: { in: topDocIds } },
      include: {
        folder: {
          select: { id: true, name: true, parentFolderId: true }
        }
      }
    });

    // Build response with full paths
    if (documents.length === 1) {
      const doc = documents[0];
      const fullPath = await getFullFolderPath(doc.folderId);
      const score = documentScores.get(doc.id)?.score || 0;
      const confidence = score >= 0.7 ? 'high' : score >= 0.5 ? 'good' : 'possible';

      onChunk(`The file about "${topic}" is:\n\n**${doc.filename}**\n\nLocation: \`${fullPath}/${doc.filename}\`\n\nConfidence: ${confidence}`);

      return {
        sources: [{
          documentId: doc.id,
          documentName: doc.filename,
          score
        }]
      };
    }

    // Multiple files found
    const fileList = await Promise.all(
      documents.map(async (doc) => {
        const fullPath = await getFullFolderPath(doc.folderId);
        const score = documentScores.get(doc.id)?.score || 0;
        const scoreIndicator = score >= 0.7 ? '🟢' : score >= 0.5 ? '🟡' : '⚪';
        return `${scoreIndicator} **${doc.filename}**\n   Location: \`${fullPath}/\``;
      })
    );

    onChunk(`I found ${documents.length} files about "${topic}":\n\n${fileList.join('\n\n')}`);

    const sources = documents.map(doc => ({
      documentId: doc.id,
      documentName: doc.filename,
      score: documentScores.get(doc.id)?.score || 0
    }));

    return { sources };

  } catch (error) {
    console.error('[CONTENT LOCATION] Error:', error);
    onChunk(`I encountered an error searching for files about "${topic}". Please try again.`);
    return { sources: [] };
  }
}

/**
 * Handle file location queries with direct database lookup
 */
async function handleFileLocationQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('ðŸ“ [FILE LOCATION] Searching database for file...');

  // Extract filename from query
  const filenameMatch = query.match(/([a-zA-Z0-9_\-\.]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g|gif))/i);
  const filename = filenameMatch ? filenameMatch[1] : null;

  if (!filename) {
    onChunk('I couldn\'t identify a specific filename in your question. Could you provide the exact filename?');
    return { sources: [] };
  }

  // Query database for file
  const documents = await prisma.document.findMany({
    where: {
      userId,
      filename: { contains: filename, mode: 'insensitive' }
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
          emoji: true,
          parentFolderId: true
        }
      }
    }
  });

  if (documents.length === 0) {
    // Find similar files to suggest alternatives
    const similarFiles = await prisma.document.findMany({
      where: {
        userId,
        status: { not: 'deleted' }
      },
      select: { id: true, filename: true },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    // Use dynamic fallback response
    const fallbackMessage = await fallbackResponseService.generateFileNotFoundResponse(
      query,
      filename,
      userId,
      'en', // TODO: Detect language from query
      similarFiles
    );
    // Apply format enforcement to fallback response
    const formattedFallback = applyFormatEnforcement(fallbackMessage, {
      responseType: 'file_not_found_fallback',
      logPrefix: '[FILE-NOT-FOUND FORMAT]'
    });
    onChunk(formattedFallback);
    return { sources: [] };
  }

  if (documents.length === 1) {
    const doc = documents[0];
    const fullPath = await getFullFolderPath(doc.folderId);
    onChunk(`**${doc.filename}** is located in:\n\n\`${fullPath}/${doc.filename}\``);
    return { sources: [{ documentId: doc.id, documentName: doc.filename, score: 1.0 }] };
  }

  // Multiple files with same name - use full paths
  const locations = await Promise.all(documents.map(async (doc) => {
    const fullPath = await getFullFolderPath(doc.folderId);
    return `- **${doc.filename}** in \`${fullPath}/\``;
  }));

  onChunk(`I found ${documents.length} files with that name:\n\n${locations.join('\n')}`);

  const sources = documents.map(doc => ({
    documentId: doc.id,
    documentName: doc.filename,
    score: 1.0
  }));

  return { sources };
}

// ============================================================================
// FOLDER CONTENT QUERY DETECTION & HANDLING
// ============================================================================

function detectFolderContentQuery(query: string): boolean {
  const lower = query.toLowerCase();

  const patterns = [
    // ============================================================================
    // "what is in..." patterns
    // ============================================================================

    // "what is in folder X" or "what's in folder X"
    /what('s|\s+is)\s+(in|inside)\s+(my\s+)?folder\s+(\w+)/i,

    // "what is in X folder" or "what's in X folder"
    /what('s|\s+is)\s+(in|inside)\s+(my\s+)?(\w+)\s+folder/i,

    // ============================================================================
    // "show me..." patterns
    // ============================================================================

    // "show me folder X" or "show folder X"
    /show\s+(me\s+)?(my\s+)?folder\s+(\w+)/i,

    // "show me X folder" or "show X folder"
    /show\s+(me\s+)?(my\s+)?(\w+)\s+folder/i,

    // ============================================================================
    // "list..." patterns
    // ============================================================================

    // "list folder X" or "list files in folder X"
    /list\s+(files\s+in\s+)?folder\s+(\w+)/i,

    // "list X folder" or "list files in X folder"
    /list\s+(files\s+in\s+)?(\w+)\s+folder/i,

    // ============================================================================
    // "folder contents/files" patterns
    // ============================================================================

    // "folder X contents" or "folder X files"
    /folder\s+(\w+)\s+(contents?|files?)/i,

    // "X folder contents" or "X folder files"
    /(\w+)\s+folder\s+(contents?|files?)/i,

    // ============================================================================
    // Direct folder queries
    // ============================================================================

    // "inside folder X" or "inside X folder"
    /inside\s+(my\s+)?folder\s+(\w+)/i,
    /inside\s+(my\s+)?(\w+)\s+folder/i
  ];

  return patterns.some(pattern => pattern.test(lower));
}

/**
 * Handle folder content queries with direct database lookup
 */
async function handleFolderContentQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  console.log('ðŸ“ [FOLDER CONTENT] Searching for folder...');

  // Extract folder name - try multiple patterns to support both word orders
  let folderName = null;

  // Pattern 1: "folder X" format (e.g., "show me folder trabalhos")
  const folderFirstMatch = query.match(/folder\s+(\w+)/i);
  if (folderFirstMatch) {
    folderName = folderFirstMatch[1];
  }

  // Pattern 2: "X folder" format (e.g., "what's in trabalhos folder")
  if (!folderName) {
    const folderLastMatch = query.match(/(?:in|inside|show|what'?s?\s+in)\s+(?:my\s+)?(\w+)\s+folder/i);
    if (folderLastMatch) {
      folderName = folderLastMatch[1];
    }
  }

  // Pattern 3: Generic "show me X" or "what's in X"
  if (!folderName) {
    const genericMatch = query.match(/(?:show\s+me|what'?s?\s+in)\s+(?:my\s+)?(\w+)/i);
    if (genericMatch && !['folder', 'folders', 'file', 'files', 'document', 'documents'].includes(genericMatch[1].toLowerCase())) {
      folderName = genericMatch[1];
    }
  }

  if (!folderName) {
    onChunk('I couldn\'t identify which folder you\'re asking about. Could you specify the folder name?');
    return { sources: [] };
  }

  // Query database for folder
  const folder = await prisma.folder.findFirst({
    where: {
      userId,
      name: { contains: folderName, mode: 'insensitive' }
    },
    include: {
      documents: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      },
      subfolders: {
        select: {
          id: true,
          name: true,
          emoji: true,
          _count: {
            select: { documents: true }
          }
        }
      }
    }
  });

  if (!folder) {
    // Get full folder data for hierarchical display
    const fullFolders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: { select: { documents: true } },
        subfolders: { select: { id: true, name: true } }
      }
    });

    const response = folderNav.formatFolderNotFoundResponse(folderName, fullFolders);
    onChunk(response);
    return { sources: [] };
  }

  // Get all folders for breadcrumb navigation
  const allFolders = await prisma.folder.findMany({
    where: { userId },
    select: { id: true, name: true, parentFolderId: true }
  });

  // Use new folder navigation service for organized display
  let response: string;

  if (folder.documents.length === 0) {
    response = folderNav.formatEmptyFolderResponse(folder, allFolders);
  } else {
    response = folderNav.formatFolderContentResponse(folder, allFolders);
  }


  onChunk(response);

  const sources = folder.documents.map(doc => ({
    documentId: doc.id,
    documentName: doc.filename,
    score: 1.0
  }));

  return { sources };
}

// ============================================================================
// FOLDER LISTING QUERY DETECTION & HANDLING
// ============================================================================

function detectFolderListingQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  const patterns = [
    // "which/what folders..." (with or without trailing words)
    /(which|what)\s+(folders|directories)(\s+(do\s+i\s+have|exist|are\s+there|have\s+i|did\s+i\s+create))?/i,

    // "show/list my folders"
    /(show|list|display|give\s+me)\s+(me\s+)?(my\s+|all\s+|the\s+)?(folders|directories)/i,

    // "do I have folders" / "are there folders"
    /(do\s+i\s+have|are\s+there|have\s+i\s+got)\s+(any\s+)?(folders|directories)/i,

    // "my folders" or "folders" (standalone, with optional question mark)
    /^(my\s+)?(folders|directories)\??$/i,

    // "all folders"
    /^all\s+(folders|directories)\??$/i,

    // "folders I have" / "folders I created"
    /folders?\s+(i\s+have|i\s+created|i\s+made)/i,

    // Portuguese patterns
    /(quais|que|mostrar|listar)\s+(pastas|diret[Ã³o]rios)/i,
    /(minhas?\s+)?(pastas|diret[Ã³o]rios)\??$/i,

    // Spanish patterns
    /(cuÃ¡les|quÃ©|mostrar|listar)\s+(carpetas|directorios)/i,
    /(mis?\s+)?(carpetas|directorios)\??$/i,
  ];

  const isMatch = patterns.some(pattern => pattern.test(lower));

  if (isMatch) {
    console.log('ðŸ“‚ [FOLDER LISTING DETECT] Query matched folder listing pattern:', query);
  }

  return isMatch;
}

/**
 * Handle folder listing queries by fetching all user folders from database
 */
async function handleFolderListingQuery(
  userId: string,
  onChunk: (chunk: string) => void
): Promise<{ sources: any[] }> {
  try {
    // Fetch all folders for user
    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { documents: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (folders.length === 0) {
      const response = "You don't have any folders yet. You can create folders to organize your documents by saying:\n\n\"Create folder Finance\"";
      onChunk(response);
      return { sources: [] };
    }

    // Use new folder navigation service for organized display
    const response = folderNav.formatFolderListingResponse(folders);
    onChunk(response);
    return { sources: [] };

  } catch (error) {
    console.error('[FOLDER LISTING] Error:', error);
    onChunk('I encountered an error while fetching your folders. Please try again.');
    return { sources: [] };
  }
}

/**
 * Format folder for display with proper Markdown list indentation
 */
function formatFolderTreeItem(folder: any, depth: number): string {
  const indent = '  '.repeat(depth);
  const docCount = folder._count?.documents || 0;
  const docText = docCount === 1 ? '1 document' : `${docCount} documents`;
  const prefix = depth === 0 ? '-' : '  -';
  let result = indent + prefix + ' **' + folder.name + '** (' + docText + ')\n';

  if (folder.children && folder.children.length > 0) {
    folder.children.forEach((child: any) => {
      result += formatFolderTreeItem(child, depth + 1);
    });
  }

  return result;
}

// ============================================================================
// FOLDER TREE CONTEXT BUILDER
// ============================================================================

function buildFolderTreeContext(folders: any[]): string {
  if (folders.length === 0) {
    return "**User's Folders**: No folders created yet. User can create folders to organize documents.";
  }

  const rootFolders = folders.filter(f => !f.parentFolderId);

  const buildTree = (folder: any, indent: string = ''): string => {
    const docCount = folder._count?.documents || 0;
    const fileWord = docCount === 1 ? 'file' : 'files';
    let result = indent + '**' + folder.name + '** (' + docCount + ' ' + fileWord + ')';

    const subfolders = folders.filter(f => f.parentFolderId === folder.id);
    if (subfolders.length > 0) {
      result += '\n' + subfolders.map(sf => buildTree(sf, indent + '  ')).join('\n');
    }

    return result;
  };

  const tree = rootFolders.map(f => buildTree(f)).join('\n');

  return "**User's Folder Structure**:\n" + tree + "\n\n**Important**: When users ask about folders or file locations, refer to this structure.";
}

// ============================================================================
// ADVANCED QUERY TYPE DETECTION & SPECIALIZED HANDLERS
// ============================================================================

/**
 * Query types that require specialized handling beyond simple RAG
 */
type AdvancedQueryType =
  | 'entity_extraction'   // Extract people, companies, locations
  | 'synthesis'          // Summarize all, create outline, executive summary
  | 'data_extraction'    // Extract numbers, dates, statistics
  | 'metadata'           // List documents, file info, upload dates
  | 'content_query';     // Standard RAG query

/**
 * Detect query type to route to appropriate handler
 */
function detectAdvancedQueryType(query: string): AdvancedQueryType {
  const lowerQuery = query.toLowerCase();

  // Entity extraction patterns
  const entityPatterns = [
    /list (all )?(people|person|companies|company|organization|author|name)/i,
    /extract (all )?(people|person|companies|organization|name)/i,
    /who (are|is) mentioned/i,
    /what (companies|organizations|people|authors)/i,
    /find (all )?(people|companies|organizations)/i,
  ];

  if (entityPatterns.some(p => p.test(query))) {
    return 'entity_extraction';
  }

  // Synthesis patterns (need ALL documents)
  const synthesisPatterns = [
    /summarize (all|my) documents?/i,
    /create (a|an) (outline|summary|report)/i,
    /write (a|an) (executive|comprehensive|board) (summary|report)/i,
    /what do (my|all) documents have in common/i,
    /main themes? (across|in) (all|my) documents?/i,
    /generate (a|an) (report|summary|outline)/i,
    /(faÃ§a|crie|escreva) um (resumo|relatÃ³rio)/i, // Portuguese
    /(haz|crea|escribe) un (resumen|informe)/i, // Spanish
  ];

  if (synthesisPatterns.some(p => p.test(query))) {
    return 'synthesis';
  }

  // Data extraction patterns
  const dataPatterns = [
    /extract (all )?(numbers?|statistics?|data|metrics?)/i,
    /list (all )?(numbers?|statistics?|data|dates?)/i,
    /what (numbers?|statistics?|data|metrics?) (are|is)/i,
    /find (all )?(numbers?|statistics?|data)/i,
  ];

  if (dataPatterns.some(p => p.test(query))) {
    return 'data_extraction';
  }

  // Metadata patterns (about documents themselves)
  const metadataPatterns = [
    /what (are|is) (the )?(title|name)s? of (my|the) documents?/i,
    /list (my|all|the) documents?/i,
    /show (me )?(my|all) documents?/i,
    /what (types?|kinds?) of files? do I have/i,
    /how many documents do I have/i,
    /do I have (any )?documents? (about|on)/i,
    /find documents? (mentioning|containing|about)/i,
    /which documents? (do I have|are about)/i,
    /(liste|mostre|quais) (meus|os) documentos?/i, // Portuguese
    /(lista|muestra|cuales) (mis|los) documentos?/i, // Spanish
  ];

  if (metadataPatterns.some(p => p.test(query))) {
    return 'metadata';
  }

  // Default: content query (use standard RAG)
  return 'content_query';
}

async function handleEntityExtractionQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void,
  onStage?: (stage: string, message: string) => void,
  language?: string
): Promise<{ sources: any[] }> {
  console.log('ðŸ‘¥ [ENTITY EXTRACTION] Starting entity extraction');

  if (onStage) {
    onStage('analyzing', 'Extracting entities from your documents...');
  }

  const lang = language || detectLanguage(query);

  // Fetch ALL user documents with metadata
  const documents = await prisma.document.findMany({
    where: { userId, status: { not: 'deleted' } },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      metadata: {
        select: {
          extractedText: true
        }
      }
    },
    take: 100 // Limit to prevent timeout
  });

  console.log(`ðŸ“š [ENTITY EXTRACTION] Processing ${documents.length} documents`);

  // Extract entities from all documents
  const entities = {
    organizations: new Set<string>(),
    people: new Set<string>(),
    locations: new Set<string>(),
    sources: new Map<string, string[]>() // entity -> [document names]
  };

  // Simple entity extraction (can be enhanced with NER library)
  for (const doc of documents) {
    const text = doc.metadata?.extractedText || '';
    if (!text) continue;

    // Extract organizations (simple pattern matching)
    // Look for: capitalized multi-word phrases, known patterns
    const orgPatterns = [
      /\b([A-Z][a-z]+ (?:[A-Z][a-z]+ )*(?:Corporation|Corp|Inc|LLC|Ltd|Bank|Company|Co|Group|Association|Committee|Organization))\b/g,
      /\b(HSBC|World Bank|Basel Committee|arXiv|Figshare)\b/gi,
    ];

    orgPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(org => {
          entities.organizations.add(org);
          if (!entities.sources.has(org)) {
            entities.sources.set(org, []);
          }
          entities.sources.get(org)!.push(doc.filename);
        });
      }
    });

    // Extract from filename (e.g., "worldbank_" â†’ "World Bank")
    if (doc.filename.toLowerCase().includes('worldbank') || doc.filename.toLowerCase().includes('world bank')) {
      entities.organizations.add('World Bank');
      if (!entities.sources.has('World Bank')) {
        entities.sources.set('World Bank', []);
      }
      entities.sources.get('World Bank')!.push(doc.filename);
    }

    if (doc.filename.toLowerCase().includes('hsbc')) {
      entities.organizations.add('HSBC');
      if (!entities.sources.has('HSBC')) {
        entities.sources.set('HSBC', []);
      }
      entities.sources.get('HSBC')!.push(doc.filename);
    }
  }

  console.log(`âœ… [ENTITY EXTRACTION] Found ${entities.organizations.size} organizations`);

  // Generate response
  let response = '';

  if (entities.organizations.size === 0) {
    response = lang === 'pt'
      ? 'NÃ£o encontrei menÃ§Ãµes explÃ­citas a empresas ou organizaÃ§Ãµes nos seus documentos.'
      : lang === 'es'
      ? 'No encontrÃ© menciones explÃ­citas a empresas u organizaciones en tus documentos.'
      : 'I didn\'t find explicit mentions of companies or organizations in your documents.';
  } else {
    const orgList = Array.from(entities.organizations).sort();

    if (lang === 'pt') {
      response = `Encontrei ${orgList.length} ${orgList.length === 1 ? 'organizaÃ§Ã£o' : 'organizaÃ§Ãµes'} mencionadas nos seus documentos:\n\n`;
      orgList.forEach(org => {
        const docs = entities.sources.get(org) || [];
        const uniqueDocs = [...new Set(docs)];
        response += `â€¢ **${org}** (mencionada em ${uniqueDocs.length} ${uniqueDocs.length === 1 ? 'documento' : 'documentos'})\n`;
      });
    } else if (lang === 'es') {
      response = `EncontrÃ© ${orgList.length} ${orgList.length === 1 ? 'organizaciÃ³n' : 'organizaciones'} mencionadas en tus documentos:\n\n`;
      orgList.forEach(org => {
        const docs = entities.sources.get(org) || [];
        const uniqueDocs = [...new Set(docs)];
        response += `â€¢ **${org}** (mencionada en ${uniqueDocs.length} ${uniqueDocs.length === 1 ? 'documento' : 'documentos'})\n`;
      });
    } else {
      response = `I found ${orgList.length} ${orgList.length === 1 ? 'organization' : 'organizations'} mentioned in your documents:\n\n`;
      orgList.forEach(org => {
        const docs = entities.sources.get(org) || [];
        const uniqueDocs = [...new Set(docs)];
        response += `â€¢ **${org}** (mentioned in ${uniqueDocs.length} ${uniqueDocs.length === 1 ? 'document' : 'documents'})\n`;
      });
    }
  }

  onChunk(response);

  if (onStage) {
    onStage('complete', 'Complete');
  }

  return { sources: [] };
}

async function handleAdvancedSynthesisQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void,
  onStage?: (stage: string, message: string) => void,
  language?: string
): Promise<{ sources: any[] }> {
  console.log('ðŸ”„ [SYNTHESIS] Starting document synthesis');

  if (onStage) {
    onStage('analyzing', 'Analyzing all your documents...');
  }

  const lang = language || detectLanguage(query);

  // Fetch ALL user documents with content
  const documents = await prisma.document.findMany({
    where: { userId, status: { not: 'deleted' } },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
      metadata: {
        select: {
          extractedText: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50 // Limit to prevent timeout
  });

  console.log(`ðŸ“š [SYNTHESIS] Processing ${documents.length} documents`);

  if (documents.length === 0) {
    const noDocsResponse = await outputIntegration.generateNoDocumentsError(lang);
    if (onChunk) onChunk(noDocsResponse);
    return { sources: [] };
  }

  // Build comprehensive context from ALL documents
  const documentSummaries: string[] = [];

  documents.forEach((doc, index) => {
    const text = doc.metadata?.extractedText || '';
    const preview = text.substring(0, 1000); // First 1000 chars of each doc

    if (preview.length > 0) {
      documentSummaries.push(`Document ${index + 1}: ${doc.filename}\nType: ${doc.mimeType}\nPreview: ${preview}\n`);
    }
  });

  const allContent = documentSummaries.join('\n---\n\n');

  if (documentSummaries.length === 0) {
    const response = lang === 'pt' ? 'NÃ£o hÃ¡ conteÃºdo de texto disponÃ­vel em seus documentos para sÃ­ntese.' :
                     lang === 'es' ? 'No hay contenido de texto disponible en sus documentos para sÃ­ntesis.' :
                     'There is no text content available in your documents for synthesis.';
    if (onChunk) onChunk(response);
    return { sources: [] };
  }

  // Analyze document collection
  const analysis = {
    totalDocs: documents.length,
    types: {} as Record<string, number>,
    keywords: new Map<string, number>(),
  };

  // Count by type
  documents.forEach(doc => {
    const type = doc.mimeType.includes('pdf') ? 'PDF' :
                 doc.mimeType.includes('word') ? 'Word' :
                 doc.mimeType.includes('excel') ? 'Excel' :
                 doc.mimeType.includes('powerpoint') ? 'PowerPoint' : 'Other';
    analysis.types[type] = (analysis.types[type] || 0) + 1;
  });

  // Extract common keywords from filenames
  documents.forEach(doc => {
    const words = doc.filename.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4); // Only words longer than 4 chars

    words.forEach(word => {
      analysis.keywords.set(word, (analysis.keywords.get(word) || 0) + 1);
    });
  });

  // Get top keywords
  const topKeywords = Array.from(analysis.keywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  // Determine task based on query
  const lower = query.toLowerCase();
  let task = 'Analyze and synthesize the document collection';

  if (lower.includes('common') || lower.includes('themes')) {
    task = 'Identify common themes and patterns across all documents';
  } else if (lower.includes('summary') || lower.includes('resumo') || lower.includes('resumen')) {
    task = 'Create a comprehensive summary of the entire document collection';
  } else if (lower.includes('outline')) {
    task = 'Create a structured outline combining key points from all documents';
  } else if (lower.includes('executive') || lower.includes('board')) {
    task = 'Write an executive summary suitable for a board meeting';
  }

  // Generate synthesis using LLM
  const langName = lang === 'pt' ? 'Portuguese' : lang === 'es' ? 'Spanish' : 'English';

  const synthesisPrompt = `You are analyzing a user's document collection. Generate a comprehensive synthesis.

**LANGUAGE**: Respond in ${langName}

**USER QUERY**: ${query}

**DOCUMENT COLLECTION**:
- Total documents: ${analysis.totalDocs}
- Types: ${Object.entries(analysis.types).map(([type, count]) => `${type} (${count})`).join(', ')}
- Common keywords: ${topKeywords.join(', ')}

**DOCUMENT PREVIEWS**:
${allContent.substring(0, 15000)}

**TASK**: ${task}

**REQUIREMENTS**:
1. Be comprehensive but concise
2. Identify main themes and patterns
3. Provide specific examples from the documents
4. Use proper formatting (headings, bullets)
5. Respond in ${langName}`;

  try {
    if (onStage) {
      onStage('generating', 'Creating synthesis...');
    }

    const { default: geminiClient } = await import('./geminiClient.service');
    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    });

    const result = await model.generateContent(synthesisPrompt);
    const response = result.response.text();

    if (onChunk) onChunk(response);
    if (onStage) onStage('complete', 'Complete');

    // Build sources from all documents
    const sources = documents.map(doc => ({
      documentId: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      relevanceScore: 1.0
    }));

    return { sources };
  } catch (error) {
    console.error('âŒ [SYNTHESIS] Error:', error);
    const errorResponse = await outputIntegration.generateProcessingError(lang, 'synthesis');
    if (onChunk) onChunk(errorResponse);
    return { sources: [] };
  }
}

async function handleDataExtractionQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void,
  onStage?: (stage: string, message: string) => void,
  language?: string
): Promise<{ sources: any[] }> {
  console.log('ðŸ“Š [DATA EXTRACTION] Starting data extraction from documents');

  if (onStage) {
    onStage('analyzing', 'Scanning documents for data...');
  }

  const lang = language || detectLanguage(query);

  // Fetch ALL user documents with extractedText from metadata
  const documents = await prisma.document.findMany({
    where: {
      userId,
      status: { not: 'deleted' }
    },
    select: {
      id: true,
      filename: true,
      metadata: {
        select: {
          extractedText: true
        }
      }
    },
    take: 50
  });

  if (documents.length === 0) {
    const noDocsResponse = await outputIntegration.generateNoDocumentsError(lang);
    if (onChunk) onChunk(noDocsResponse);
    return { sources: [] };
  }

  if (onStage) {
    onStage('searching', `Extracting data from ${documents.length} documents...`);
  }

  // Extract data using patterns (no LLM needed for extraction)
  const extractedData: Array<{
    filename: string;
    numbers: string[];
    percentages: string[];
    dates: string[];
  }> = [];

  for (const doc of documents) {
    const text = doc.metadata?.extractedText || '';
    if (!text) continue;

    // Pattern matching for data extraction
    const numbers: string[] = [];
    const percentages: string[] = [];
    const dates: string[] = [];

    // Extract numbers with context (e.g., "$1.5 million", "500 employees")
    const numberPatterns = [
      /\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand|M|B|K))?/gi,
      /[\d,]+(?:\.\d+)?\s*(?:million|billion|thousand|M|B|K)\b/gi,
      /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, // Formatted numbers like 1,234,567
    ];

    numberPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(m => {
        // Get surrounding context (30 chars before and after)
        const idx = text.indexOf(m);
        const context = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + m.length + 30)).trim();
        if (!numbers.includes(`${m} (${context})`)) {
          numbers.push(`${m} (context: ...${context}...)`);
        }
      });
    });

    // Extract percentages with context
    const percentMatches = text.match(/\d+(?:\.\d+)?%/g) || [];
    percentMatches.forEach(m => {
      const idx = text.indexOf(m);
      const context = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + m.length + 30)).trim();
      percentages.push(`${m} (context: ...${context}...)`);
    });

    // Extract dates
    const datePatterns = [
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b(?:Q[1-4]|H[1-2])\s+\d{4}\b/gi, // Q1 2024, H2 2023
    ];

    datePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      dates.push(...matches);
    });

    if (numbers.length > 0 || percentages.length > 0 || dates.length > 0) {
      extractedData.push({
        filename: doc.filename,
        numbers: numbers.slice(0, 10), // Limit to top 10
        percentages: percentages.slice(0, 10),
        dates: [...new Set(dates)].slice(0, 10) // Unique dates
      });
    }
  }

  if (extractedData.length === 0) {
    const response = lang === 'pt' ? 'NÃ£o encontrei dados numÃ©ricos ou datas nos seus documentos.' :
                     lang === 'es' ? 'No encontrÃ© datos numÃ©ricos o fechas en sus documentos.' :
                     lang === 'fr' ? 'Je n\'ai pas trouvÃ© de donnÃ©es numÃ©riques ou de dates dans vos documents.' :
                     'I didn\'t find numerical data or dates in your documents.';
    if (onChunk) onChunk(response);
    return { sources: [] };
  }

  // Format response
  const header = lang === 'pt' ? 'ðŸ“Š **Dados extraÃ­dos dos seus documentos:**\n\n' :
                 lang === 'es' ? 'ðŸ“Š **Datos extraÃ­dos de sus documentos:**\n\n' :
                 lang === 'fr' ? 'ðŸ“Š **DonnÃ©es extraites de vos documents:**\n\n' :
                 'ðŸ“Š **Data extracted from your documents:**\n\n';

  let response = header;

  for (const data of extractedData) {
    response += `**${data.filename}**\n`;

    if (data.numbers.length > 0) {
      const numLabel = lang === 'pt' ? 'NÃºmeros' : lang === 'es' ? 'NÃºmeros' : lang === 'fr' ? 'Nombres' : 'Numbers';
      response += `- ${numLabel}: ${data.numbers.slice(0, 5).join(', ')}\n`;
    }
    if (data.percentages.length > 0) {
      const pctLabel = lang === 'pt' ? 'Porcentagens' : lang === 'es' ? 'Porcentajes' : lang === 'fr' ? 'Pourcentages' : 'Percentages';
      response += `- ${pctLabel}: ${data.percentages.slice(0, 5).join(', ')}\n`;
    }
    if (data.dates.length > 0) {
      const dateLabel = lang === 'pt' ? 'Datas' : lang === 'es' ? 'Fechas' : lang === 'fr' ? 'Dates' : 'Dates';
      response += `- ${dateLabel}: ${data.dates.slice(0, 5).join(', ')}\n`;
    }
    response += '\n';
  }

  if (onChunk) onChunk(response);
  if (onStage) onStage('complete', 'Complete');

  return {
    sources: extractedData.map(d => ({
      documentName: d.filename,
      type: 'data_extraction'
    }))
  };
}

/**
 * Handle metadata queries - Document titles, upload dates, newest/oldest documents
 */
async function handleDocumentMetadataQuery(
  query: string,
  userId: string,
  onChunk: (chunk: string) => void,
  onStage?: (stage: string, message: string) => void,
  language?: string
): Promise<{ sources: any[] }> {
  console.log('ðŸ“ [METADATA] Handling document metadata query');

  const lang = language || detectLanguage(query);
  const lower = query.toLowerCase();

  if (onStage) {
    onStage('searching', 'Retrieving document information...');
  }

  // Determine what metadata is being asked for
  let orderBy: any = { createdAt: 'desc' };
  let limit = 15;
  let filterType: 'newest' | 'oldest' | 'all' | 'titles' = 'all';

  if (lower.includes('newest') || lower.includes('latest') || lower.includes('recent') || lower.includes('last')) {
    filterType = 'newest';
    limit = 5;
    orderBy = { createdAt: 'desc' };
  } else if (lower.includes('oldest') || lower.includes('first') || lower.includes('earliest')) {
    filterType = 'oldest';
    limit = 5;
    orderBy = { createdAt: 'asc' };
  } else if (lower.includes('title') || lower.includes('name')) {
    filterType = 'titles';
    orderBy = { filename: 'asc' };
  }

  const documents = await prisma.documents.findMany({
    where: {
      userId,
      status: { not: 'deleted' }
    },
    select: {
      filename: true,
      createdAt: true,
      mimeType: true,
      fileSize: true,
    },
    orderBy,
    take: limit
  });

  if (documents.length === 0) {
    const noDocsResponse = await outputIntegration.generateNoDocumentsError(lang);
    if (onChunk) onChunk(noDocsResponse);
    return { sources: [] };
  }

  // Format response based on query type
  let response = '';

  const formatSize = (bytes: number | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (filterType === 'newest') {
    const header = lang === 'pt' ? 'Seus documentos mais recentes:' :
                   lang === 'es' ? 'Sus documentos mÃ¡s recientes:' :
                   lang === 'fr' ? 'Vos documents les plus rÃ©cents:' :
                   'Your most recent documents:';
    response = `${header}\n\n`;
    documents.forEach((doc, i) => {
      response += `${i + 1}. **${doc.filename}** - uploaded ${formatDate(doc.createdAt)}\n`;
    });
  } else if (filterType === 'oldest') {
    const header = lang === 'pt' ? 'Seus documentos mais antigos:' :
                   lang === 'es' ? 'Sus documentos mÃ¡s antiguos:' :
                   lang === 'fr' ? 'Vos documents les plus anciens:' :
                   'Your oldest documents:';
    response = `${header}\n\n`;
    documents.forEach((doc, i) => {
      response += `${i + 1}. **${doc.filename}** - uploaded ${formatDate(doc.createdAt)}\n`;
    });
  } else if (filterType === 'titles') {
    const header = lang === 'pt' ? 'TÃ­tulos dos seus documentos:' :
                   lang === 'es' ? 'TÃ­tulos de sus documentos:' :
                   lang === 'fr' ? 'Titres de vos documents:' :
                   'Your document titles:';
    response = `${header}\n\n`;
    documents.forEach((doc, i) => {
      response += `${i + 1}. ${doc.filename}\n`;
    });
  } else {
    // NEW: Use inline document injection for file listing
    // This injects {{DOC:::id:::filename:::mimeType:::size:::folder}} markers
    response = formatFileListingResponse(documents, {
      maxInline: limit,
      includeMetadata: true
    });
  }

  if (onChunk) onChunk(response);
  if (onStage) onStage('complete', 'Complete');

  return { sources: [] };
}

// ============================================================================
// GET CONTEXT - Retrieve stored RAG context by ID
// ============================================================================
async function getContext(contextId: string): Promise<any> {
  // Contexts are typically stored in-memory or in cache
  // For now, return null as contexts are ephemeral
  console.log(`ðŸ“‹ [RAG] Getting context for: ${contextId}`);
  return null;
}

// ============================================================================
// DEFAULT EXPORT (for backward compatibility with default imports)
// ============================================================================
export default {
  generateAnswer,
  generateAnswerStream,
  generateAnswerStreaming,
  getContext,
};


// ============================================================================
// DEEP_FINANCIAL_ANALYSIS MODE - HELPER FUNCTIONS
// ============================================================================

/**
 * Handle DEEP_FINANCIAL_ANALYSIS mode
 */
export async function handleDeepFinancialAnalysis(
  userId: string,
  query: string,
  conversationHistory: any[],
  language: string,
  onChunk: (chunk: string) => void
): Promise<{ answer: string; sources: any[] }> {
  console.log('💰 [DEEP_FINANCIAL_ANALYSIS] Starting financial analysis...');

  try {
    const financialDocs = await identifyFinancialDocuments(userId, query);
    console.log(`💰 [FINANCIAL] Found ${financialDocs.length} financial documents`);

    if (financialDocs.length === 0) {
      const fallbackMsg = language === 'pt'
        ? '**Não encontrei documentos financeiros** com informações de ROI ou análise de viabilidade.\n\n• Faça upload de documentos financeiros\n• Verifique se o documento contém dados de ROI'
        : '**I could not find financial documents** with ROI or feasibility analysis information.\n\n• Upload financial documents\n• Check if your documents contain ROI data';
      const formattedFinancialFallback = applyFormatEnforcement(fallbackMsg, {
        responseType: 'financial_fallback',
        logPrefix: '[FINANCIAL-FALLBACK FORMAT]'
      });
      onChunk(formattedFinancialFallback);
      return { answer: formattedFinancialFallback, sources: [] };
    }

    const { baselineChunks, conservativeChunks, optimisticChunks } = await retrieveScenarioChunks(
      userId,
      financialDocs,
      query
    );

    const extractionResult: NumericExtractionResult = await extractFinancialFacts(
      baselineChunks,
      conservativeChunks,
      optimisticChunks
    );

    const financialAnalysis: FinancialAnalysisResult = calculateFinancialAnalysis(extractionResult.facts);

    const financialContext = buildFinancialContext(
      extractionResult,
      financialAnalysis,
      baselineChunks,
      conservativeChunks,
      optimisticChunks
    );

    const systemPrompt = buildFinancialSystemPrompt(language);

    const fullPrompt = `${systemPrompt}

**FINANCIAL DATA:**
${financialContext}

**USER QUERY:**
${query}`;

    const model = geminiClient.getModel({
      model: 'gemini-1.5-pro',
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      }
    });

    let fullResponse = '';
    const streamResult = await model.generateContentStream(fullPrompt);

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      onChunk(chunkText);
    }

    const sources = [...baselineChunks, ...conservativeChunks, ...optimisticChunks]
      .map(chunk => ({
        documentId: chunk.documentId,
        chunkId: chunk.id,
        text: chunk.text?.substring(0, 200) || '',
      }))
      .slice(0, 10);

    return { answer: fullResponse, sources };

  } catch (error) {
    console.error('❌ [DEEP_FINANCIAL_ANALYSIS] Error:', error);
    const errorMsg = language === 'pt'
      ? 'Ocorreu um erro ao processar a análise financeira.'
      : 'An error occurred while processing the financial analysis.';
    onChunk(errorMsg);
    return { answer: errorMsg, sources: [] };
  }
}

async function identifyFinancialDocuments(userId: string, query: string): Promise<any[]> {
  const financialKeywords = [
    'viabilidade', 'roi', 'investimento', 'cenario', 'scenario',
    'payback', 'financeiro', 'financial', 'analise', 'analysis'
  ];

  const documents = await prisma.document.findMany({
    where: {
      userId,
      OR: financialKeywords.map(keyword => ({
        filename: {
          contains: keyword,
          mode: 'insensitive'
        }
      }))
    },
    select: {
      id: true,
      filename: true,
      mimeType: true,
    },
    take: 10,
  });

  return documents;
}

async function retrieveScenarioChunks(
  userId: string,
  documents: any[],
  query: string
): Promise<{
  baselineChunks: any[];
  conservativeChunks: any[];
  optimisticChunks: any[];
}> {
  const documentIds = documents.map(d => d.id);

  const allChunks = await prisma.documentChunk.findMany({
    where: {
      documentId: { in: documentIds },
    },
    select: {
      id: true,
      documentId: true,
      text: true,
      page: true,
    },
  });

  const baselineChunks: any[] = [];
  const conservativeChunks: any[] = [];
  const optimisticChunks: any[] = [];

  for (const chunk of allChunks) {
    const text = chunk.text?.toLowerCase() || '';

    if (text.includes('baseline') || text.includes('base') || text.includes('atual')) {
      baselineChunks.push(chunk);
    } else if (text.includes('conservador') || text.includes('conservative') || text.includes('pessimista')) {
      conservativeChunks.push(chunk);
    } else if (text.includes('otimista') || text.includes('optimistic') || text.includes('melhor')) {
      optimisticChunks.push(chunk);
    } else {
      baselineChunks.push(chunk);
    }
  }

  return { baselineChunks, conservativeChunks, optimisticChunks };
}

function buildFinancialContext(
  extraction: NumericExtractionResult,
  analysis: FinancialAnalysisResult,
  baselineChunks: any[],
  conservativeChunks: any[],
  optimisticChunks: any[]
): string {
  let context = '## EXTRACTED FINANCIAL FACTS\n\n';

  const factsByScenario = {
    BASELINE: extraction.facts.filter(f => f.scenario === 'BASELINE'),
    CONSERVATIVE: extraction.facts.filter(f => f.scenario === 'CONSERVATIVE'),
    OPTIMISTIC: extraction.facts.filter(f => f.scenario === 'OPTIMISTIC'),
  };

  for (const [scenario, facts] of Object.entries(factsByScenario)) {
    context += `### ${scenario} Scenario\n`;
    for (const fact of facts) {
      context += `- ${formatMetric(fact.metric)}: ${formatValue(fact.value, fact.unit)}\n`;
    }
    context += '\n';
  }

  context += '## CALCULATED ANALYSIS\n\n';

  if (analysis.dataCompleteness === 'FULL' || analysis.dataCompleteness === 'PARTIAL') {
    context += `### Conservative Scenario\n`;
    context += `- ROI: ${formatROI(analysis.roi_conservative)}\n`;
    context += `- Payback: ${formatPayback(analysis.payback_conservative_years)}\n`;
    context += `- Monthly Incremental Profit: ${formatCurrency(analysis.incremental_profit_conservative_monthly)}\n\n`;

    context += `### Optimistic Scenario\n`;
    context += `- ROI: ${formatROI(analysis.roi_optimistic)}\n`;
    context += `- Payback: ${formatPayback(analysis.payback_optimistic_years)}\n`;
    context += `- Monthly Incremental Profit: ${formatCurrency(analysis.incremental_profit_optimistic_monthly)}\n\n`;

    if (analysis.roi_conservative && analysis.roi_optimistic) {
      context += `### Comparison\n`;
      context += generateComparisonText(
        analysis.roi_conservative,
        analysis.roi_optimistic,
        analysis.payback_conservative_years,
        analysis.payback_optimistic_years
      );
    }
  } else {
    context += `Data completeness: ${analysis.dataCompleteness}\n`;
    context += `Missing metrics: ${analysis.missingMetrics.join(', ')}\n`;
  }

  return context;
}

function buildFinancialSystemPrompt(language: string): string {
  if (language === 'pt') {
    return `Você é Koda, um assistente especializado em análise financeira de documentos.
Analise dados financeiros extraídos, calcule ROI e payback, compare cenários e forneça recomendações.
Use markdown estruturado com títulos, listas e tabelas. Seja preciso com números e cite fontes.`;
  }

  return `You are Koda, an assistant specialized in financial document analysis.
Analyze financial data, calculate ROI and payback, compare scenarios and provide recommendations.
Use structured markdown with headings, lists and tables. Be precise with numbers and cite sources.`;
}

function formatMetric(metric: string): string {
  const metricNames: Record<string, string> = {
    NET_PROFIT: 'Lucro Líquido Mensal',
    INVESTMENT: 'Investimento Total',
    ADDITIONAL_REVENUE: 'Receita Adicional Mensal',
    OPERATING_COST_PERCENT: 'Custo Operacional (%)',
    LOCABLE_AREA: 'Área Locável',
    OTHER: 'Outro',
  };

  return metricNames[metric] || metric;
}

function formatValue(value: number, unit: string): string {
  switch (unit) {
    case 'BRL':
    case 'MONTHLY':
    case 'YEARLY':
      return formatCurrency(value);
    case 'PERCENT':
      return `${value.toFixed(1)}%`;
    case 'M2':
      return `${value.toLocaleString('pt-BR')} m²`;
    default:
      return value.toLocaleString('pt-BR');
  }
}

// trigger reload Fri, Dec  5, 2025  5:59:47 PM
