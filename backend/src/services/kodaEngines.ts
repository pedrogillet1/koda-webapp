/**
 * Koda Engines - Central Composition File
 * Single source of truth for all Koda engines
 *
 * This file instantiates and exports all engines used by the orchestrator.
 * Controllers and routes should NEVER import low-level services directly.
 * They should only import kodaEngines or the orchestrator (rag.service).
 *
 * @version 1.0.0
 * @date 2025-12-09
 */

// ============================================================================
// KODA ENGINES (Core Layer)
// ============================================================================

import KodaIntentEngine from './kodaIntentEngine.service';
import {
  getConversationMemory,
  updateConversationMemory,
  isMemoryRecallQuery,
  isFollowUpQuery,
  resolveDocumentReference,
  getDocumentList,
  saveDocumentList,
  getMemoryContext,
  type KodaMemory,
} from './kodaMemoryEngine.service';
import KodaRetrievalEngine from './kodaRetrievalEngine.service';
import kodaAnswerEngine from './kodaAnswerEngine.service';
import { kodaStreamingController } from './kodaStreamingController.service';

// ============================================================================
// ANSWER TYPE ROUTER
// ============================================================================

import {
  detectAnswerType,
  getEstimatedTime,
  requiresRetrieval,
  requiresLLM,
  getModelForAnswerType,
  logAnswerTypeDetection,
  type AnswerType,
} from './answerTypeRouter.service';

// ============================================================================
// INFRASTRUCTURE SERVICES (Bottom Layer)
// ============================================================================

import embeddingService from './embedding.service';
import pineconeService from './pinecone.service';
import { systemPromptsService } from './systemPrompts.service';
import * as languageDetectionService from './languageDetection.service';
import cacheService from './cache.service';
import storageService from './storage.service';
import analyticsEngineService from './analyticsEngine.service';
import encryptionService from './encryption.service';

// Document & Folder services
import * as folderService from './folder.service';
import fileActionsService from './fileActions.service';

// Formatting & Validation services
import { kodaOutputStructureEngine } from './kodaOutputStructureEngine.service';
import { kodaAnswerValidationEngine } from './kodaAnswerValidationEngine.service';
import { kodaCitationFormatService } from './kodaCitationFormat.service';
import { formatValidationService } from './formatValidation.service';

// Reranking & Context services
import { microSummaryRerankerService } from './microSummaryReranker.service';
import contextEngineering from './contextEngineering.service';

// Memory services
import infiniteConversationMemory from './infiniteConversationMemory.service';
import rollingConversationSummaryService from './rollingConversationSummary.service';

// Calculation services
import calculationService from './calculation.service';
import financialCalculatorService from './financialCalculator.service';
import calculationRouter from './calculation/calculationRouter.service';

// Navigation services
import { handleNavigationQuery } from './navigationOrchestrator.service';

// ============================================================================
// ENGINE INSTANTIATION
// ============================================================================

/**
 * KodaIntentEngine instance
 * Detects intent, language, and answer type
 */
const intentEngine = new KodaIntentEngine();

/**
 * KodaRetrievalEngine instance
 * Handles embeddings, vector search, and reranking
 */
const retrievalEngine = new KodaRetrievalEngine();

// ============================================================================
// EXPORTS - KODA ENGINES
// ============================================================================

export const kodaEngines = {
  // Core Engines
  intent: intentEngine,
  retrieval: retrievalEngine,
  answer: kodaAnswerEngine,
  streaming: kodaStreamingController,

  // Memory Engine (uses functional exports from kodaMemoryEngine)
  memory: {
    getConversationMemory,
    updateConversationMemory,
    isMemoryRecallQuery,
    isFollowUpQuery,
    resolveDocumentReference,
    getDocumentList,
    saveDocumentList,
    getMemoryContext,
  },

  // Answer Type Router
  router: {
    detectAnswerType,
    getEstimatedTime,
    requiresRetrieval,
    requiresLLM,
    getModelForAnswerType,
    logAnswerTypeDetection,
  },

  // Navigation
  navigation: {
    handleNavigationQuery,
  },

  // Formatting & Validation
  formatting: {
    outputStructure: kodaOutputStructureEngine,
    answerValidation: kodaAnswerValidationEngine,
    citationFormat: kodaCitationFormatService,
    formatValidation: formatValidationService,
  },

  // Calculation
  calculation: {
    router: calculationRouter,
    service: calculationService,
    financial: financialCalculatorService,
  },
};

export type KodaEngines = typeof kodaEngines;

// ============================================================================
// EXPORTS - INFRASTRUCTURE (for engines only, not controllers)
// ============================================================================

export const kodaInfrastructure = {
  embedding: embeddingService,
  pinecone: pineconeService,
  systemPrompts: systemPromptsService,
  languageDetection: languageDetectionService,
  cache: cacheService,
  storage: storageService,
  analytics: analyticsEngineService,
  encryption: encryptionService,
  folder: folderService,
  fileActions: fileActionsService,
  reranking: microSummaryRerankerService,
  contextEngineering,
  infiniteMemory: infiniteConversationMemory,
  rollingSummary: rollingConversationSummaryService,
};

export type KodaInfrastructure = typeof kodaInfrastructure;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { AnswerType };
export type { KodaMemory };

export default kodaEngines;
