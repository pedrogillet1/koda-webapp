/**
 * Koda V3 Composition Root (Dependency Injection Container)
 *
 * This file is the SINGLE SOURCE OF TRUTH for service instantiation.
 * All services are created here in the correct dependency order.
 *
 * WHY THIS EXISTS:
 * - Prevents circular dependencies
 * - Ensures all dependencies are wired correctly
 * - Fail-fast on missing dependencies (startup error vs runtime error)
 * - Makes testing easier (can inject mocks)
 *
 * RULES:
 * 1. Controllers MUST import orchestrator from this file ONLY
 * 2. Service files MUST export classes, NOT instances
 * 3. All singletons are created here
 * 4. JSON configs are loaded once at startup
 */

import { KodaOrchestratorV3 } from '../services/core/kodaOrchestratorV3.service';
import KodaIntentEngineV3 from '../services/core/kodaIntentEngineV3.service';
import IntentConfigService, { intentConfigService } from '../services/core/intentConfig.service';
import KodaRetrievalEngineV3 from '../services/core/kodaRetrievalEngineV3.service';
import { KodaHybridSearchService } from '../services/retrieval/kodaHybridSearch.service';
import { DynamicDocBoostService } from '../services/retrieval/dynamicDocBoost.service';
import KodaAnswerEngineV3 from '../services/core/kodaAnswerEngineV3.service';
import KodaFormattingPipelineV3Service from '../services/core/kodaFormattingPipelineV3.service';
import KodaProductHelpServiceV3, { kodaProductHelpServiceV3 } from '../services/core/kodaProductHelpV3.service';
import FallbackConfigService, { fallbackConfigService } from '../services/core/fallbackConfig.service';
import { MultiIntentService } from '../services/core/multiIntent.service';
import { OverrideService } from '../services/core/override.service';
import { UserPreferencesService } from '../services/user/userPreferences.service';
import { ConversationMemoryService } from '../services/memory/conversationMemory.service';
import { FeedbackLoggerService } from '../services/analytics/feedbackLogger.service';
import { AnalyticsEngineService } from '../services/analytics/analyticsEngine.service';
import DocumentSearchService from '../services/analytics/documentSearch.service';

// Infrastructure services
import { CacheService } from '../services/cache.service';
import { EncryptionService } from '../services/encryption.service';
import { PineconeService } from '../services/pinecone.service';
import { EmbeddingService } from '../services/embedding.service';
import { ChunkingService } from '../services/chunking.service';
import { DocumentProgressService } from '../services/documentProgress.service';
import { ProfileService } from '../services/profile.service';

// Core RAG services
import { KodaMarkerGeneratorService } from '../utils/kodaMarkerGenerator.service';
import { KodaFallbackEngineV3 } from '../services/core/kodaFallbackEngineV3.service';
import { KodaRetrievalRankingService } from '../services/retrieval/kodaRetrievalRanking.service';
import { DefaultLanguageDetector } from '../services/core/languageDetector.service';
import PatternClassifierServiceV3 from '../services/core/patternClassifierV3.service';

// ============================================================================
// BOOTSTRAP ERROR
// ============================================================================

class BootstrapWiringError extends Error {
  constructor(message: string) {
    super(`[BOOTSTRAP_WIRING_ERROR] ${message}`);
    this.name = 'BootstrapWiringError';
  }
}

// ============================================================================
// CONTAINER INTERFACE
// ============================================================================

export interface KodaV3Services {
  // Core orchestration
  orchestrator: KodaOrchestratorV3;
  intentEngine: KodaIntentEngineV3;
  intentConfig: IntentConfigService;
  retrievalEngine: KodaRetrievalEngineV3;
  answerEngine: KodaAnswerEngineV3;
  formattingPipeline: KodaFormattingPipelineV3Service;
  productHelp: KodaProductHelpServiceV3;
  fallbackConfig: FallbackConfigService;
  multiIntent: MultiIntentService;
  override: OverrideService;
  userPreferences: UserPreferencesService;
  conversationMemory: ConversationMemoryService;
  feedbackLogger: FeedbackLoggerService;
  analyticsEngine: AnalyticsEngineService;
  documentSearch: DocumentSearchService;
  hybridSearch: KodaHybridSearchService;
  dynamicDocBoost: DynamicDocBoostService;

  // Infrastructure services
  cache: CacheService;
  encryption: EncryptionService;
  pinecone: PineconeService;
  embedding: EmbeddingService;
  chunking: ChunkingService;
  documentProgress: DocumentProgressService;
  profile: ProfileService;

  // Core RAG services
  markerGenerator: KodaMarkerGeneratorService;
  fallbackEngine: KodaFallbackEngineV3;
  retrievalRanking: KodaRetrievalRankingService;
  languageDetector: DefaultLanguageDetector;
  patternClassifier: PatternClassifierServiceV3;
}

// ============================================================================
// CONTAINER CLASS
// ============================================================================

class KodaV3Container {
  private services: Partial<KodaV3Services> = {};
  private _isInitialized = false;

  /**
   * Initialize all services in correct dependency order.
   * This MUST be called once at server startup.
   */
  public async initialize(): Promise<void> {
    if (this._isInitialized) {
      console.log('⚠️  [Container] Already initialized, skipping');
      return;
    }

    console.log('🚀 [Container] Initializing Koda V3 services...');

    try {
      // ========== STEP 1: Use pre-loaded config singletons ==========
      // These are loaded in server.ts BEFORE container init (fail-fast on startup)
      console.log('📦 [Container] Using pre-loaded config singletons...');
      this.services.fallbackConfig = fallbackConfigService;
      this.services.intentConfig = intentConfigService;
      this.services.productHelp = kodaProductHelpServiceV3;

      // Verify configs are loaded (fail-fast)
      if (!this.services.fallbackConfig.isReady()) {
        throw new BootstrapWiringError('FallbackConfig not loaded - must call loadFallbacks() before container init');
      }
      if (!this.services.intentConfig.isReady()) {
        throw new BootstrapWiringError('IntentConfig not loaded - must call loadPatterns() before container init');
      }
      if (!this.services.productHelp.isReady()) {
        throw new BootstrapWiringError('ProductHelp not loaded - must call loadContent() before container init');
      }

      // ========== STEP 2: Create infrastructure services ==========
      console.log('📦 [Container] Creating infrastructure services...');
      this.services.cache = new CacheService();
      this.services.encryption = new EncryptionService();
      this.services.pinecone = new PineconeService();
      this.services.embedding = new EmbeddingService();
      this.services.chunking = new ChunkingService();
      this.services.documentProgress = new DocumentProgressService();
      this.services.profile = new ProfileService();
      this.services.markerGenerator = new KodaMarkerGeneratorService();
      this.services.retrievalRanking = new KodaRetrievalRankingService();
      this.services.languageDetector = new DefaultLanguageDetector();

      // ========== STEP 3: Create leaf services (no dependencies) ==========
      console.log('📦 [Container] Creating leaf services...');
      this.services.retrievalEngine = new KodaRetrievalEngineV3();
      this.services.answerEngine = new KodaAnswerEngineV3();
      this.services.formattingPipeline = new KodaFormattingPipelineV3Service();
      this.services.multiIntent = new MultiIntentService();
      this.services.override = new OverrideService();
      this.services.userPreferences = new UserPreferencesService();
      this.services.conversationMemory = new ConversationMemoryService();
      this.services.feedbackLogger = new FeedbackLoggerService();
      this.services.analyticsEngine = new AnalyticsEngineService();
      this.services.documentSearch = new DocumentSearchService();
      this.services.hybridSearch = new KodaHybridSearchService();
      this.services.dynamicDocBoost = new DynamicDocBoostService();

      // ========== STEP 4: Load JSON configurations ==========
      console.log('📦 [Container] Loading JSON configurations...');
      await this.services.intentConfig.loadPatterns();
      await this.services.fallbackConfig.loadFallbacks();
      await this.services.productHelp.loadContent();

      // ========== STEP 5: Create intent engine (depends on loaded intentConfig) ==========
      console.log('📦 [Container] Creating intent engine...');
      this.services.intentEngine = new KodaIntentEngineV3(this.services.intentConfig);

      // ========== STEP 6: Create services that depend on intent engine ==========
      console.log('📦 [Container] Creating dependent services...');
      this.services.fallbackEngine = new KodaFallbackEngineV3(this.services.fallbackConfig);
      this.services.patternClassifier = new PatternClassifierServiceV3(this.services.intentEngine);

      // ========== STEP 7: Create orchestrator (depends on everything) ==========
      console.log('📦 [Container] Creating orchestrator with dependencies...');
      this.services.orchestrator = new KodaOrchestratorV3(
        {
          intentEngine: this.services.intentEngine,
          fallbackConfig: this.services.fallbackConfig,
          productHelp: this.services.productHelp,
          formattingPipeline: this.services.formattingPipeline,
          retrievalEngine: this.services.retrievalEngine,
          answerEngine: this.services.answerEngine,
          multiIntent: this.services.multiIntent,
          override: this.services.override,
          userPreferences: this.services.userPreferences,
          conversationMemory: this.services.conversationMemory,
          feedbackLogger: this.services.feedbackLogger,
          analyticsEngine: this.services.analyticsEngine,
          documentSearch: this.services.documentSearch,
        },
        console // logger
      );

      // ========== STEP 8: Fail-fast assertions ==========
      this.assertWiring();

      this._isInitialized = true;

      console.log('✅ [Container] Koda V3 initialization complete!');
    } catch (error) {
      console.error('❌ [Container] Initialization failed:', error);
      throw new BootstrapWiringError(
        `Failed to initialize Koda V3 services: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Fail-fast assertions to ensure all critical dependencies are wired.
   */
  private assertWiring(): void {
    console.log('🔍 [Container] Running fail-fast wiring assertions...');

    const criticalServices: (keyof KodaV3Services)[] = [
      'orchestrator',
      'intentEngine',
      'retrievalEngine',
      'answerEngine',
      'formattingPipeline',
      'fallbackConfig',
    ];

    for (const serviceName of criticalServices) {
      if (!this.services[serviceName]) {
        throw new BootstrapWiringError(`${serviceName} is undefined`);
      }
    }

    // Verify orchestrator has dependencies
    const orch = this.services.orchestrator as any;
    if (!orch.retrievalEngine) {
      throw new BootstrapWiringError('Orchestrator.retrievalEngine is undefined (DI failed)');
    }
    if (!orch.answerEngine) {
      throw new BootstrapWiringError('Orchestrator.answerEngine is undefined (DI failed)');
    }
    if (!orch.intentEngine) {
      throw new BootstrapWiringError('Orchestrator.intentEngine is undefined (DI failed)');
    }

    // Verify intentEngine has intentConfig wired (Phase 3 requirement)
    const intentEng = this.services.intentEngine as any;
    if (!intentEng.intentConfig) {
      throw new BootstrapWiringError('IntentEngine.intentConfig is undefined (DI failed)');
    }
    if (!intentEng.languageDetector) {
      throw new BootstrapWiringError('IntentEngine.languageDetector is undefined (DI failed)');
    }

    console.log('✅ [Container] All wiring assertions passed');
  }

  /**
   * Check if container is initialized
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get the orchestrator instance.
   */
  public getOrchestrator(): KodaOrchestratorV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError(
        'Container not initialized. Call container.initialize() at server startup.'
      );
    }
    return this.services.orchestrator!;
  }

  /**
   * Get the intent engine instance.
   */
  public getIntentEngine(): KodaIntentEngineV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.intentEngine!;
  }

  /**
   * Get the retrieval engine instance.
   */
  public getRetrievalEngine(): KodaRetrievalEngineV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.retrievalEngine!;
  }

  /**
   * Get the answer engine instance.
   */
  public getAnswerEngine(): KodaAnswerEngineV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.answerEngine!;
  }

  /**
   * Get the analytics engine instance.
   */
  public getAnalyticsEngine(): AnalyticsEngineService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.analyticsEngine!;
  }

  /**
   * Get the formatting pipeline instance.
   */
  public getFormattingPipeline(): KodaFormattingPipelineV3Service {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.formattingPipeline!;
  }

  /**
   * Get the fallback config instance.
   */
  public getFallbackConfig(): FallbackConfigService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.fallbackConfig!;
  }

  /**
   * Get the product help instance.
   */
  public getProductHelp(): KodaProductHelpServiceV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.productHelp!;
  }

  /**
   * Get the user preferences instance.
   */
  public getUserPreferences(): UserPreferencesService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.userPreferences!;
  }

  /**
   * Get the conversation memory instance.
   */
  public getConversationMemory(): ConversationMemoryService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.conversationMemory!;
  }

  /**
   * Get the feedback logger instance.
   */
  public getFeedbackLogger(): FeedbackLoggerService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.feedbackLogger!;
  }

  /**
   * Get the document search instance.
   */
  public getDocumentSearch(): DocumentSearchService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.documentSearch!;
  }

  /**
   * Get the multi-intent service instance.
   */
  public getMultiIntent(): MultiIntentService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.multiIntent!;
  }

  /**
   * Get the override service instance.
   */
  public getOverride(): OverrideService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.override!;
  }

  /**
   * Get the intent config instance.
   */
  public getIntentConfig(): IntentConfigService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.intentConfig!;
  }

  /**
   * Get the hybrid search instance.
   */
  public getHybridSearch(): KodaHybridSearchService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.hybridSearch!;
  }

  /**
   * Get the dynamic doc boost instance.
   */
  public getDynamicDocBoost(): DynamicDocBoostService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.dynamicDocBoost!;
  }

  // ========== Infrastructure Services ==========

  /**
   * Get the cache service instance.
   */
  public getCache(): CacheService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.cache!;
  }

  /**
   * Get the encryption service instance.
   */
  public getEncryption(): EncryptionService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.encryption!;
  }

  /**
   * Get the pinecone service instance.
   */
  public getPinecone(): PineconeService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.pinecone!;
  }

  /**
   * Get the embedding service instance.
   */
  public getEmbedding(): EmbeddingService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.embedding!;
  }

  /**
   * Get the chunking service instance.
   */
  public getChunking(): ChunkingService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.chunking!;
  }

  /**
   * Get the document progress service instance.
   */
  public getDocumentProgress(): DocumentProgressService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.documentProgress!;
  }

  /**
   * Get the profile service instance.
   */
  public getProfile(): ProfileService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.profile!;
  }

  // ========== Core RAG Services ==========

  /**
   * Get the marker generator service instance.
   */
  public getMarkerGenerator(): KodaMarkerGeneratorService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.markerGenerator!;
  }

  /**
   * Get the fallback engine service instance.
   */
  public getFallbackEngine(): KodaFallbackEngineV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.fallbackEngine!;
  }

  /**
   * Get the retrieval ranking service instance.
   */
  public getRetrievalRanking(): KodaRetrievalRankingService {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.retrievalRanking!;
  }

  /**
   * Get the language detector service instance.
   */
  public getLanguageDetector(): DefaultLanguageDetector {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.languageDetector!;
  }

  /**
   * Get the pattern classifier service instance.
   */
  public getPatternClassifier(): PatternClassifierServiceV3 {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services.patternClassifier!;
  }

  /**
   * Get all services (for testing)
   */
  public getAllServices(): KodaV3Services {
    if (!this._isInitialized) {
      throw new BootstrapWiringError('Container not initialized');
    }
    return this.services as KodaV3Services;
  }
}

// ============================================================================
// SINGLETON CONTAINER INSTANCE
// ============================================================================

const container = new KodaV3Container();

/**
 * Initialize the container (call once at startup)
 */
export async function initializeContainer(): Promise<void> {
  await container.initialize();
}

/**
 * Get the container instance
 */
export function getContainer(): KodaV3Container {
  return container;
}

/**
 * Convenience export for orchestrator
 */
export function getOrchestrator(): KodaOrchestratorV3 {
  return container.getOrchestrator();
}

export { container };
export default container;
